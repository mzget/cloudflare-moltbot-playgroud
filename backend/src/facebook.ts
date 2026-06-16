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
	
	// Check pause settings
	let dailyReportPaused = false;
	let emailDigestPaused = false;
	try {
		const dailyRow = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'pause_daily_report_facebook'").first() as { value: string } | null;
		const emailRow = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'pause_email_digest_facebook'").first() as { value: string } | null;
		dailyReportPaused = dailyRow?.value === '1';
		emailDigestPaused = emailRow?.value === '1';
	} catch (e) {
		console.warn('Failed to fetch Facebook pause settings in processPendingFacebookPosts, defaulting to unpaused:', e);
	}

	// 1. Get all pending posts, filtering out paused types
	let query = "SELECT * FROM facebook_posts WHERE status = 'pending'";
	const conditions: string[] = [];
	if (dailyReportPaused) {
		conditions.push("source_type != 'daily_report'");
	}
	if (emailDigestPaused) {
		conditions.push("source_type != 'email_digest'");
	}
	if (conditions.length > 0) {
		query += " AND " + conditions.join(" AND ");
	}
	query += " ORDER BY created_at ASC LIMIT 3";

	const { results: pendingPosts } = await env.DB.prepare(query).all() as { results: unknown[] };

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
			let summary = '';
			let takeaways: string[] = [];
			let symbolOrCategory = '';
			let subjectInfo = '';

			if (post.source_type === 'daily_report') {
				const report = await env.DB.prepare(
					'SELECT symbol, summary, key_takeaways FROM daily_reports WHERE id = ?'
				).bind(post.source_id).first() as { symbol: string, summary: string, key_takeaways: string } | null;

				if (!report) {
					throw new Error(`Daily report ID ${post.source_id} not found`);
				}

				takeaways = JSON.parse(report.key_takeaways || '[]');
				summary = report.summary;
				symbolOrCategory = report.symbol;
				subjectInfo = `Stock Report: ${report.symbol}`;
			} else if (post.source_type === 'email_digest') {
				const digest = await env.DB.prepare(
					'SELECT category, summary, key_takeaways FROM email_digests WHERE id = ?'
				).bind(post.source_id).first() as { category: string, summary: string, key_takeaways: string } | null;

				if (!digest) {
					throw new Error(`Email digest ID ${post.source_id} not found`);
				}

				takeaways = JSON.parse(digest.key_takeaways || '[]');
				summary = digest.summary;
				symbolOrCategory = digest.category;
				subjectInfo = `Market Digest: ${digest.category}`;
			} else {
				throw new Error(`Invalid source_type: ${post.source_type}`);
			}

			// 3. Format and style Thai content for Facebook using Workers AI
			console.log(`Formatting and styling Facebook post for Thai: ${subjectInfo}`);
			const thaiPost = await formatAndStyleFacebookPost(env, {
				type: post.source_type,
				symbolOrCategory,
				summary,
				takeaways,
			});

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
			const isPurgedError = err.message && err.message.includes('not found') && (err.message.includes('Daily report') || err.message.includes('Email digest'));
			if (isPurgedError) {
				console.warn(`Facebook post ID ${post.id} source was purged: ${err.message}`);
			} else {
				console.error(`Error processing Facebook post ID ${post.id}:`, err);
			}
			await env.DB.prepare(
				"UPDATE facebook_posts SET status = 'failed', error_message = ?, updated_at = (strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE id = ?"
			).bind(err.message || 'Unknown error', post.id).run();
		}
	}

	return processedCount;
}

export async function syncAndProcessFacebookPosts(env: Env): Promise<number> {
	console.log('Syncing and processing Facebook posts...');
	
	// Check pause settings
	let dailyReportPaused = false;
	let emailDigestPaused = false;
	try {
		// Ensure system_settings table exists
		await env.DB.prepare(`
			CREATE TABLE IF NOT EXISTS system_settings (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			)
		`).run();

		const dailyRow = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'pause_daily_report_facebook'").first() as { value: string } | null;
		const emailRow = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'pause_email_digest_facebook'").first() as { value: string } | null;
		dailyReportPaused = dailyRow?.value === '1';
		emailDigestPaused = emailRow?.value === '1';
	} catch (e) {
		console.warn('Failed to fetch Facebook pause settings in syncAndProcessFacebookPosts, defaulting to unpaused:', e);
	}

	try {
		// 1. Discover and queue new daily reports from the last 24h
		if (!dailyReportPaused) {
			await env.DB.prepare(`
				INSERT OR IGNORE INTO facebook_posts (source_type, source_id, status)
				SELECT 'daily_report', id, 'pending'
				FROM daily_reports
				WHERE created_at > datetime('now', '-1 day')
				  AND id NOT IN (SELECT source_id FROM facebook_posts WHERE source_type = 'daily_report')
			`).run();
		} else {
			console.log('Facebook posting for daily reports is paused. Skipping discovery.');
		}

		// 2. Discover and queue new email digests from the last 24h
		if (!emailDigestPaused) {
			await env.DB.prepare(`
				INSERT OR IGNORE INTO facebook_posts (source_type, source_id, status)
				SELECT 'email_digest', id, 'pending'
				FROM email_digests
				WHERE created_at > datetime('now', '-1 day')
				  AND id NOT IN (SELECT source_id FROM facebook_posts WHERE source_type = 'email_digest')
			`).run();
		} else {
			console.log('Facebook posting for email digests is paused. Skipping discovery.');
		}

	} catch (e) {
		console.error('Failed to sync new daily reports/digests into facebook_posts queue:', e);
	}

	// 3. Process the queue
	return await processPendingFacebookPosts(env);
}

