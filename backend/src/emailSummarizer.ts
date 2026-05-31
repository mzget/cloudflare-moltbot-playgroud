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

export async function syncAndIngestEmails(env: Env): Promise<number> {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('Google client credentials are not configured. Skipping email sync.');
    return 0;
  }

  const accessToken = await getOrRefreshAccessToken(env.DB, clientId, clientSecret);
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
      query = `${sub.raw_query} is:unread`;
    } else {
      const parts = [];
      if (sub.sender) parts.push(`from:${sub.sender}`);
      if (sub.subject_filter) parts.push(`subject:(${sub.subject_filter})`);
      if (sub.label_filter) parts.push(`label:${sub.label_filter}`);
      if (parts.length > 0) {
        parts.push('is:unread');
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
          receivedAt
        ).run();

        totalNewEmails++;
      }
    } catch (e) {
      console.error(`Failed to ingest emails for subscription ${sub.name}:`, e);
    }
  }

  return totalNewEmails;
}

export async function generateEmailDigests(env: Env, isManual = false): Promise<void> {
  // Check active subscriptions to see which are due
  const { results: activeSubs } = await env.DB.prepare(
    'SELECT * FROM email_subscriptions WHERE is_active = 1'
  ).all() as { results: any[] };

  if (activeSubs.length === 0) {
    console.log('No active email subscriptions found.');
    return;
  }

  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDay();

  const dueSubIds = activeSubs
    .filter(sub => {
      if (isManual) return true;
      if (sub.frequency === 'hourly') return true;
      if (sub.frequency === 'daily' && currentHour === 6) return true; // Daily check at 6:00 UTC
      if (sub.frequency === 'weekly' && currentDay === 0 && currentHour === 6) return true; // Weekly check Sunday 6:00 UTC
      return false;
    })
    .map(sub => sub.id);

  if (dueSubIds.length === 0) {
    console.log('No email subscriptions are due for summarization in this hour.');
    return;
  }

  // Fetch unprocessed emails for due subscriptions
  const placeholders = dueSubIds.map(() => '?').join(',');
  const { results: emails } = await env.DB.prepare(
    `SELECT * FROM ingested_emails WHERE processed = 0 AND subscription_id IN (${placeholders}) ORDER BY received_at ASC`
  ).bind(...dueSubIds).all() as { results: any[] };

  if (emails.length === 0) {
    console.log('No unprocessed emails found for the due subscriptions.');
    return;
  }

  console.log(`Processing and summarizing ${emails.length} ingested emails for due subscriptions in batches...`);

  const BATCH_SIZE = 3;
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(emails.length / BATCH_SIZE)} (${batch.length} emails)...`);

    try {
      // Prepare LLM prompt with batch email contents, truncating body_text to 3000 characters on-the-fly
      const context = batch.map((e, index) => {
        const bodyText = e.body_text || '';
        const truncatedBody = bodyText.length > 3000 ? bodyText.slice(0, 3000) + '... [truncated]' : bodyText;
        return `--- EMAIL ${index + 1} ---
ID: ${e.id}
Sender: ${e.sender}
Subject: ${e.subject}
Date: ${new Date(e.received_at).toISOString()}
Content: ${truncatedBody}
----------------------`;
      }).join('\n\n');

      const prompt = `
You are the Oaktree Agent, a world-class financial analyst and investment strategist, writing in the style of Howard Marks.
Analyze the following email newsletter content. Your goal is to:
1. Extract the main financial, market, or macroeconomic stories/news items discussed in these emails.
2. Group them into distinct thematic categories (e.g. 'Macroeconomy', 'Technology & AI', 'Corporate Earnings', 'Geopolitics', 'Crypto & Digital Assets').
3. For each category group, write a cohesive, professional Howard Marks-style summary (insightful, focusing on long-term risk and market cycles) that synthesizes the stories in that category.
4. Provide a list of key takeaways (bullet points) for each category.
5. Identify which email IDs are associated with each digest category (source_emails).

RESPONSE INSTRUCTIONS:
- Return ONLY a JSON object.
- DO NOT include any markdown code blocks, comments, or introductory text.
- Ensure the JSON is strictly valid.
- CRITICAL: Do NOT use double quotes (") inside any JSON string values (like 'summary' or 'key_takeaways'). Instead, use single quotes (') for any internal quotes or speech marks.
  Example: "summary": "Howard Marks' 'most important thing' concept" (valid)
  Example: "summary": "Howard Marks' "most important thing" concept" (INVALID)

JSON Schema:
{
  "digests": [
    {
      "category": "Macroeconomy",
      "summary": "Detailed, Howard Marks style analysis synthesizing the macroeconomic news...",
      "key_takeaways": ["Point 1", "Point 2"],
      "source_emails": ["email_id_1", "email_id_2"]
    }
  ]
}

Emails content:
${context}
`;

      const response = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
        prompt,
        response_format: {
          type: 'json_object'
        }
      } as any);

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

        console.log(`AI generated ${digests.length} digest categories for this batch.`);

        for (const digest of digests) {
          // Map source email IDs back to objects containing subject, sender, received_at from the batch
          const rawSources = digest.source_emails || [];
          const mappedSources = rawSources.map((idOrObj: any) => {
            const emailId = typeof idOrObj === 'object' && idOrObj !== null ? idOrObj.id : idOrObj;
            const originalEmail = batch.find(e => e.id === emailId);
            if (originalEmail) {
              return {
                id: originalEmail.id,
                subject: originalEmail.subject,
                sender: originalEmail.sender,
                received_at: originalEmail.received_at
              };
            }
            // Fallback in case the model returned an object structure directly or didn't find the email in the batch
            return typeof idOrObj === 'object' && idOrObj !== null ? idOrObj : { id: idOrObj };
          });

          await env.DB.prepare(
            'INSERT INTO email_digests (category, summary, key_takeaways, source_emails) VALUES (?, ?, ?, ?)'
          ).bind(
            digest.category,
            digest.summary,
            JSON.stringify(digest.key_takeaways || []),
            JSON.stringify(mappedSources)
          ).run();
        }

        // Mark only this batch of emails as processed
        const emailIds = batch.map(e => e.id);
        const updatePlaceholders = emailIds.map(() => '?').join(',');
        await env.DB.prepare(
          `UPDATE ingested_emails SET processed = 1 WHERE id IN (${updatePlaceholders})`
        ).bind(...emailIds).run();

        console.log(`Successfully completed email summarization for batch email IDs: ${emailIds.join(', ')}`);
      } else {
        console.error('No JSON structure found in AI response for email digests in this batch.');
        console.error('Raw responseText:', responseText);
        console.error('Raw response object:', JSON.stringify(response));
      }
    } catch (batchError) {
      console.error('Error processing email digest batch:', batchError);
    }
  }
}
