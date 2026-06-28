/**
 * okf.ts — OKF (Open Knowledge Format) Parser + Cloudflare R2 Reader
 *
 * Reads OKF Markdown files from R2, parses YAML frontmatter, and provides
 * tag-based search for the Oaktree Agent knowledge base.
 */

export interface OkfFrontmatter {
  type: string;
  title?: string;
  description?: string;
  resource?: string;
  tags?: string[];
  version?: string;
  timestamp?: string;
  category?: string;
  symbol?: string;
  [key: string]: unknown;
}

export interface OkfDocument {
  key: string;
  frontmatter: OkfFrontmatter;
  body: string;
  /** Combined content: frontmatter fields as context + body text */
  content: string;
}

/**
 * Parse YAML frontmatter from an OKF Markdown string.
 * Supports only simple key: value and key: [list] formats — no js-yaml needed.
 */
export function parseOkfFrontmatter(markdown: string): { frontmatter: OkfFrontmatter; body: string } {
  const trimmed = markdown.trim();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: { type: 'unknown' }, body: trimmed };
  }

  const endMarker = trimmed.indexOf('\n---', 3);
  if (endMarker === -1) {
    return { frontmatter: { type: 'unknown' }, body: trimmed };
  }

  const yamlBlock = trimmed.slice(4, endMarker).trim();
  const body = trimmed.slice(endMarker + 4).trim();

  const frontmatter: OkfFrontmatter = { type: 'unknown' };

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (!key) continue;

    // Handle inline array: [tag1, tag2, tag3]
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      frontmatter[key] = rawValue
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      continue;
    }

    // Handle quoted string
    if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
      frontmatter[key] = rawValue.slice(1, -1);
      continue;
    }

    // Plain value
    frontmatter[key] = rawValue;
  }

  return { frontmatter, body };
}

/**
 * Fetch and parse a single OKF document from R2 by key.
 * Returns null if not found.
 */
export async function getOkfDocument(
  bucket: R2Bucket,
  key: string
): Promise<OkfDocument | null> {
  const obj = await bucket.get(key);
  if (!obj) return null;

  const markdown = await obj.text();
  const { frontmatter, body } = parseOkfFrontmatter(markdown);

  // Build a rich content string that combines frontmatter metadata + body
  const metaParts: string[] = [];
  if (frontmatter.title) metaParts.push(`Title: ${frontmatter.title}`);
  if (frontmatter.description) metaParts.push(`Description: ${frontmatter.description}`);
  if (frontmatter.tags?.length) metaParts.push(`Tags: ${(frontmatter.tags as string[]).join(', ')}`);

  const content = metaParts.length > 0 ? `${metaParts.join('\n')}\n\n${body}` : body;

  return { key, frontmatter, body, content };
}

/**
 * List all OKF document keys in a given R2 prefix (e.g. "frameworks/").
 */
export async function listOkfDocuments(
  bucket: R2Bucket,
  prefix?: string
): Promise<{ key: string; size: number }[]> {
  const list = await bucket.list({ prefix });
  return list.objects.map((obj) => ({ key: obj.key, size: obj.size }));
}

/**
 * Search OKF documents by tags and/or type within a given prefix.
 * Does a lightweight scan: fetch each doc, check frontmatter, return matches.
 *
 * For small-to-medium bundles this is fine. For large bundles, use Vectorize.
 */
export async function searchOkfByTags(
  bucket: R2Bucket,
  opts: { tags?: string[]; type?: string; prefix?: string; limit?: number }
): Promise<OkfDocument[]> {
  const { tags = [], type, prefix, limit = 20 } = opts;

  const keys = await listOkfDocuments(bucket, prefix);
  const results: OkfDocument[] = [];

  for (const { key } of keys) {
    if (!key.endsWith('.md')) continue;
    if (results.length >= limit) break;

    const doc = await getOkfDocument(bucket, key);
    if (!doc) continue;

    // Filter by type if specified
    if (type && doc.frontmatter.type !== type) continue;

    // Filter by tags (any match)
    if (tags.length > 0) {
      const docTags = (doc.frontmatter.tags as string[] | undefined) ?? [];
      const hasMatch = tags.some((t) => docTags.includes(t));
      if (!hasMatch) continue;
    }

    results.push(doc);
  }

  return results;
}

/**
 * Get an OKF framework document by its category slug (e.g. "peter_lynch").
 * Convention: frameworks are stored at "frameworks/{category}.md"
 */
export async function getFrameworkByCategory(
  bucket: R2Bucket,
  category: string
): Promise<OkfDocument | null> {
  return getOkfDocument(bucket, `frameworks/${category}.md`);
}
