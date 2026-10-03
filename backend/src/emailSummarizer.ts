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

async function runAiDigestWithRetry(env: Env, prompt: string, maxRetries = 2): Promise<any> {
  const modelsToTry = [
    env.default_ai_model,
    env.facebook_summarize_model
  ].filter(Boolean);

  let lastError: any;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const response = await env.AI.run(model, {
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 4096,
          max_completion_tokens: 4096,
          response_format: {
            type: 'json_object'
          }
        } as any);

        return response;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Workers AI] Attempt ${attempt + 1} failed for ${model}:`, err?.message || err);
      }
    }
  }

  throw lastError;
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

      const response = await runAiDigestWithRetry(env, prompt);

      let responseText = (response as any).choices?.[0]?.message?.content || response.response || "";
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
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

        const digests = data.digests || [];
        console.log(`AI generated ${digests.length} digest(s) for email ID: ${email.id}`);

        const hasGibberish = digests.some((d: any) =>
          isGibberishThai(d.summary) ||
          (Array.isArray(d.key_takeaways) && d.key_takeaways.some(isGibberishThai))
        );

        if (hasGibberish) {
          throw new Error(`AI generated corrupted/gibberish Thai text for email ID: ${email.id}`);
        }

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
        console.error(`No JSON structure found in AI response for email ID: ${email.id}`);
        console.error('Raw responseText:', responseText);
        console.error('Raw response object:', JSON.stringify(response));

        // Mark as failed (processed = -1) so unparseable AI responses do not block the FIFO queue forever
        await env.DB.prepare(
          'UPDATE ingested_emails SET processed = -1 WHERE id = ?'
        ).bind(email.id).run();
        console.warn(`[EmailDigest] Marked email ID: ${email.id} as failed (processed = -1) due to invalid AI response format.`);
      }
    } catch (emailError) {
      console.error(`Error processing email ID: ${email.id}:`, emailError);

      // Mark as failed (processed = -1) so persistent AI errors do not block subsequent emails in the FIFO queue forever
      try {
        await env.DB.prepare(
          'UPDATE ingested_emails SET processed = -1 WHERE id = ?'
        ).bind(email.id).run();
        console.warn(`[EmailDigest] Marked poison-pill email ID: ${email.id} as failed (processed = -1) after all AI retries to unblock queue.`);
      } catch (dbErr) {
        console.error(`Failed to mark email ID: ${email.id} as failed in DB:`, dbErr);
      }
    }
  }
}


