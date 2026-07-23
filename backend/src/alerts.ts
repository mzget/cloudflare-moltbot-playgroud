import { Env } from './index';

interface AlertRule {
  id: number;
  symbol: string;
  metric: string;
  condition_type: string;
  target_value: number;
  last_checked_value: number | null;
  last_checked_state: string | null;
  is_active: number;
}

interface MarketStats {
  symbol: string;
  market_cap: number | null;
  price: number | null;
  p_e: number | null;
  ev_ebit: number | null;
  ev_sales: number | null;
}

export async function checkAlertRules(env: Env): Promise<{ triggeredCount: number; errors: string[] }> {
  console.log("Checking alert rules...");
  const errors: string[] = [];
  let triggeredCount = 0;

  try {
    // 1. Fetch active alert rules
    const rulesResult = await env.DB.prepare(
      'SELECT * FROM alert_rules WHERE is_active = 1'
    ).all();
    const rules = (rulesResult.results || []) as unknown as AlertRule[];

    if (rules.length === 0) {
      console.log("No active alert rules found.");
      return { triggeredCount: 0, errors };
    }

    // 2. Fetch current stats for the unique symbols in the rules
    const uniqueSymbols = Array.from(new Set(rules.map(r => r.symbol)));
    const placeholders = uniqueSymbols.map(() => '?').join(',');
    const statsResult = await env.DB.prepare(
      `SELECT symbol, market_cap, price, p_e, ev_ebit, ev_sales FROM market_stats WHERE symbol IN (${placeholders})`
    ).bind(...uniqueSymbols).all();
    
    const statsList = (statsResult.results || []) as unknown as MarketStats[];
    const statsMap = new Map<string, MarketStats>();
    for (const stats of statsList) {
      statsMap.set(stats.symbol.toUpperCase(), stats);
    }

    const triggeredAlerts: {
      symbol: string;
      metric: string;
      condition_type: string;
      target_value: number;
      current_value: number;
      message: string;
    }[] = [];

    const batchStatements: any[] = [];

    // 3. Evaluate each rule
    for (const rule of rules) {
      const stats = statsMap.get(rule.symbol.toUpperCase());
      if (!stats) {
        console.warn(`No market stats found for active rule symbol: ${rule.symbol}`);
        continue;
      }

      // Get current metric value
      let currentValue: number | null = null;
      if (rule.metric === 'market_cap') currentValue = stats.market_cap;
      else if (rule.metric === 'price') currentValue = stats.price;
      else if (rule.metric === 'p_e') currentValue = stats.p_e;
      else if (rule.metric === 'ev_ebit') currentValue = stats.ev_ebit;
      else if (rule.metric === 'ev_sales') currentValue = stats.ev_sales;

      if (currentValue === null || currentValue === undefined) {
        continue; // Stat value not available yet
      }

      const targetValue = rule.target_value;
      const currentState = currentValue >= targetValue ? 'above' : 'below';
      const lastState = rule.last_checked_state;

      if (!lastState) {
        // First check: initialize the state but do not trigger
        batchStatements.push(
          env.DB.prepare(
            'UPDATE alert_rules SET last_checked_value = ?, last_checked_state = ?, updated_at = (strftime(\'%s\', \'now\')) WHERE id = ?'
          ).bind(currentValue, currentState, rule.id)
        );
        continue;
      }

      // Check for crossover
      let isCrossover = false;
      let triggerMessage = '';

      const metricLabel = getMetricLabel(rule.metric);
      const formattedTarget = formatMetricValue(targetValue, rule.metric);
      const formattedCurrent = formatMetricValue(currentValue, rule.metric);

      if (rule.condition_type === 'cross_up' && lastState === 'below' && currentState === 'above') {
        isCrossover = true;
        triggerMessage = `${rule.symbol} ${metricLabel} crossed up target of ${formattedTarget} (Current: ${formattedCurrent})`;
      } else if (rule.condition_type === 'cross_down' && lastState === 'above' && currentState === 'below') {
        isCrossover = true;
        triggerMessage = `${rule.symbol} ${metricLabel} crossed down target of ${formattedTarget} (Current: ${formattedCurrent})`;
      }

      if (isCrossover) {
        console.log(`ALERT TRIGGERED: ${triggerMessage}`);
        triggeredCount++;

        // Save in-app notification
        batchStatements.push(
          env.DB.prepare(
            `INSERT INTO in_app_notifications (symbol, metric, condition_type, target_value, trigger_value, message)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            rule.symbol.toUpperCase(),
            rule.metric,
            rule.condition_type,
            targetValue,
            currentValue,
            triggerMessage
          )
        );

        triggeredAlerts.push({
          symbol: rule.symbol,
          metric: rule.metric,
          condition_type: rule.condition_type,
          target_value: targetValue,
          current_value: currentValue,
          message: triggerMessage
        });
      }

      // Update state (either it crossed or changed state back without triggering condition)
      if (lastState !== currentState) {
        batchStatements.push(
          env.DB.prepare(
            'UPDATE alert_rules SET last_checked_value = ?, last_checked_state = ?, updated_at = (strftime(\'%s\', \'now\')) WHERE id = ?'
          ).bind(currentValue, currentState, rule.id)
        );
      } else {
        // Just update value to stay current
        batchStatements.push(
          env.DB.prepare(
            'UPDATE alert_rules SET last_checked_value = ?, updated_at = (strftime(\'%s\', \'now\')) WHERE id = ?'
          ).bind(currentValue, rule.id)
        );
      }
    }

    // Execute batch writes if there are any
    if (batchStatements.length > 0) {
      await env.DB.batch(batchStatements);
    }

    // 4. Send digest email if alerts triggered
    if (triggeredAlerts.length > 0) {
      await sendAlertsEmail(env, triggeredAlerts);
    }

  } catch (err: any) {
    console.error("Error checking alert rules:", err);
    errors.push(err.message || String(err));
  }

  return { triggeredCount, errors };
}

function getMetricLabel(metric: string): string {
  switch (metric) {
    case 'market_cap': return 'Market Cap';
    case 'price': return 'Price';
    case 'p_e': return 'P/E';
    case 'ev_ebit': return 'EV/EBIT';
    case 'ev_sales': return 'EV/Sales';
    default: return metric;
  }
}

function formatMetricValue(val: number, metric: string): string {
  if (metric === 'price') {
    return `$${val.toFixed(2)}`;
  }
  if (metric === 'market_cap') {
    // Stored in millions in Finnhub (e.g. 1500000 = $1.5T = 1500B)
    return `$${(val / 1000).toFixed(2)}B`;
  }
  return val.toFixed(2);
}

async function sendAlertsEmail(
  env: Env, 
  alerts: { symbol: string; message: string }[]
) {
  console.log(`Alert triggered for ${alerts.length} item(s). Email sending is currently disabled (in-app notification saved).`);
  return;

  let emailHtml = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6; border: 1px solid #e1e8ed; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Oaktree Agent: Alert Notification</h1>
        <p style="color: #e1f5fe; margin: 10px 0 0 0; font-size: 14px; font-style: italic;">Real-time threshold crossover events</p>
      </div>
      <div style="padding: 30px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #4b5563; margin-top: 0;">The following watchlist thresholds have been crossed:</p>
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 20px 0;" />
  `;

  for (const alert of alerts) {
    emailHtml += `
      <div style="background-color: #f9fafb; border-left: 4px solid #10b981; padding: 15px 20px; margin-bottom: 20px; border-radius: 4px;">
        <h3 style="margin: 0 0 5px 0; color: #111827; font-size: 16px; font-weight: 700;">${alert.symbol}</h3>
        <p style="margin: 0; color: #374151; font-size: 14px; font-weight: 500;">${alert.message}</p>
      </div>
    `;
  }

  emailHtml += `
        <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 20px 0;" />
        <p style="font-size: 14px; color: #6b7280; text-align: center; margin-bottom: 0;">You are receiving this because you configured alert thresholds in your watchlist.</p>
      </div>
      <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">Oaktree Agent Intelligence • Cloudflare Workers</p>
      </div>
    </div>
  `;

  try {
    const recipient = env.ALERT_EMAIL || env.DESTINATION_EMAIL || env.EMAIL?.destination_address || 'rattajak.n@gmail.com';
    const { createMimeMessage } = await import('mimetext');
    const msg = createMimeMessage();
    msg.setSender({ name: 'Oaktree Agent', addr: 'agent@oaktree.internal' });
    msg.setRecipient(recipient);
    msg.setSubject(`[Oaktree Alert] Threshold Crossed for ${alerts.map(a => a.symbol).join(', ')}`);
    msg.addMessage({
      contentType: 'text/html',
      data: emailHtml
    });

    await env.EMAIL.send(msg.asRaw());
    console.log("Alert email sent successfully.");
  } catch (error) {
    console.error("Failed to send alert email:", error);
    console.log("Fallback log of Alert Email (HTML):", emailHtml);
  }
}
