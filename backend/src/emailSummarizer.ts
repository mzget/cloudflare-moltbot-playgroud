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
  // Limit size per email to save context window
  if (cleaned.length > 8000) {
    cleaned = cleaned.slice(0, 8000) + '... [content truncated]';
  }
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
      query = sub.raw_query;
    } else {
      const parts = [];
      if (sub.sender) parts.push(`from:${sub.sender}`);
      if (sub.subject_filter) parts.push(`subject:(${sub.subject_filter})`);
      if (sub.label_filter) parts.push(`label:${sub.label_filter}`);
      query = parts.join(' ');
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

  console.log(`Processing and summarizing ${emails.length} ingested emails for due subscriptions...`);

  // Prepare LLM prompt with all raw email contents
  const context = emails.map((e, index) => {
    return `--- EMAIL ${index + 1} ---
ID: ${e.id}
Sender: ${e.sender}
Subject: ${e.subject}
Date: ${new Date(e.received_at).toISOString()}
Content: ${e.body_text}
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

JSON Schema:
{
  "digests": [
    {
      "category": "Macroeconomy",
      "summary": "Detailed, Howard Marks style analysis synthesizing the macroeconomic news...",
      "key_takeaways": ["Point 1", "Point 2"],
      "source_emails": [
        { "id": "email_id_from_header", "subject": "email_subject", "sender": "email_sender" }
      ]
    }
  ]
}

Emails content:
${context}
`;

  try {
    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      prompt,
    });

    let responseText = response.response || "";
    // Clean up LLM syntax artifacts
    responseText = responseText.replace(/\/\/.*$/gm, "");
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      const digests = data.digests || [];

      console.log(`AI generated ${digests.length} digest categories.`);

      for (const digest of digests) {
        await env.DB.prepare(
          'INSERT INTO email_digests (category, summary, key_takeaways, source_emails) VALUES (?, ?, ?, ?)'
        ).bind(
          digest.category,
          digest.summary,
          JSON.stringify(digest.key_takeaways || []),
          JSON.stringify(digest.source_emails || [])
        ).run();
      }

      // Mark all these emails as processed
      const emailIds = emails.map(e => e.id);
      const updatePlaceholders = emailIds.map(() => '?').join(',');
      await env.DB.prepare(
        `UPDATE ingested_emails SET processed = 1 WHERE id IN (${updatePlaceholders})`
      ).bind(...emailIds).run();

      console.log(`Successfully completed email summarization for IDs: ${emailIds.join(', ')}`);
    } else {
      console.error('No JSON structure found in AI response for email digests.');
      console.debug('Raw response:', responseText);
    }
  } catch (error) {
    console.error('Error generating email digests:', error);
  }
}
