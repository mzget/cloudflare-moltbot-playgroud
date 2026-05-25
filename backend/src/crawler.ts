import puppeteer from '@cloudflare/puppeteer';
import { Env } from './index';

export async function runCrawler(env: Env) {
	console.log("Starting Oaktree Multi-Source Crawler...");

	// 1. Get enabled sources and watchlist symbols
	const { results: sources } = await env.DB.prepare('SELECT * FROM news_sources WHERE enabled = 1').all() as { results: any[] };
	const { results: symbolsRes } = await env.DB.prepare('SELECT symbol FROM watchlist WHERE is_active = 1').all() as { results: any[] };
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

	const providers = ['Google News', 'Yahoo Finance'];

	for (const provider of providers) {
		console.log(`--- Processing Provider: ${provider} ---`);

		const rssSource = sources.find(s => s.name === `${provider} RSS`);
		const webSource = sources.find(s => s.name === `${provider} WEB`);

		for (const symbol of symbols) {
			try {
				let articles: { title: string, url: string, date?: string, summary?: string }[] = [];

				// 1. Try RSS First
				if (rssSource) {
					console.log(`[${symbol}] Trying ${provider} RSS...`);
					articles = await crawlRSS(rssSource.url_pattern.replace('{symbol}', symbol));
				}

				// 2. Fallback to WEB if RSS fails or returns nothing
				if (articles.length === 0 && webSource && browser) {
					console.log(`[${symbol}] RSS fallback triggered: using ${provider} WEB crawler...`);
					articles = await crawlWeb(browser, webSource.url_pattern.replace('{symbol}', symbol), webSource.selector);
				}

				for (const article of articles) {
					// Check if exists
					const existing = await env.DB.prepare('SELECT id FROM news WHERE url = ?').bind(article.url).first();
					if (existing) continue;

					console.log(`Adding news for ${symbol}: ${article.title}`);

					let finalSummary = article.summary || '';

					// Decode basic HTML entities that Google News uses in its RSS descriptions
					finalSummary = finalSummary
						.replace(/&lt;/g, '<')
						.replace(/&gt;/g, '>')
						.replace(/&quot;/g, '"')
						.replace(/&amp;/g, '&')
						.replace(/&nbsp;/g, ' ');

					// If summary is missing, too short, or contains HTML links (like Google News RSS)
					if (!finalSummary || finalSummary.length < 50 || finalSummary.includes('<a href=')) {
						try {
							console.log(`Fetching article content via Jina for: ${article.url}`);
							const jinaRes = await fetch(`https://r.jina.ai/${article.url}`);
							if (jinaRes.ok) {
								const text = await jinaRes.text();
								finalSummary = text.replace(/\n+/g, '\n').slice(0, 1500); // keep it reasonable
							} else {
								console.error(`Jina fetch failed: ${jinaRes.status} ${jinaRes.statusText}`);
							}
						} catch (e) {
							console.error(`Jina fetch exception for ${article.url}`, e);
						}
					}

					// Fallback cleanup: strip any remaining HTML tags from the summary
					finalSummary = finalSummary.replace(/<[^>]*>?/gm, '').trim();
					// If after stripping it's empty, fallback to title
					if (!finalSummary) finalSummary = article.title;

					await env.DB.prepare(
						'INSERT INTO news (symbol, title, summary, sentiment, url) VALUES (?, ?, ?, ?, ?)'
					).bind(symbol, article.title, finalSummary, null, article.url).run();
				}
			} catch (err) {
				console.error(`Error crawling ${symbol} on ${provider}:`, err);
			}
		}
	}

	if (browser) await browser.close();
	console.log("Crawl completed.");
}

async function crawlRSS(url: string) {
	console.log(`Fetching RSS from: ${url}`);
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
			}
		});

		if (!response.ok) {
			console.error(`RSS fetch failed: ${response.status} ${response.statusText}`);
			return [];
		}

		const xml = await response.text();
		const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
		console.log(`Found ${items.length} items in RSS`);

		return items.slice(0, 10).map(item => {
			const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ||
				item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] || 'No Title';
			const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
			const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || new Date().toISOString();
			const description = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ||
				item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] || '';

			// Clean up CDATA and entities if present
			const cleanTitle = title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/&amp;/g, '&');
			const cleanDesc = description.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/&amp;/g, '&');

			return { title: cleanTitle, url: link, date: pubDate, summary: cleanDesc };
		});
	} catch (e) {
		console.error("crawlRSS exception:", e);
		return [];
	}
}

async function crawlWeb(browser: any, url: string, selector: string) {
	if (!selector) return [];
	console.log(`Launching browser to crawl: ${url}`);
	const page = await browser.newPage();
	try {
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
		console.log(`Page loaded: ${url}`);

		const articles = await page.evaluate((sel: string) => {
			const links = Array.from((globalThis as any).document.querySelectorAll(sel));
			return links.slice(0, 8).map(link => {
				const htmlLink = link as any;
				const titleElement = htmlLink.querySelector('h3') || htmlLink;
				return {
					title: titleElement.innerText.trim() || '',
					url: htmlLink.href || ''
				};
			}).filter((a: any) => a.title.length > 5 && a.url.startsWith('http'));
		}, selector);

		console.log(`Found ${articles.length} articles via WEB crawl`);
		return articles;
	} catch (e) {
		console.error(`Web crawl failed for ${url}:`, e);
		return [];
	} finally {
		await page.close();
	}
}
