import puppeteer, { BrowserWorker } from '@cloudflare/puppeteer'
import { ExecutionContext, ScheduledEvent, D1Database } from '@cloudflare/workers-types'

interface Bindings {
    DB: D1Database
    AI: any
    MYBROWSER: BrowserWorker
}

export default {
    async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
        return new Response("Moltbot Backend (Crawler Only) - System Online", { status: 200 });
    },

    async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
        console.log("Starting scheduled crawler...");

        // 1. Get Symbols from Watchlist
        const { results } = await env.DB.prepare('SELECT symbol FROM watchlist').all();
        const symbols = results.map((r: any) => r.symbol);

        if (symbols.length === 0) {
            console.log("No symbols in watchlist");
            return;
        }

        console.log(`Processing ${symbols.length} symbols: ${symbols.join(', ')}`);

        // 2. Initialize Browser (if binding exists)
        let browser: any = null;
        if (env.MYBROWSER) {
            try {
                browser = await puppeteer.launch(env.MYBROWSER);
            } catch (e) {
                console.error("Failed to launch browser, falling back to mock data or direct fetch", e);
            }
        }

        for (const symbol of symbols) {
            try {
                let articles: { title: string, url: string }[] = [];

                if (browser) {
                    console.log(`Crawling Yahoo Finance for ${symbol}...`);
                    const page = await browser.newPage();
                    const searchUrl = `https://finance.yahoo.com/quote/${symbol}/news`;

                    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

                    // Extract news articles
                    articles = await page.evaluate(() => {
                        const links = Array.from(document.querySelectorAll('section[data-test="qsp-news"] a, #quoteNewsStream-0-Stream a'));
                        return links.slice(0, 3).map(link => ({
                            title: (link as HTMLElement).innerText || '',
                            url: (link as HTMLAnchorElement).href || ''
                        })).filter(a => a.title.length > 10 && a.url.startsWith('http'));
                    });

                    await page.close();
                }

                // Fallback to mock data if no articles found (useful for local dev or if anti-bot triggers)
                if (articles.length === 0) {
                    console.log(`No results for ${symbol}, using default fallback article.`);
                    articles = [{
                        title: `${symbol} Stock Analysis - Market Update`,
                        url: `https://finance.yahoo.com/quote/${symbol}/news?fallback=1`
                    }];
                }

                for (const article of articles) {
                    // Check if news already exists
                    const existing = await env.DB.prepare('SELECT id FROM news WHERE url = ?').bind(article.url).first();
                    if (existing) {
                        console.log(`Article already exists for ${symbol}: ${article.title.substring(0, 30)}...`);
                        continue;
                    }

                    // 3. AI Analysis (Sentiment & Summary)
                    console.log(`Analyzing news for ${symbol} with AI...`);
                    const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
                        messages: [{
                            role: 'user', content: `Analyze this news title for stock ${symbol}: "${article.title}". 
                    1. Summarize it in 1 sentence. 
                    2. Sentiment (Positive/Negative/Neutral). 
                    Return JSON: { "summary": "...", "sentiment": "..." }` }]
                    }) as any;

                    let summary = article.title;
                    let sentiment = 'Neutral';

                    try {
                        const responseText = aiRes.response || "";
                        const jsonStr = responseText.match(/\{.*\}/s)?.[0];
                        if (jsonStr) {
                            const json = JSON.parse(jsonStr);
                            summary = json.summary || summary;
                            sentiment = json.sentiment || sentiment;
                        }
                    } catch (e) {
                        console.error("AI parsing error:", e);
                    }

                    // 4. Save to Database
                    await env.DB.prepare('INSERT INTO news (symbol, title, summary, sentiment, url) VALUES (?, ?, ?, ?, ?)')
                        .bind(symbol, article.title, summary, sentiment, article.url).run();

                    console.log(`✅ Added news for ${symbol}: ${article.title.substring(0, 50)}...`);
                }
            } catch (e) {
                console.error(`Error processing ${symbol}:`, e);
            }
        }

        if (browser) await browser.close();
        console.log("Crawler finished successfully.");
    }
}
