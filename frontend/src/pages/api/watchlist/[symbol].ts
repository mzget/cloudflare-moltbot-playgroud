import type { APIRoute } from 'astro';

export const DELETE: APIRoute = async ({ params, locals }) => {
    const { symbol } = params;

    if (!symbol) {
        return new Response(JSON.stringify({ error: 'Symbol required' }), { status: 400 });
    }

    // Check if running in Cloudflare environment
    if (!locals.runtime?.env?.DB) {
        return new Response(JSON.stringify({ error: 'Not available in dev mode' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const db = locals.runtime.env.DB;
    await db.prepare('DELETE FROM watchlist WHERE symbol = ?').bind(symbol).run();

    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
};
