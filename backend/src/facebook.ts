import { Env } from './index';

interface FacebookPostRow {
	id: number;
	source_type: 'daily_report' | 'email_digest';
	source_id: number;
	thai_title: string | null;
	thai_content: string | null;
	status: 'pending' | 'processing' | 'posted' | 'failed';
	facebook_post_id: string | null;
	error_message: string | null;
}

export async function queueFacebookPost(env: Env, sourceType: 'daily_report' | 'email_digest', sourceId: number) {
	try {
		await env.DB.prepare(
			'INSERT OR IGNORE INTO facebook_posts (source_type, source_id, status) VALUES (?, ?, ?)'
		).bind(sourceType, sourceId, 'pending').run();
		console.log(`Queued Facebook post for ${sourceType} ID: ${sourceId}`);
	} catch (e) {
		console.error(`Failed to queue Facebook post for ${sourceType} ID: ${sourceId}`, e);
	}
}

export async function processPendingFacebookPosts(env: Env): Promise<number> {
	console.log('Processing pending Facebook posts...');
	
	// 1. Get all pending posts
	const { results: pendingPosts } = await env.DB.prepare(
		"SELECT * FROM facebook_posts WHERE status = 'pending' ORDER BY created_at ASC LIMIT 3"
	).all() as { results: unknown[] };

	const posts = pendingPosts as FacebookPostRow[];
	if (posts.length === 0) {
		console.log('No pending Facebook posts found.');
		return 0;
	}

	console.log(`Found ${posts.length} pending posts to process.`);
	let processedCount = 0;

	for (const post of posts) {
		// Mark as processing to avoid concurrent execution issues
		await env.DB.prepare(
			"UPDATE facebook_posts SET status = 'processing', updated_at = (strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE id = ?"
		).bind(post.id).run();

		try {
			// 2. Fetch original Thai content
			let thaiContent = '';
			let subjectInfo = '';

			if (post.source_type === 'daily_report') {
				const report = await env.DB.prepare(
					'SELECT symbol, summary, key_takeaways FROM daily_reports WHERE id = ?'
				).bind(post.source_id).first() as { symbol: string, summary: string, key_takeaways: string } | null;

				if (!report) {
					throw new Error(`Daily report ID ${post.source_id} not found`);
				}

				const takeaways = JSON.parse(report.key_takeaways || '[]');
				thaiContent = `Stock Symbol: ${report.symbol}\nDaily Summary: ${report.summary}\nKey Takeaways:\n${takeaways.map((t: string) => `- ${t}`).join('\n')}`;
				subjectInfo = `Stock Report: ${report.symbol}`;
			} else if (post.source_type === 'email_digest') {
				const digest = await env.DB.prepare(
					'SELECT category, summary, key_takeaways FROM email_digests WHERE id = ?'
				).bind(post.source_id).first() as { category: string, summary: string, key_takeaways: string } | null;

				if (!digest) {
					throw new Error(`Email digest ID ${post.source_id} not found`);
				}

				const takeaways = JSON.parse(digest.key_takeaways || '[]');
				thaiContent = `Category: ${digest.category}\nDigest Summary: ${digest.summary}\nKey Takeaways:\n${takeaways.map((t: string) => `- ${t}`).join('\n')}`;
				subjectInfo = `Market Digest: ${digest.category}`;
			} else {
				throw new Error(`Invalid source_type: ${post.source_type}`);
			}

			// 3. Format and style Thai content for Facebook using Workers AI
			console.log(`Formatting and styling Facebook post for Thai: ${subjectInfo}`);
			const thaiPost = await formatAndStyleFacebookPost(env, thaiContent, post.source_type);

			if (!thaiPost) {
				throw new Error('AI failed to generate Thai translation content');
			}

			// 4. Publish to Facebook Graph API
			if (!env.FACEBOOK_PAGE_ID || !env.FACEBOOK_PAGE_ACCESS_TOKEN) {
				console.warn('FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN is not configured. Skipping Graph API call.');
				// Update database with the translation so user can see it, set as failed due to configuration
				await env.DB.prepare(
					"UPDATE facebook_posts SET thai_content = ?, status = 'failed', error_message = 'Facebook credentials missing', updated_at = (strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE id = ?"
				).bind(thaiPost, post.id).run();
				continue;
			}

			console.log(`Publishing post to Facebook Page: ${env.FACEBOOK_PAGE_ID}`);
			const fbResponse = await fetch(`https://graph.facebook.com/v20.0/${env.FACEBOOK_PAGE_ID}/feed`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					message: thaiPost,
					access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN,
				}),
			});

			const fbResult = await fbResponse.json() as any;

			if (!fbResponse.ok || fbResult.error) {
				const errorMsg = fbResult.error?.message || JSON.stringify(fbResult);
				throw new Error(`Facebook API error: ${errorMsg}`);
			}

			const facebookPostId = fbResult.id;
			console.log(`Successfully posted to Facebook. Post ID: ${facebookPostId}`);

			// 5. Update database status
			await env.DB.prepare(
				"UPDATE facebook_posts SET thai_content = ?, status = 'posted', facebook_post_id = ?, updated_at = (strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE id = ?"
			).bind(thaiPost, facebookPostId, post.id).run();

			processedCount++;

			// Sleep for 2 seconds to space out requests and posts slightly
			await new Promise(resolve => setTimeout(resolve, 2000));

		} catch (err: any) {
			console.error(`Error processing Facebook post ID ${post.id}:`, err);
			await env.DB.prepare(
				"UPDATE facebook_posts SET status = 'failed', error_message = ?, updated_at = (strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE id = ?"
			).bind(err.message || 'Unknown error', post.id).run();
		}
	}

	return processedCount;
}

