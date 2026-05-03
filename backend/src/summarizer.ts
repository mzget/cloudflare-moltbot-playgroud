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

	const context = news.map(n => `- ${n.title}\n  Summary: ${n.summary || 'No summary available.'}`).join('\n\n');
	
	const prompt = `
		You are the Oaktree Agent, an expert financial analyst. 
		Summarize the following news headlines for ${symbol} into a concise, professional report.
		Style: Howard Marks Memo (insightful, long-term oriented, cautious but clear).
		
		News Headlines:
		${context}
		
		RESPONSE INSTRUCTIONS:
		1. Return ONLY a JSON object.
		2. DO NOT include any introductory text, preamble, or comments.
		3. Ensure the JSON is valid (double quotes for keys/values).
		
		JSON Schema:
		{
			"summary": "...",
			"sentiment_score": 0.5,
			"key_takeaways": ["Point 1", "Point 2"]
		}
	`;

	try {
		const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
			prompt,
		});

		let responseText = response.response || "";
		
		// 1. Clean up common AI artifacts (like comments)
		// Remove // comments that models often add
		responseText = responseText.replace(/\/\/.*$/gm, "");
		
		// 2. Extract the JSON object using a more precise regex
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);
		
		if (jsonMatch) {
			try {
				const data = JSON.parse(jsonMatch[0]);
				
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
				console.debug("Raw cleaned text:", jsonMatch[0]);
			}
		} else {
			console.error("No JSON found in AI response for", symbol);
		}
	} catch (error) {
		console.error(`Error generating summary for ${symbol}:`, error);
	}
}
