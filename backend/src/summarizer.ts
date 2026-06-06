import { Env } from './index';

export async function generateDailySummary(env: Env, symbol: string) {
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
		You are the Oaktree Agent, an expert financial analyst. 
		Summarize the following news headlines for ${symbol} into a concise, professional report (strictly 2 to 3 sentences) WRITTEN IN THAI.
		Style: Howard Marks Memo (insightful, long-term oriented, cautious but clear).
		
		News Headlines:
		${context}
		
		RESPONSE INSTRUCTIONS:
		1. Return ONLY a JSON object.
		2. The "summary" and "key_takeaways" fields MUST be written in Thai language.
		3. CRITICAL: Keep your internal reasoning/thinking process very short (under 100 words) so you do not run out of token space.
		4. DO NOT include any introductory text, preamble, or comments.
		5. Ensure the JSON is valid (double quotes for keys/values).
		6. CRITICAL: Do NOT use double quotes (") inside any JSON string values (like 'summary' or 'key_takeaways'). Instead, use single quotes (') for any internal quotes or speech marks.
		   Example: "summary": "รายงาน 'ความตึงเครียด' ทางภูมิรัฐศาสตร์" (valid)
		   Example: "summary": "รายงาน "ความตึงเครียด" ทางภูมิรัฐศาสตร์" (INVALID)
		
		JSON Schema:
		{
			"summary": "...",
			"sentiment_score": 0.5,
			"key_takeaways": ["Point 1", "Point 2"]
		}
	`;

	try {
		const response = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
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

