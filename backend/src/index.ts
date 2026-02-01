import puppeteer, { BrowserWorker } from '@cloudflare/puppeteer'
import { ExecutionContext, ScheduledEvent, D1Database } from '@cloudflare/workers-types'

interface Bindings {
    DB: D1Database
    AI: any
    MYBROWSER: BrowserWorker
}

async function runCrawler(env: Bindings) {
    console.log("Starting multi-source crawler...");

    // 1. Get enabled sources and watchlist symbols
    const { results: sources } = await env.DB.prepare('SELECT * FROM news_sources WHERE enabled = 1').all() as { results: any[] };
    const { results: symbolsRes } = await env.DB.prepare('SELECT symbol FROM watchlist').all() as { results: any[] };
    const symbols = symbolsRes.map((r: any) => r.symbol);

    if (symbols.length === 0) {
        console.log("No symbols in watchlist");
        return { success: true, message: "No symbols in watchlist" };
    }

    if (sources.length === 0) {
        console.log("No enabled news sources");
        return { success: true, message: "No enabled news sources" };
    }

    console.log(`Processing ${symbols.length} symbols across ${sources.length} sources`);

    // 2. Initialize Browser
    let browser: any = null;
    if (env.MYBROWSER) {
        try {
            browser = await puppeteer.launch(env.MYBROWSER);
        } catch (e) {
            console.error("Failed to launch browser", e);
        }
    }

    let addedCount = 0;

    for (const source of sources) {
        console.log(`--- Source: ${source.name} ---`);
        for (const symbol of symbols) {
            try {
                let articles: { title: string, url: string }[] = [];

                if (browser) {
                    const searchUrl = source.url_pattern.replace('{symbol}', symbol);
                    console.log(`Crawling ${source.name} for ${symbol} at ${searchUrl}...`);

                    const page = await browser.newPage();
                    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

                    articles = await page.evaluate((selector: string) => {
                        const links = Array.from(document.querySelectorAll(selector));
                        return links.slice(0, 3).map(link => ({
                            title: (link as HTMLElement).innerText || '',
                            url: (link as HTMLAnchorElement).href || ''
                        })).filter(a => a.title.length > 10 && a.url.startsWith('http'));
                    }, source.selector);

                    await page.close();
                }

                // Fallback article if nothing found
                if (articles.length === 0) {
                    articles = [{
                        title: `${symbol} Analysis - ${source.name} Update`,
                        url: `${source.url_pattern.replace('{symbol}', symbol)}?fallback=1`
                    }];
                }

                for (const article of articles) {
                    const existing = await env.DB.prepare('SELECT id FROM news WHERE url = ?').bind(article.url).first();
                    if (existing) continue;

                    console.log(`Analyzing [${source.name}] news for ${symbol}...`);
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

                    await env.DB.prepare('INSERT INTO news (symbol, title, summary, sentiment, url) VALUES (?, ?, ?, ?, ?)')
                        .bind(symbol, article.title, summary, sentiment, article.url).run();

                    console.log(`✅ Added from ${source.name}: ${article.title.substring(0, 40)}...`);
                    addedCount++;
                }
            } catch (e) {
                console.error(`Error processing ${symbol} on ${source.name}:`, e);
            }
        }
    }

    if (browser) await browser.close();
    console.log("Crawler finished successfully.");
    return { success: true, addedCount };
}

export default {
    async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
        const url = new URL(request.url);

        // CORS Headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (url.pathname === '/crawl' && request.method === 'POST') {
            try {
                const result = await runCrawler(env);
                return new Response(JSON.stringify(result), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (err: any) {
                return new Response(JSON.stringify({ error: err.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        return new Response("Moltbot Backend (System Online)", {
            status: 200,
            headers: corsHeaders
        });
    },

    async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
        await runCrawler(env);
    }
}
