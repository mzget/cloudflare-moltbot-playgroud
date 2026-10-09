// backend/src/emailSummarizer.ts
import { D1Database } from '@cloudflare/workers-types';
import { Env } from './index';
import {
  getOrRefreshAccessToken,
  fetchGmailMessages,
  fetchGmailMessageDetail,
  parseEmailBody,
  getHeader
} from './gmail';

function cleanEmailBody(body: string): string {
  if (!body) return '';
  // Remove style tags and contents
  let cleaned = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Remove script tags and contents
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  // Replace multiple spaces/newlines
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned.trim();
}

export function isGibberishThai(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  // 1. Invalid Thai orthography: Mai Han-Akat (\u0E31) directly followed by Sara Aa (\u0E32)
  if (/[\u0E31][\u0E32]/.test(text)) {
    return true;
  }

  // 2. Impossible vowel stacking: three or more upper/lower vowels or tone marks consecutively
  if (/[\u0E31\u0E34-\u0E37\u0E47-\u0E4E]{3,}/.test(text)) {
    return true;
  }

  // 3. Repeated 3+ character patterns (autoregressive looping tokens repeating 4+ times)
  const repeatedPattern = /(.{3,8})\1{3,}/;
  if (repeatedPattern.test(text)) {
    return true;
  }

  return false;
}

export async function syncAndIngestEmails(env: Env): Promise<number> {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('Google client credentials are not configured. Skipping email sync.');
    return 0;
  }

  try {
    const jwtSecret = env.JWT_SECRET || 'dev-secret-key-123456';
    const accessToken = await getOrRefreshAccessToken(env.DB, clientId, clientSecret, jwtSecret);
    if (!accessToken) {
      console.warn('Gmail not connected. Please authenticate via OAuth.');
      return 0;
    }

    // Fetch active subscriptions
    const { results: subscriptions } = await env.DB.prepare(
      'SELECT * FROM email_subscriptions WHERE is_active = 1'
    ).all() as { results: any[] };

    let totalNewEmails = 0;

    for (const sub of subscriptions) {
      // Determine the query
      let query = '';
      if (sub.raw_query) {
        query = sub.raw_query.trim();
      } else {
        const parts = [];
        if (sub.sender) parts.push(`from:${sub.sender}`);
        if (sub.subject_filter) parts.push(`subject:(${sub.subject_filter})`);
        if (sub.label_filter) parts.push(`label:${sub.label_filter}`);
        if (parts.length > 0) {
          parts.push('newer_than:2d');
          query = parts.join(' ');
        }
      }

      if (!query) continue;

      console.log(`Polling Gmail for subscription "${sub.name}" with query: "${query}"`);
      try {
        const messages = await fetchGmailMessages(accessToken, query);
        
        for (const msgSummary of messages) {
          // Check if already ingested
          const exists = await env.DB.prepare(
            'SELECT 1 FROM ingested_emails WHERE id = ?'
          ).bind(msgSummary.id).first();

          if (exists) continue;

          // Fetch detail
          console.log(`Ingesting new email message ID: ${msgSummary.id}`);
          const detail = await fetchGmailMessageDetail(accessToken, msgSummary.id);
          const headers = detail.payload.headers || [];
          const subject = getHeader(headers, 'subject') || 'No Subject';
          const sender = getHeader(headers, 'from') || 'Unknown Sender';
          const receivedAt = parseInt(detail.internalDate) || Date.now();
          const receivedAtIso = new Date(receivedAt).toISOString();
          const rawBody = parseEmailBody(detail.payload);
          const cleanedBody = cleanEmailBody(rawBody);

          await env.DB.prepare(
            'INSERT INTO ingested_emails (id, subscription_id, sender, subject, body_text, received_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(
            msgSummary.id,
            sub.id,
            sender,
            subject,
            cleanedBody,
            receivedAtIso
          ).run();

          totalNewEmails++;
        }
      } catch (e) {
        console.error(`Failed to ingest emails for subscription ${sub.name}:`, e);
      }
    }

    return totalNewEmails;
  } catch (e) {
    console.error('syncAndIngestEmails encountered an unexpected error:', e);
    return 0;
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseAndValidateDigests(responseText: string, emailId: string): any[] {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON structure found in AI response for email ID: ${emailId}`);
  }

  let data: any;
  try {
    data = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    // Attempt parsing again by escaping raw newlines in string literals
    let inString = false;
    let escape = false;
    let cleaned = '';
    const rawJson = jsonMatch[0];
    for (let k = 0; k < rawJson.length; k++) {
      const char = rawJson[k];
      if (char === '"' && !escape) {
        inString = !inString;
        cleaned += char;
      } else if (char === '\\' && inString) {
        escape = !escape;
        cleaned += char;
      } else {
        if (inString && (char === '\n' || char === '\r')) {
          if (char === '\n') {
            cleaned += '\\n';
          } else if (char === '\r') {
            if (rawJson[k + 1] === '\n') {
              // handled by next character
            } else {
              cleaned += '\\n';
            }
          }
        } else {
          cleaned += char;
        }
        escape = false;
      }
    }
    data = JSON.parse(cleaned);
  }

  const digests = data?.digests || [];
  if (!Array.isArray(digests) || digests.length === 0) {
    throw new Error(`AI response does not contain valid digests array for email ID: ${emailId}`);
  }

  const hasGibberish = digests.some((d: any) =>
    isGibberishThai(d.summary) ||
    (Array.isArray(d.key_takeaways) && d.key_takeaways.some(isGibberishThai))
  );

  if (hasGibberish) {
    throw new Error(`AI generated corrupted/gibberish Thai text for email ID: ${emailId}`);
  }

  return digests;
}

export async function sendDigestFailureAlert(
  env: Env,
  email: { id: string; subject?: string; sender?: string },
  errors: string[]
): Promise<void> {
  const recipient = env.ALERT_EMAIL || env.DESTINATION_EMAIL || env.EMAIL?.destination_address || 'rattajak.n@gmail.com';
  if (!env.EMAIL || !recipient) {
    console.warn('[EmailDigest] Cannot send failure alert email: env.EMAIL or recipient not configured.');
    return;
  }

  try {
    const { createMimeMessage } = await import('mimetext');
    const msg = createMimeMessage();
    msg.setSender({ name: 'Oaktree Agent', addr: 'agent@oaktree.internal' });
    msg.setRecipient(recipient);
    msg.setSubject(`[Oaktree Alert] Email Digest Failed: ${email.subject || email.id}`);

    const errorDetails = (errors && errors.length > 0)
      ? errors.map((err, idx) => `<li><strong>${idx === 0 ? 'Primary' : 'Fallback'}:</strong> ${escapeHtml(err)}</li>`).join('')
      : '<li>Unknown error</li>';

    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6; border: 1px solid #e1e8ed; border-radius: 8px; padding: 24px;">
        <h2 style="color: #e74c3c; margin-top: 0;">⚠️ Email Digest Generation Failed</h2>
        <p>Both primary and fallback AI models failed to summarize the following email newsletter:</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 6px 0; font-weight: bold; width: 100px;">Subject:</td><td>${escapeHtml(email.subject || 'N/A')}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Sender:</td><td>${escapeHtml(email.sender || 'N/A')}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Email ID:</td><td><code>${escapeHtml(email.id)}</code></td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Timestamp:</td><td>${new Date().toISOString()}</td></tr>
        </table>
        <h3 style="color: #4b5563; font-size: 16px;">Failure Details:</h3>
        <ul style="background: #f8f9fa; padding: 16px 24px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #c0392b;">
          ${errorDetails}
        </ul>
        <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">The email has been marked with status <code>processed = -1</code> to avoid blocking the queue. You can review or reprocess it via the Oaktree Agent dashboard.</p>
      </div>
    `;

    msg.addMessage({
      contentType: 'text/html',
      data: emailHtml
    });

    await env.EMAIL.send(msg.asRaw());
    console.log(`[EmailDigest] Alert email sent to ${recipient} for email ID: ${email.id}`);
  } catch (err) {
    console.error(`[EmailDigest] Failed to send failure alert email for ID: ${email.id}:`, err);
  }
}