async function formatAndStyleFacebookPost(
	env: Env, 
	params: {
		type: 'daily_report' | 'email_digest';
		symbolOrCategory: string;
		summary: string;
		takeaways: string[];
	}
): Promise<string> {
	const { type, symbolOrCategory, summary, takeaways } = params;

	// Build context for LLM
	const contextContent = `
Symbol/Category: ${symbolOrCategory}
Summary: ${summary}
Key Takeaways:
${takeaways.map((t: string) => `- ${t}`).join('\n')}
`;

	const systemPrompt = `
You are the Oaktree Agent, a premium financial analyst preparing investment intelligence.
Your task is to write a short 2-3 sentence commentary (an "Oaktree Memo") in Thai based on the provided report details.

COMMENTARY STYLE & RULES:
- Write in the philosophical style of Howard Marks' memos: focus on risk awareness, market cycles, second-level thinking, and long-term perspective.
- Keep it concise: exactly 2 to 3 sentences in Thai.
- Wrap the generated commentary in double quotes (e.g. "...").
- Do NOT add any introductory text, explanation, meta-labels, or other markdown sections. Output ONLY the commentary text itself.
- Do NOT use or allow any hashtags that refer to investor names (e.g., do NOT use #HowardMarks, #Marks, #Howard, #Buffett, #Munger, etc.).
`;

	const userPrompt = `
Write a Howard Marks-style memo commentary in Thai for:
---
${contextContent}
---
`;

	let memoCommentary = '';
	try {
		const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			max_tokens: 1024,
		} as any);

		memoCommentary = (response as any).choices?.[0]?.message?.content || response.response || "";
		memoCommentary = memoCommentary.trim();
	} catch (e) {
		console.error('Workers AI formatting failed, trying fallback prompt style:', e);
		// Simple fallback in case system prompt isn't supported by the model structure
		const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
			messages: [
				{ role: 'user', content: `${systemPrompt}\n\nContent to analyze:\n${contextContent}` }
			],
			max_tokens: 1024,
		} as any);
		
		memoCommentary = (response as any).choices?.[0]?.message?.content || response.response || "";
		memoCommentary = memoCommentary.trim();
	}

	if (!memoCommentary) {
		throw new Error('AI failed to generate Thai memo commentary');
	}

	// Make sure the commentary is wrapped in quotes
	if (!memoCommentary.startsWith('"')) {
		memoCommentary = `"${memoCommentary}`;
	}
	if (!memoCommentary.endsWith('"')) {
		memoCommentary = `${memoCommentary}"`;
	}

	// Assemble the final Facebook post programmatically
	const summaryLabel = type === 'daily_report' ? `สรุปรายวัน: ${symbolOrCategory}` : `สรุปตลาด: ${symbolOrCategory}`;
	const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━';
	
	// Create hashtags
	const defaultHashtags = ['#OaktreeAgent', '#วิเคราะห์หุ้น', '#การลงทุนระยะยาว'];
	if (type === 'daily_report') {
		defaultHashtags.push(`#${symbolOrCategory.toUpperCase()}`);
	} else {
		// Clean category name to make a valid hashtag (remove spaces, special characters)
		const cleanCategory = symbolOrCategory.replace(/[^a-zA-Z0-9\u0e00-\u0e7f]/g, '');
		if (cleanCategory) {
			defaultHashtags.push(`#${cleanCategory}`);
		}
	}
	const hashtagsLine = defaultHashtags.join(' ');

	const finalPost = [
		`🔍 ${summaryLabel}`,
		summary,
		'',
		'💡 ประเด็นสำคัญ (Key Takeaways):',
		...takeaways.map((t: string) => `• ${t}`),
		'',
		divider,
		'',
		'📝 Oaktree Memo:',
		memoCommentary,
		'',
		hashtagsLine
	].join('\n');

	return finalPost;
}
