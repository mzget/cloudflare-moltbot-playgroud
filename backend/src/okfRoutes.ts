/**
 * okfRoutes.ts — Hono API routes for OKF Knowledge Base
 *
 * GET  /api/knowledge              → list all documents (title, type, tags, key)
 * GET  /api/knowledge/search       → search by ?tags=a,b&type=article
 * GET  /api/knowledge/:key+        → fetch full document content
 */

import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { Env } from './index';
import { listOkfDocuments, getOkfDocument, searchOkfByTags } from './okf';

const okfRoutes = new Hono<{ Bindings: Env }>();

/** List all OKF documents — returns metadata only, no body */
okfRoutes.get('/', cache({ cacheName: 'oaktree-knowledge-list', cacheControl: 'max-age=1800' }), async (c) => {
  if (!c.env.KNOWLEDGE_BUCKET) {
    return c.json({ error: 'KNOWLEDGE_BUCKET not configured' }, 503);
  }

  const prefix = c.req.query('prefix') ?? undefined;
  const keys = await listOkfDocuments(c.env.KNOWLEDGE_BUCKET, prefix);

  // Return lightweight list (no body fetch — just keys and sizes)
  return c.json({
    total: keys.length,
    documents: keys,
  });
});

/** Search OKF documents by tags and/or type */
okfRoutes.get('/search', cache({ cacheName: 'oaktree-knowledge-search', cacheControl: 'max-age=1800' }), async (c) => {
  if (!c.env.KNOWLEDGE_BUCKET) {
    return c.json({ error: 'KNOWLEDGE_BUCKET not configured' }, 503);
  }

  const tagsParam = c.req.query('tags') ?? '';
  const type = c.req.query('type') ?? undefined;
  const prefix = c.req.query('prefix') ?? undefined;
  const limit = parseInt(c.req.query('limit') ?? '20', 10);

  const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const results = await searchOkfByTags(c.env.KNOWLEDGE_BUCKET, { tags, type, prefix, limit });

  return c.json({
    total: results.length,
    documents: results.map((doc) => ({
      key: doc.key,
      frontmatter: doc.frontmatter,
      body: doc.body,
    })),
  });
});

/** Fetch a single OKF document by path key (e.g. frameworks/peter_lynch.md) */
okfRoutes.get('/:key{.+}', cache({ cacheName: 'oaktree-knowledge-doc', cacheControl: 'max-age=1800' }), async (c) => {
  if (!c.env.KNOWLEDGE_BUCKET) {
    return c.json({ error: 'KNOWLEDGE_BUCKET not configured' }, 503);
  }

  const key = c.req.param('key');
  const doc = await getOkfDocument(c.env.KNOWLEDGE_BUCKET, key);

  if (!doc) {
    return c.json({ error: `Document not found: ${key}` }, 404);
  }

  return c.json({
    key: doc.key,
    frontmatter: doc.frontmatter,
    body: doc.body,
    content: doc.content,
  });
});

export default okfRoutes;
