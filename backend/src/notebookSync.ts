import { Env } from './index';

interface SyncedArticle {
	title: string;
	symbol: string | null;
	summary: string | null;
	key_takeaways: string[];
}

/** Convert a slug-friendly key from an article title */
function toSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\u0E00-\u0E7F]+/g, '_')
		.replace(/^_|_$/g, '')
		.slice(0, 80);
}

/** Serialize a SyncedArticle to an OKF Markdown string */
function articleToOkf(article: SyncedArticle, timestamp: string): string {
	const tags = ['notebook-sync', 'stock-analysis'];
	if (article.symbol) tags.push(article.symbol.toLowerCase());

	const frontmatter = [
		'---',
		'type: article',
		`title: "${article.title.replace(/"/g, "'")}"`,
		article.symbol ? `symbol: "${article.symbol}"` : null,
		article.summary ? `description: "${article.summary.replace(/"/g, "'")}"` : null,
		`tags: [${tags.join(', ')}]`,
		`timestamp: "${timestamp}"`,
		'source: notebooklm',
		'---',
	].filter(Boolean).join('\n');

	const body = [
		`# ${article.title}`,
		'',
		article.summary ? `## Summary\n\n${article.summary}` : '',
		article.key_takeaways?.length
			? `## Key Takeaways\n\n${article.key_takeaways.map((t) => `- ${t}`).join('\n')}`
			: '',
	].filter((s) => s !== '').join('\n\n');

	return `${frontmatter}\n\n${body}\n`;
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
			signal: AbortSignal.timeout(180000), // 2 minutes timeout for headless browser research
		});

		if (!response.ok) {
			const errText = await response.text();
			throw new Error(`NotebookLM bridge returned ${response.status}: ${errText}`);
		}

		const data = await response.json() as { answer?: string; error?: string };
		if (data.error) {
			throw new Error(`Bridge returned error: ${data.error}`);
		}

		let answer = data.answer;
		if (!answer) {
			console.log('No answer returned from NotebookLM bridge.');
			return 0;
		}

		// Check if the bridge response text itself is a wrapped JSON from notebooklm-mcp
		try {
			const parsedAnswer = JSON.parse(answer);
			if (parsedAnswer && typeof parsedAnswer === 'object') {
				// Case 1: MCP returned an error { success: false, error: "..." }
				if (parsedAnswer.success === false && parsedAnswer.error) {
					throw new Error(`NotebookLM MCP error: ${parsedAnswer.error}`);
				}
				// Case 2: Wrapped success { success: true, data: { answer: "..." } }
				if (parsedAnswer.success && parsedAnswer.data && parsedAnswer.data.answer) {
					console.log('Detected wrapped JSON response. Extracting nested answer...');
					answer = parsedAnswer.data.answer;
				}
			}
		} catch (e: any) {
			// Re-throw MCP errors; ignore JSON parse errors (answer is raw text)
			if (e.message?.startsWith('NotebookLM MCP error:')) throw e;
		}

		// Clean up markdown block if present
		let cleanText = (answer as string).trim();
		if (cleanText.includes('```')) {
			const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
			if (match) {
				cleanText = match[1].trim();
			}
		}

		console.log('Cleaned text from NotebookLM:', cleanText);

		let articles: SyncedArticle[] = [];
		let parsed = false;

		// 1. Try parsing direct cleanText
		try {
			articles = JSON.parse(cleanText) as SyncedArticle[];
			parsed = true;
		} catch (parseErr) {
			// 2. If it fails, search for the JSON array starting with '[' followed by '{'
			const match = cleanText.match(/\[\s*\{/);
			if (match && match.index !== undefined) {
				const startIdx = match.index;
				const lastBracket = cleanText.lastIndexOf(']');
				if (lastBracket !== -1 && lastBracket > startIdx) {
					const potentialJson = cleanText.substring(startIdx, lastBracket + 1).trim();
					try {
						articles = JSON.parse(potentialJson) as SyncedArticle[];
						parsed = true;
						console.log('Successfully extracted and parsed JSON array using regex start marker.');
					} catch (e2) {
						// Fall through to error logging
					}
				}
			}
		}

		if (!parsed) {
			console.error('Failed to parse clean text as JSON array. Raw answer text:', answer);
			throw new Error('JSON parsing failed');
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

					// Write OKF Markdown to R2 so Agent can read it
					if (env.KNOWLEDGE_BUCKET) {
						try {
							const slug = toSlug(article.title);
							const okfKey = `articles/${slug}.md`;
							const okfContent = articleToOkf(article, new Date().toISOString().split('T')[0]);
							await env.KNOWLEDGE_BUCKET.put(okfKey, okfContent, {
								httpMetadata: { contentType: 'text/markdown' },
							});
							console.log(`OKF file written to R2: ${okfKey}`);
						} catch (r2Err) {
							console.warn(`Failed to write OKF to R2 for "${title}":`, r2Err);
						}
					}
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
