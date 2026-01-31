import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
    // Check if running in Cloudflare environment
    if (!locals.runtime?.env?.DB) {
        return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const db = locals.runtime.env.DB;
    const { results } = await db.prepare('SELECT * FROM news ORDER BY created_at DESC LIMIT 50').all();
    return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
    });
};