export async function syncAndProcessFacebookPosts(env: Env): Promise<number> {
	console.log('Syncing and processing Facebook posts...');
	
	try {
		// 1. Discover and queue new daily reports from the last 24h
		await env.DB.prepare(`
			INSERT OR IGNORE INTO facebook_posts (source_type, source_id, status)
			SELECT 'daily_report', id, 'pending'
			FROM daily_reports
			WHERE created_at > datetime('now', '-1 day')
			  AND id NOT IN (SELECT source_id FROM facebook_posts WHERE source_type = 'daily_report')
		`).run();

		// 2. Discover and queue new email digests from the last 24h
		await env.DB.prepare(`
			INSERT OR IGNORE INTO facebook_posts (source_type, source_id, status)
			SELECT 'email_digest', id, 'pending'
			FROM email_digests
			WHERE created_at > datetime('now', '-1 day')
			  AND id NOT IN (SELECT source_id FROM facebook_posts WHERE source_type = 'email_digest')
		`).run();

	} catch (e) {
		console.error('Failed to sync new daily reports/digests into facebook_posts queue:', e);
	}

	// 3. Process the queue
	return await processPendingFacebookPosts(env);
}

async function formatAndStyleFacebookPost(env: Env, content: string, type: 'daily_report' | 'email_digest'): Promise<string> {
	const systemPrompt = `
You are the Oaktree Agent, a premium financial analyst preparing investment intelligence for a Thai audience on Facebook.
Your job is to format and rewrite the Thai report content into a premium, engaging Facebook post.

TONE & STYLE RULES:
- Write in the style of a Howard Marks Memo (thoughtful, focus on cycles, risk awareness, and market psychology, cautious yet clear).
- Keep it highly professional yet readable and engaging for a social media audience.
- Use clear spacing, bold headings (without markdown if possible, or use standard emojis for headings), and clean bullet points.
- Use subtle, professional emojis (e.g. 📊, 🔑, 💡, ⚠️, 🔍, 📌) to separate sections and highlight key points.
- End the post with relevant hashtags (e.g. #OaktreeAgent #วิเคราะห์การลงทุน #จิตวิทยาการลงทุน) and any relevant stock symbol.
- CRITICAL HASHTAG RULE: Do NOT use or allow any hashtags that refer to investor names (e.g. do NOT use #HowardMarks, #Marks, #Howard, #Buffett, #Munger, etc.).
- Output ONLY the final Thai Facebook post message content. Do not include any introductory meta text or markdown code block surrounds.
`;

	const userPrompt = `
Format and polish the following Thai content for Facebook:
---
${content}
---
`;

	try {
		const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			max_tokens: 4096,
		} as any);

		const responseText = (response as any).choices?.[0]?.message?.content || response.response || "";
		return responseText.trim();
	} catch (e) {
		console.error('Workers AI formatting failed, trying fallback prompt style:', e);
		// Simple fallback in case system prompt isn't supported by the model structure
		const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [
				{ role: 'user', content: `${systemPrompt}\n\nContent to format:\n${content}` }
			],
			max_tokens: 4096,
		} as any);
		
		const responseText = (response as any).choices?.[0]?.message?.content || response.response || "";
		return responseText.trim();
	}
}
