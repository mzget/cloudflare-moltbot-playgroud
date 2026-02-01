import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
    if (!locals.runtime?.env?.DB) {
        return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
    }
    const db = locals.runtime.env.DB;
    const { results } = await db.prepare('SELECT * FROM news_sources ORDER BY created_at DESC').all();
    return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request, locals }) => {
    if (!locals.runtime?.env?.DB) {
        return new Response('Database not available', { status: 500 });
    }
    const db = locals.runtime.env.DB;
    const body = await request.json() as any;
    const { id, name, url_pattern, selector } = body;

    await db.prepare('INSERT OR REPLACE INTO news_sources (id, name, url_pattern, selector) VALUES (?, ?, ?, ?)')
        .bind(id, name, url_pattern, selector).run();

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
    if (!locals.runtime?.env?.DB) {
        return new Response('Database not available', { status: 500 });
    }
    const db = locals.runtime.env.DB;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) return new Response('ID required', { status: 400 });

    await db.prepare('DELETE FROM news_sources WHERE id = ?').bind(id).run();
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
};
