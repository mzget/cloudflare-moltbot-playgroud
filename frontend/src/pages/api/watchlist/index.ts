import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
    // Check if running in Cloudflare environment
    if (!locals.runtime?.env?.DB) {
        return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const db = locals.runtime.env.DB;
    const { results } = await db.prepare('SELECT * FROM watchlist ORDER BY created_at DESC').all();
    return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
    });
};

export const POST: APIRoute = async ({ locals, request }) => {
    // Check if running in Cloudflare environment
    if (!locals.runtime?.env?.DB || !locals.runtime?.env?.AI) {
        return new Response(JSON.stringify({ error: 'Not available in dev mode' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const db = locals.runtime.env.DB;

    const { symbol } = await request.json() as { symbol: string };
    if (!symbol) {
        return new Response(JSON.stringify({ error: 'Symbol required' }), { status: 400 });
    }

    const cleanSymbol = symbol.toUpperCase();

    // Add User's Stock
    await db.prepare('INSERT OR IGNORE INTO watchlist (symbol) VALUES (?)')
        .bind(cleanSymbol).run();

    // AI Related Stocks Suggestion
    try {
        const prompt = `User added stock ${cleanSymbol}. Suggest 3 related stocks in the same industry. Return ONLY a JSON array of strings, e.g. ["MSFT", "GOOG", "ORCL"]. nothing else.`;

        const response: any = await locals.runtime.env.AI.run('@cf/meta/llama-3-8b-instruct', {
            messages: [{ role: 'user', content: prompt }]
        });

        const text = response.response || "";
        const match = text.match(/\[.*?\]/);
        if (match) {
            const suggested = JSON.parse(match[0]);
            for (const s of suggested) {
                await db.prepare('INSERT OR IGNORE INTO watchlist (symbol, is_auto_suggested) VALUES (?, 1)')
                    .bind(s.toUpperCase()).run();
            }
        }
    } catch (e) {
        console.error("AI Auto-suggest failed", e);
    }

    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
};
