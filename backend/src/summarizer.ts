import { Env } from './index';

export async function generateDailySummary(env: Env, symbol: string) {
	// Fetch news from the last 24h
	const { results: news } = await env.DB.prepare(
		'SELECT title, published_at FROM news WHERE symbol = ? AND created_at > datetime("now", "-1 day")'
	).bind(symbol).all();

	if (news.length === 0) {
		console.log(`No news found for ${symbol} in the last 24h.`);
		return;
	}

	const context = news.map(n => `- ${n.title}`).join('\n');
	
	const prompt = `
		You are the Oaktree Agent, an expert financial analyst. 
		Summarize the following news headlines for ${symbol} into a concise, professional report.
		Style: Howard Marks Memo (insightful, long-term oriented, cautious but clear).
		
		News Headlines:
		${context}
		
		Format your response EXACTLY as a JSON object:
		{
			"summary": "A cohesive paragraph summarizing the key narrative.",
			"sentiment_score": 0.5, // A number between -1 (extremely bearish) and 1 (extremely bullish)
			"key_takeaways": ["Point 1", "Point 2", "Point 3"]
		}
	`;

	try {
		const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
			prompt,
		});

		const responseText = response.response || "";
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);
		
		if (jsonMatch) {
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
		} else {
			console.error("Failed to parse JSON from AI response:", responseText);
		}
	} catch (error) {
		console.error(`Error generating summary for ${symbol}:`, error);
	}
}
