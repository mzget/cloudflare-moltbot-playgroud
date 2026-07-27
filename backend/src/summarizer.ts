import { Env } from './index';

async function runAiWithRetry(env: Env, model: string, payload: any, maxRetries = 2): Promise<any> {
	let lastError: any;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			if (attempt > 0) {
				const delay = Math.pow(2, attempt - 1) * 1000;
				await new Promise(resolve => setTimeout(resolve, delay));
			}
			return await env.AI.run(model, payload);
		} catch (err: any) {
			lastError = err;
			console.warn(`[Workers AI] Attempt ${attempt + 1} failed for ${model}:`, err?.message || err);
		}
	}
	throw lastError;
}

export async function generateDailySummary(env: Env, symbol: string, force = false) {
	// Check if a daily report already exists for this symbol today
	if (!force) {
		const existing = await env.DB.prepare(
			'SELECT id FROM daily_reports WHERE symbol = ? AND report_date = DATE("now")'
		).bind(symbol).first() as { id: number } | null;

		if (existing) {
			console.log(`Daily report for ${symbol} already exists today. Skipping.`);
			return;
		}
	}

	// Fetch news from the last 24h
	const { results: news } = await env.DB.prepare(
		'SELECT title, summary, published_at FROM news WHERE symbol = ? AND created_at > datetime("now", "-1 day")'
	).bind(symbol).all() as { results: any[] };

	if (news.length === 0) {
		console.log(`No news found for ${symbol} in the last 24h.`);
		return;
	}

	const context = news.slice(0, 10).map(n => `- ${n.title}\n  Summary: ${n.summary || 'No summary available.'}`).join('\n\n');

	const prompt = `
		You are the Oaktree Agent, a senior financial analyst writing for a Thai investor.
		Analyze all news headlines and summaries for ${symbol} collected over the past 24 hours.
		Produce a JSON response with TWO distinct sections in THAI language:

		SECTION 1 — COMPREHENSIVE DAILY NEWS SUMMARY (สรุปข่าวสารครอบคลุมทุกประเด็น):
		- Synthesize all news items into a thorough, coherent summary IN THAI.
		- Cover EVERY major point, event, corporate action, earnings report, or market guidance mentioned in the headlines.
		- Do not omit key facts or figures. The reader should completely understand all news events for ${symbol} without reading raw articles (2 to 3 paragraphs, 8 to 12 sentences).

		SECTION 2 — HOWARD MARKS STYLE CORE TAKEAWAYS (มุมมองสไตล์ Howard Marks Memo):
		- Provide 3 to 5 "key_takeaways" IN THAI written in Howard Marks' memo style.
		- Focus on: Market Cycle Positioning, Risk vs. Return Assessment, Second-Level Thinking (Contrarian perspective), and Long-Term Value Implications.

		RESPONSE INSTRUCTIONS:
		1. Return ONLY a valid JSON object.
		2. The "summary" and "key_takeaways" fields MUST be written in Thai language.
		3. "sentiment_score" must be a float between -1.0 (very negative) and 1.0 (very positive).
		4. CRITICAL: Keep your internal reasoning/thinking process very short (under 50 words) so you do not run out of token space.
		5. DO NOT include any introductory text, preamble, or comments.
		6. Ensure the JSON is strictly valid (double quotes for keys/values).
		7. CRITICAL: Do NOT use double quotes (") inside any JSON string values (like 'summary' or 'key_takeaways'). Instead, use single quotes (') for any internal quotes or speech marks.

		JSON Schema:
		{
			"summary": "สรุปข่าวสารย่อยทุกประเด็นอย่างละเอียดเป็นภาษาไทย...",
			"sentiment_score": 0.35,
			"key_takeaways": ["ข้อคิดสไตล์ Howard Marks ข้อที่ 1...", "ข้อคิดสไตล์ Howard Marks ข้อที่ 2..."]
		}
	`;

	try {
		const response = await runAiWithRetry(env, env.default_ai_model, {
			messages: [
				{ role: 'user', content: prompt }
			],
			max_tokens: 8192,
			response_format: {
				type: 'json_object'
			}
		} as any);

		let responseText = (response as any).choices?.[0]?.message?.content || response.response || "";

		// 2. Extract the JSON object using a more precise regex
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);

		if (jsonMatch) {
			try {
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

				await env.DB.prepare(
					'INSERT INTO daily_reports (symbol, summary, sentiment_score, key_takeaways) VALUES (?, ?, ?, ?)'
				).bind(
					symbol,
					data.summary,
					data.sentiment_score || 0,
					JSON.stringify(data.key_takeaways || [])
				).run();

				console.log(`Generated structured summary for ${symbol}.`);
			} catch (parseError) {
				console.error(`JSON Parse Error for ${symbol}:`, parseError);
				console.error("Raw cleaned text:", jsonMatch[0]);
				console.error("Raw response object:", JSON.stringify(response));
			}
		} else {
			console.error("No JSON found in AI response for", symbol);
			console.error("Raw responseText:", responseText);
			console.error("Raw response object:", JSON.stringify(response));
		}
	} catch (error) {
		console.error(`Error generating summary for ${symbol}:`, error);
	}
}


