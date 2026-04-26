import puppeteer from '@cloudflare/puppeteer';
import { Env } from './index';

export async function runCrawler(env: Env) {
	console.log("Starting Oaktree Multi-Source Crawler...");

	// 1. Get enabled sources and watchlist symbols
	const { results: sources } = await env.DB.prepare('SELECT * FROM news_sources WHERE enabled = 1').all() as { results: any[] };
	const { results: symbolsRes } = await env.DB.prepare('SELECT symbol FROM watchlist').all() as { results: any[] };
	const symbols = symbolsRes.map((r: any) => r.symbol);

	if (symbols.length === 0) {
		console.log("No symbols in watchlist");
		return;
	}

	if (sources.length === 0) {
		console.log("No enabled news sources");
		return;
	}

	// 2. Initialize Browser for WEB sources
	let browser: any = null;
	const webSources = sources.filter(s => s.type === 'WEB');
	if (webSources.length > 0 && env.BROWSER) {
		try {
			browser = await puppeteer.launch(env.BROWSER);
		} catch (e) {
			console.error("Failed to launch browser", e);
		}
	}

	for (const source of sources) {
		console.log(`--- Processing Source: ${source.name} (${source.type}) ---`);
		
		for (const symbol of symbols) {
			try {
				let articles: { title: string, url: string, date?: string }[] = [];

				if (source.type === 'RSS') {
					articles = await crawlRSS(source.url_pattern.replace('{symbol}', symbol));
				} else if (source.type === 'WEB' && browser) {
					articles = await crawlWeb(browser, source.url_pattern.replace('{symbol}', symbol), source.selector);
				}

				for (const article of articles) {
					// Check if exists
					const existing = await env.DB.prepare('SELECT id FROM news WHERE source_url = ?').bind(article.url).first();
					if (existing) continue;

					console.log(`Adding news for ${symbol}: ${article.title}`);

					// Optional: Analyze individual article sentiment/summary
					let individualSummary = article.title;
					let individualSentiment = 'Neutral';

					try {
						const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
							messages: [{
								role: 'user', 
								content: `Analyze this news title for stock ${symbol}: "${article.title}". 
								Summarize in 1 sentence. Sentiment (Positive/Negative/Neutral). 
								Return JSON: { "summary": "...", "sentiment": "..." }` 
							}]
						}) as any;

						const responseText = aiRes.response || "";
						const jsonStr = responseText.match(/\{.*\}/s)?.[0];
						if (jsonStr) {
							const json = JSON.parse(jsonStr);
							individualSummary = json.summary || individualSummary;
							individualSentiment = json.sentiment || individualSentiment;
						}
					} catch (e) {
						console.error("Individual AI analysis failed", e);
					}

					await env.DB.prepare(
						'INSERT INTO news (symbol, title, summary, sentiment, source_url, published_at) VALUES (?, ?, ?, ?, ?, ?)'
					).bind(symbol, article.title, individualSummary, individualSentiment, article.url, article.date || new Date().toISOString()).run();
				}
			} catch (err) {
				console.error(`Error crawling ${symbol} on ${source.name}:`, err);
			}
		}
	}

	if (browser) await browser.close();
	console.log("Crawl completed.");
}

async function crawlRSS(url: string) {
	const response = await fetch(url);
	const xml = await response.text();
	const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
	
	return items.slice(0, 5).map(item => {
		const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || 'No Title';
		const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
		const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || new Date().toISOString();
		return { title, url: link, date: pubDate };
	});
}

async function crawlWeb(browser: any, url: string, selector: string) {
	if (!selector) return [];
	const page = await browser.newPage();
	try {
		await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
		const articles = await page.evaluate((sel: string) => {
			const links = Array.from(document.querySelectorAll(sel));
			return links.slice(0, 5).map(link => ({
				title: (link as HTMLElement).innerText || '',
				url: (link as HTMLAnchorElement).href || ''
			})).filter(a => a.title.length > 10 && a.url.startsWith('http'));
		}, selector);
		return articles;
	} catch (e) {
		console.error(`Web crawl failed for ${url}`, e);
		return [];
	} finally {
		await page.close();
	}
}
