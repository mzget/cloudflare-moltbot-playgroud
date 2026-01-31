import { ExecutionContext, ScheduledEvent, D1Database } from '@cloudflare/workers-types'

interface Bindings {
    DB: D1Database
    AI: Ai
}

export default {
    async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
        return new Response("Moltbot Backend (Crawler Only) - System Online", { status: 200 });
    },

    async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
        console.log("Starting scheduled crawler...");

        // 1. Get Symbols
        const { results } = await env.DB.prepare('SELECT symbol FROM watchlist').all();
        const symbols = results.map((r: any) => r.symbol);
        if (symbols.length === 0) {
            console.log("No symbols in watchlist");
            return;
        }

        console.log(`Crawling news for ${symbols.length} symbols: ${symbols.join(', ')}`);

        // 2. Simplified Crawler (without Browser Rendering for local dev)
        // In production, you would use Puppeteer with MYBROWSER binding
        for (const symbol of symbols) {
            try {
                // Mock news data for local testing
                // In production, replace this with actual Puppeteer crawling
                const mockArticles = [
                    {
                        title: `${symbol} Stock Analysis - Market Update`,
                        url: `https://finance.yahoo.com/quote/${symbol}/news`
                    }
                ];

                for (const article of mockArticles) {
                    const existing = await env.DB.prepare('SELECT id FROM news WHERE url = ?').bind(article.url).first();
                    if (existing) continue;

                    // Use native AI binding
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
                        const jsonStr = aiRes.response?.match(/\{.*\}/s)?.[0];
                        if (jsonStr) {
                            const json = JSON.parse(jsonStr);
                            summary = json.summary;
                            sentiment = json.sentiment;
                        }
                    } catch (e) {
                        console.error("AI parsing error:", e);
                    }

                    await env.DB.prepare('INSERT INTO news (symbol, title, summary, sentiment, url) VALUES (?, ?, ?, ?, ?)')
                        .bind(symbol, article.title, summary, sentiment, article.url).run();

                    console.log(`Added news for ${symbol}: ${article.title}`);
                }
            } catch (e) {
                console.error(`Error crawling ${symbol}:`, e);
            }
        }

        console.log("Crawler finished");
    }
}