export async function generateDigestWithFallback(
  env: Env,
  prompt: string,
  emailId: string
): Promise<{ digests: any[]; errors: string[] }> {
  const models = [env.default_ai_model, env.facebook_summarize_model].filter(Boolean);
  const errors: string[] = [];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const isPrimary = i === 0;
    try {
      console.log(`[EmailDigest] Attempting ${isPrimary ? 'primary' : 'fallback'} model: ${model}`);
      const response = await env.AI.run(model, {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        max_completion_tokens: 4096,
        response_format: { type: 'json_object' }
      } as any);

      const responseText = (response as any).choices?.[0]?.message?.content || (response as any).response || '';
      const digests = parseAndValidateDigests(responseText, emailId);
      console.log(`[EmailDigest] Successfully generated ${digests.length} digest(s) with model: ${model}`);
      return { digests, errors };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      errors.push(`${model}: ${errMsg}`);
      if (isPrimary && models.length > 1) {
        console.warn(`[EmailDigest] Primary model ${model} failed: ${errMsg}. Switching immediately to fallback model without retry.`);
      } else {
        console.error(`[EmailDigest] Model ${model} failed: ${errMsg}`);
      }
    }
  }

  return { digests: [], errors };
}

export async function generateEmailDigests(env: Env, isManual = false): Promise<void> {
  // Check active subscriptions
  const { results: activeSubs } = await env.DB.prepare(
    'SELECT id FROM email_subscriptions WHERE is_active = 1'
  ).all() as { results: any[] };

  if (!activeSubs || activeSubs.length === 0) {
    console.log('No active email subscriptions found.');
    return;
  }

  const activeSubIds = activeSubs.map(sub => sub.id);
  const placeholders = activeSubIds.map(() => '?').join(',');

  // Fetch the oldest unprocessed email (FIFO, Limit 1 per cycle for quality preservation)
  const { results: emails } = await env.DB.prepare(
    `SELECT * FROM ingested_emails WHERE processed = 0 AND subscription_id IN (${placeholders}) ORDER BY received_at ASC LIMIT 1`
  ).bind(...activeSubIds).all() as { results: any[] };

  if (!emails || emails.length === 0) {
    console.log('No unprocessed emails found in queue.');
    return;
  }

  console.log(`Processing and summarizing 1 ingested email from queue (ID: ${emails[0].id} — Subject: ${emails[0].subject})...`);

  for (const email of emails) {
    console.log(`Processing email ID: ${email.id} — Subject: ${email.subject}`);

    try {
      const bodyText = email.body_text || '';
      const truncatedBody = bodyText.length > 10000 ? bodyText.slice(0, 10000) + '... [truncated]' : bodyText;

      const emailContext = `--- EMAIL ---
ID: ${email.id}
Sender: ${email.sender}
Subject: ${email.subject}
Date: ${new Date(email.received_at).toISOString()}
Content: ${truncatedBody}
----------------------`;

      const prompt = `
You are the Oaktree Agent, a financial analyst summarizing a newsletter email for a Thai-speaking investor.
Analyze the following single email newsletter. Produce a JSON response with TWO distinct sections:

SECTION 1 — COMPREHENSIVE CONTENT SUMMARY:
- Identify the thematic category of this email (e.g. 'Macroeconomy', 'Technology & AI', 'Corporate Earnings', 'Geopolitics', 'Crypto & Digital Assets'). Keep category name in English.
- Write a thorough "summary" IN THAI that covers EVERY major point, story, argument, and data point mentioned in the email. Do not omit anything important. The reader must be able to fully understand what was discussed without reading the original email (2 to 3 paragraphs, 8 to 12 sentences).

SECTION 2 — HOWARD MARKS STYLE COMMENTARY:
- Provide 4 to 6 "key_takeaways" IN THAI written in Howard Marks' memo style: nuanced, cycle-aware, risk-focused, contrarian when warranted, and long-term in perspective. Each takeaway should offer a genuine investment insight or caution derived from the email content.

RESPONSE INSTRUCTIONS:
- Return ONLY a JSON object with a single "digests" array containing exactly one object.
- The "summary" and "key_takeaways" fields MUST be written in Thai language.
- CRITICAL: Keep your internal reasoning/thinking very short (under 50 words) so you do not run out of token space.
- DO NOT include any markdown code blocks, comments, or introductory text.
- Ensure the JSON is strictly valid.
- CRITICAL: Do NOT use double quotes (") inside any JSON string values. Use single quotes (') for any internal quotes.

JSON Schema:
{
  "digests": [
    {
      "category": "Category name in English",
      "summary": "Comprehensive content summary in Thai covering every key point...",
      "key_takeaways": ["Howard Marks-style insight 1 in Thai", "Howard Marks-style insight 2 in Thai"],
      "source_emails": ["${email.id}"]
    }
  ]
}

Email content:
${emailContext}
`;

      const { digests, errors } = await generateDigestWithFallback(env, prompt, email.id);

      if (digests.length > 0) {
        for (const digest of digests) {
          // Source is always the current email being processed
          const mappedSources = [{
            id: email.id,
            subject: email.subject,
            sender: email.sender,
            received_at: email.received_at
          }];

          await env.DB.prepare(
            'INSERT INTO email_digests (category, summary, key_takeaways, source_emails, is_readed) VALUES (?, ?, ?, ?, 0)'
          ).bind(
            digest.category,
            digest.summary,
            JSON.stringify(digest.key_takeaways || []),
            JSON.stringify(mappedSources)
          ).run();
        }

        // Mark this email as processed
        await env.DB.prepare(
          'UPDATE ingested_emails SET processed = 1 WHERE id = ?'
        ).bind(email.id).run();

        console.log(`Successfully processed email ID: ${email.id}`);
      } else {
        console.error(`Both primary and fallback models failed for email ID: ${email.id}. Errors: ${errors.join(' | ')}`);

        // Mark as failed (processed = -1) so persistent AI errors do not block subsequent emails in the FIFO queue forever
        await env.DB.prepare(
          'UPDATE ingested_emails SET processed = -1 WHERE id = ?'
        ).bind(email.id).run();
        console.warn(`[EmailDigest] Marked poison-pill email ID: ${email.id} as failed (processed = -1) after all models failed.`);

        // Send alert email to ALERT_EMAIL
        await sendDigestFailureAlert(env, email, errors);
      }
    } catch (emailError: any) {
      console.error(`Error processing email ID: ${email.id}:`, emailError);

      try {
        await env.DB.prepare(
          'UPDATE ingested_emails SET processed = -1 WHERE id = ?'
        ).bind(email.id).run();
        console.warn(`[EmailDigest] Marked poison-pill email ID: ${email.id} as failed (processed = -1) due to unexpected error.`);
      } catch (dbErr) {
        console.error(`Failed to mark email ID: ${email.id} as failed in DB:`, dbErr);
      }

      await sendDigestFailureAlert(env, email, [emailError?.message || String(emailError)]);
    }
  }
}


