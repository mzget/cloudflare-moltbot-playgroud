import { Env } from './index';

interface SyncedArticle {
	title: string;
	symbol: string | null;
	summary: string | null;
	key_takeaways: string[];
}

export async function syncNotebookArticles(env: Env): Promise<number> {
	console.log('Starting sync of NotebookLM articles...');
	const bridgeUrl = env.NOTEBOOKLM_BRIDGE_URL;
	const notebookId = env.NOTEBOOKLM_DEFAULT_NOTEBOOK_ID || 'ai-datacenter';

	if (!bridgeUrl) {
		console.error('NotebookLM bridge URL is not configured (NOTEBOOKLM_BRIDGE_URL is empty).');
		return 0;
	}

	const prompt = `Please identify all individual stock articles/notes in this notebook. For each article, extract the following information:
- Title
- Stock Symbol (e.g. AAPL, NVDA, or null if it is a general market article)
- Summary (1-2 sentences)
- Key takeaways (as a list of bullet points)

Format the response strictly as a JSON array of objects, where each object has fields 'title', 'symbol', 'summary', and 'key_takeaways' (which is an array of strings). Do not include any markdown backticks, explanations, or introductory text. Just return the raw JSON array.`;

	try {
		console.log(`Sending ask request to NotebookLM bridge at ${bridgeUrl} for notebook ID ${notebookId}...`);
		
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};
		if (env.BRIDGE_SECRET) {
			headers['Authorization'] = `Bearer ${env.BRIDGE_SECRET}`;
		}

		const response = await fetch(`${bridgeUrl}/ask`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				question: prompt,
				notebookId: notebookId,
			}),
			signal: AbortSignal.timeout(120000), // 2 minutes timeout for headless browser research
		});

		if (!response.ok) {
			const errText = await response.text();
			throw new Error(`NotebookLM bridge returned ${response.status}: ${errText}`);
		}

		const data = await response.json() as { answer?: string; error?: string };
		if (data.error) {
			throw new Error(`Bridge returned error: ${data.error}`);
		}

		const answer = data.answer;
		if (!answer) {
			console.log('No answer returned from NotebookLM bridge.');
			return 0;
		}

		// Clean up markdown block if present
		let cleanText = answer.trim();
		if (cleanText.includes('```')) {
			const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
			if (match) {
				cleanText = match[1].trim();
			}
		}

		console.log('Cleaned text from NotebookLM:', cleanText);

		let articles: SyncedArticle[] = [];
		try {
			articles = JSON.parse(cleanText) as SyncedArticle[];
		} catch (parseErr) {
			console.error('Failed to parse clean text as JSON array. Raw answer text:', answer);
			throw new Error(`JSON parsing failed: ${(parseErr as any).message}`);
		}

		if (!Array.isArray(articles)) {
			console.error('Parsed response is not an array:', articles);
			return 0;
		}

		console.log(`Successfully parsed ${articles.length} articles from NotebookLM. Storing in database...`);
		let addedCount = 0;

		for (const article of articles) {
			if (!article.title) continue;

			const title = article.title.trim();
			const symbol = article.symbol ? article.symbol.trim().toUpperCase() : null;
			const summary = article.summary ? article.summary.trim() : null;
			const takeaways = JSON.stringify(article.key_takeaways || []);

			try {
				const result = await env.DB.prepare(`
					INSERT OR IGNORE INTO notebook_articles (title, symbol, summary, key_takeaways)
					VALUES (?, ?, ?, ?)
				`).bind(title, symbol, summary, takeaways).run();

				if (result.meta.changes > 0) {
					addedCount++;
					console.log(`New article synced: "${title}" for symbol "${symbol}"`);
				}
			} catch (dbErr) {
				console.error(`Failed to store article "${title}" in D1:`, dbErr);
			}
		}

		console.log(`Sync complete. Added ${addedCount} new articles.`);
		return addedCount;

	} catch (e: any) {
		console.error('NotebookLM article sync failed:', e);
		return 0;
	}
}
