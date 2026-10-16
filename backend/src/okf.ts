/**
 * okf.ts — OKF (Open Knowledge Format) Parser + Cloudflare R2 Reader
 *
 * Reads OKF Markdown files from R2, parses YAML frontmatter, provides
 * tag-based search for the Oaktree Agent knowledge base, and supports
 * serialization and parsing of fundamental research briefs (ADR 0010).
 */

import type { GuidanceInfo, StockFundamental } from './fundamentals';
export type { GuidanceInfo, StockFundamental };

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
  as_of_date?: string;
  source_count?: number;
  notebook_id?: string;
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
 * Normalizes array inputs from string[], JSON string, or multiline newline string
 */
export function normalizeArrayField(field: unknown): string[] {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof field === 'string') {
    const trimmed = field.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(String).map((s) => s.trim()).filter(Boolean);
        }
      } catch {
        // Fall through if not valid JSON
      }
    }
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return [];
        }
      } catch {
        // Fall through if not valid JSON
      }
    }
    return trimmed
      .split('\n')
      .map((line) => line.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Normalizes guidance inputs from GuidanceInfo object, JSON string, or raw text
 */
export function normalizeGuidanceField(field: unknown): GuidanceInfo | string | null {
  if (!field) return null;
  if (typeof field === 'object' && !Array.isArray(field)) {
    return field as GuidanceInfo;
  }
  if (typeof field === 'string') {
    const trimmed = field.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed as GuidanceInfo;
        }
      } catch {
        // Fall through to returning raw string
      }
    }
    return trimmed;
  }
  return null;
}

/**
 * Canonical fallback placeholder strings used in OKF documents for empty/sparse fields.
 */
export const OKF_FALLBACK_PLACEHOLDERS = {
  business_model: '_No business model summary provided._',
  moat: '_No competitive moat analysis provided._',
  guidance: '_No formal management guidance documented._',
  key_risks: '_No key risks specified._',
  thesis_kpis: '_No thesis KPIs specified._',
} as const;

/**
 * Checks whether a field value matches an expected placeholder string.
 * Normalizes leading/trailing markdown italics (_), asterisks (*), quotes, periods, and casing.
 */
export function isPlaceholder(val: string | null | undefined, expectedPlaceholder: string): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  if (trimmed === expectedPlaceholder) return true;

  const normalize = (s: string) =>
    s
      .trim()
      .replace(/^[_*"'`]+|[_*"'`]+$/g, '')
      .replace(/\.+$/, '')
      .trim()
      .toLowerCase();

  return normalize(trimmed) === normalize(expectedPlaceholder);
}

/**
 * Safely escapes regular expression special characters.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates an exact line-anchored regular expression for a markdown heading.
 * Matches line start, optional leading spaces/tabs, hashes, whitespace, exact title, trailing spaces, line end.
 */
export function createHeadingRegex(heading: string): RegExp {
  const m = heading.match(/^(#+)\s*(.*)$/);
  const hashes = m ? m[1] : '##';
  const title = m ? m[2] : heading;
  return new RegExp(
    `^[ \\t]*${escapeRegex(hashes)}[ \\t]+${escapeRegex(title)}[ \\t]*(?:\\r?\\n|$)`,
    'gm'
  );
}

export interface HeadingMatch {
  startIndex: number;
  endIndex: number;
}

/**
 * Finds the first line-anchored occurrence of a markdown heading starting at or after fromIndex.
 */
export function findHeadingMatch(text: string, heading: string, fromIndex = 0): HeadingMatch | null {
  const re = createHeadingRegex(heading);
  re.lastIndex = fromIndex;
  const match = re.exec(text);
  if (!match) return null;
  return {
    startIndex: match.index,
    endIndex: match.index + match[0].length,
  };
}

export const OKF_CANONICAL_SECTIONS = [
  '## Business Model',
  '## Competitive Moat',
  '## Management Guidance',
  '## Key Risks',
  '## Thesis KPIs',
] as const;

/**
 * Sanitizes a scalar string for safe single-line YAML frontmatter insertion.
 * - Strips carriage returns and newlines (\r, \n) to prevent YAML line injection
 * - Converts double quotes to single quotes to prevent breaking out of quoted strings
 * - Strips trailing unescaped backslashes to avoid escaping the closing quote
 * - Trims leading and trailing whitespace
 */
export function sanitizeYamlScalar(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, "'")
    .replace(/\\+$/, '')
    .trim();
}

/**
 * Serializes a StockFundamental record into a valid OKF Markdown document.
 * Compatible with parseOkfFrontmatter.
 */
export function stockFundamentalToOkf(data: StockFundamental): string {
  const symbol = sanitizeYamlScalar(data.symbol).toUpperCase();
  const rawAsOf = sanitizeYamlScalar(data.as_of_date);
  const asOfDate = rawAsOf || new Date().toISOString().split('T')[0];
  const sourceCount = typeof data.source_count === 'number'
    ? data.source_count
    : (parseInt(String(data.source_count || '0'), 10) || 0);
  const rawNotebookId = sanitizeYamlScalar(data.notebook_id);
  const notebookId = rawNotebookId.length > 0 ? rawNotebookId : null;

  // 1. Tags & Description
  const tags = ['fundamental-brief', 'single-stock'];
  if (symbol) {
    const cleanTag = symbol.toLowerCase().replace(/[[\]'",]/g, '').trim();
    if (cleanTag) tags.push(cleanTag);
  }

  const rawDesc = (data.business_model || '').trim().slice(0, 120);
  const description = sanitizeYamlScalar(rawDesc) || `Fundamental brief and qualitative profile for ${symbol}`;

  // 2. YAML Frontmatter Lines
  const frontmatterLines = [
    '---',
    'type: fundamental_brief',
    `symbol: "${symbol}"`,
    `title: "Fundamental Brief: ${symbol}"`,
    `as_of_date: "${asOfDate}"`,
    `source_count: ${sourceCount}`,
    notebookId ? `notebook_id: "${notebookId}"` : null,
    `tags: [${tags.join(', ')}]`,
    `timestamp: "${asOfDate}"`,
    `description: "${description}"`,
    '---',
  ].filter(Boolean);

  // 3. Subtitle / Metadata Badge
  const metaBadgeParts = [
    `**As of**: ${asOfDate}`,
    `**Sources Analyzed**: ${sourceCount}`,
  ];
  if (notebookId) {
    metaBadgeParts.push(`**Notebook ID**: \`${notebookId}\``);
  }
  const subtitleBadge = `> ${metaBadgeParts.join(' | ')}`;

  // 4. Section: Business Model
  const businessModel = (data.business_model || '').trim();
  const businessModelSec = `## Business Model\n\n${businessModel || OKF_FALLBACK_PLACEHOLDERS.business_model}`;

  // 5. Section: Competitive Moat & Competitors
  const moat = (data.moat || '').trim();
  const competitorsList = normalizeArrayField(data.competitors);
  let moatBody = moat || OKF_FALLBACK_PLACEHOLDERS.moat;
  if (competitorsList.length > 0) {
    moatBody += `\n\n### Key Competitors\n${competitorsList.map((c) => `- ${c}`).join('\n')}`;
  }
  const moatSec = `## Competitive Moat\n\n${moatBody}`;

  // 6. Section: Management Guidance
  const guidance = normalizeGuidanceField(data.guidance);
  let guidanceContent: string = OKF_FALLBACK_PLACEHOLDERS.guidance;
  if (typeof guidance === 'string') {
    guidanceContent = guidance;
  } else if (guidance && typeof guidance === 'object') {
    const lines: string[] = [];
    if (guidance.revenue_target) lines.push(`- **Revenue Target**: ${guidance.revenue_target}`);
    if (guidance.margin_target) lines.push(`- **Margin Target**: ${guidance.margin_target}`);
    if (guidance.timeframe) lines.push(`- **Timeframe**: ${guidance.timeframe}`);
    if (guidance.key_assumptions) lines.push(`- **Key Assumptions**: ${guidance.key_assumptions}`);
    if (guidance.near_term) lines.push(`- **Near-Term Guidance**: ${guidance.near_term}`);
    if (guidance.long_term) lines.push(`- **Long-Term Guidance**: ${guidance.long_term}`);
    if (lines.length > 0) {
      guidanceContent = lines.join('\n');
    }
  }
  const guidanceSec = `## Management Guidance\n\n${guidanceContent}`;

  // 7. Section: Key Risks
  const risksList = normalizeArrayField(data.key_risks);
  const risksContent = risksList.length > 0
    ? risksList.map((r) => `- ${r}`).join('\n')
    : OKF_FALLBACK_PLACEHOLDERS.key_risks;
  const risksSec = `## Key Risks\n\n${risksContent}`;

  // 8. Section: Thesis KPIs
  const kpisList = normalizeArrayField(data.thesis_kpis);
  const kpisContent = kpisList.length > 0
    ? kpisList.map((k) => `- ${k}`).join('\n')
    : OKF_FALLBACK_PLACEHOLDERS.thesis_kpis;
  const kpisSec = `## Thesis KPIs\n\n${kpisContent}`;

  // 9. Assemble Document
  const bodySections = [
    `# Fundamental Brief: ${symbol}`,
    subtitleBadge,
    businessModelSec,
    moatSec,
    guidanceSec,
    risksSec,
    kpisSec,
  ];

  return `${frontmatterLines.join('\n')}\n\n${bodySections.join('\n\n')}\n`;
}

/**
 * Deserializes an OKF Markdown fundamental brief into a typed StockFundamental object.
 * Returns null if the document is not of type 'fundamental_brief' or is missing symbol.
 */
export function parseOkfFundamentalBrief(markdown: string): StockFundamental | null {
  const { frontmatter, body } = parseOkfFrontmatter(markdown);
  if (frontmatter.type !== 'fundamental_brief' || !frontmatter.symbol) {
    return null;
  }

  const symbol = String(frontmatter.symbol).trim().toUpperCase();
  const as_of_date = String(frontmatter.as_of_date || frontmatter.timestamp || '');
  const source_count = parseInt(String(frontmatter.source_count || '0'), 10) || 0;
  const notebook_id = frontmatter.notebook_id ? String(frontmatter.notebook_id).trim() : null;

  // Extract sections from body using line-anchored matching
  const extractSection = (
    heading: string,
    nextHeadings: readonly string[] = OKF_CANONICAL_SECTIONS.filter((h) => h !== heading)
  ): string => {
    const startMatch = findHeadingMatch(body, heading, 0);
    if (!startMatch) return '';
    const afterHeading = startMatch.endIndex;
    let endIdx = body.length;

    for (const next of nextHeadings) {
      const nextMatch = findHeadingMatch(body, next, afterHeading);
      if (nextMatch && nextMatch.startIndex < endIdx) {
        endIdx = nextMatch.startIndex;
      }
    }
    return body.substring(afterHeading, endIdx).trim();
  };

  const businessModelRaw = extractSection('## Business Model');
  const moatRaw = extractSection('## Competitive Moat');
  const guidanceRaw = extractSection('## Management Guidance');
  const risksRaw = extractSection('## Key Risks');
  const kpisRaw = extractSection('## Thesis KPIs');

  // Parse competitors from ### Key Competitors if present (line-anchored)
  let competitors: string[] = [];
  let moatClean = moatRaw;
  const compMatch = findHeadingMatch(moatRaw, '### Key Competitors', 0);
  if (compMatch) {
    moatClean = moatRaw.substring(0, compMatch.startIndex).trim();
    competitors = normalizeArrayField(moatRaw.substring(compMatch.endIndex));
  }

  // Parse guidance if structured
  let guidance: GuidanceInfo | string | null = null;
  const isGuidancePlaceholder = isPlaceholder(guidanceRaw, OKF_FALLBACK_PLACEHOLDERS.guidance);
  if (!isGuidancePlaceholder) {
    if (guidanceRaw.includes('- **')) {
      const guidanceObj: GuidanceInfo = {};
      const lines = guidanceRaw.split('\n');
      for (const line of lines) {
        const mRev = line.match(/- \*\*Revenue Target\*\*:\s*(.*)/i);
        if (mRev) guidanceObj.revenue_target = mRev[1].trim();
        const mMargin = line.match(/- \*\*Margin Target\*\*:\s*(.*)/i);
        if (mMargin) guidanceObj.margin_target = mMargin[1].trim();
        const mTime = line.match(/- \*\*Timeframe\*\*:\s*(.*)/i);
        if (mTime) guidanceObj.timeframe = mTime[1].trim();
        const mAssump = line.match(/- \*\*Key Assumptions\*\*:\s*(.*)/i);
        if (mAssump) guidanceObj.key_assumptions = mAssump[1].trim();
        const mNear = line.match(/- \*\*Near-Term Guidance\*\*:\s*(.*)/i);
        if (mNear) guidanceObj.near_term = mNear[1].trim();
        const mLong = line.match(/- \*\*Long-Term Guidance\*\*:\s*(.*)/i);
        if (mLong) guidanceObj.long_term = mLong[1].trim();
      }
      if (Object.keys(guidanceObj).length > 0) {
        guidance = guidanceObj;
      } else {
        guidance = guidanceRaw;
      }
    } else {
      guidance = guidanceRaw;
    }
  }

  return {
    symbol,
    as_of_date,
    source_count,
    notebook_id,
    business_model: isPlaceholder(businessModelRaw, OKF_FALLBACK_PLACEHOLDERS.business_model)
      ? null
      : businessModelRaw,
    moat: isPlaceholder(moatClean, OKF_FALLBACK_PLACEHOLDERS.moat)
      ? null
      : moatClean,
    competitors,
    guidance,
    key_risks: isPlaceholder(risksRaw, OKF_FALLBACK_PLACEHOLDERS.key_risks)
      ? []
      : normalizeArrayField(risksRaw),
    thesis_kpis: isPlaceholder(kpisRaw, OKF_FALLBACK_PLACEHOLDERS.thesis_kpis)
      ? []
      : normalizeArrayField(kpisRaw),
  };
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
 * Retrieve and parse an OKF fundamental brief directly from R2 storage by ticker symbol.
 * Key convention: fundamentals/{symbol}.md
 */
export async function getFundamentalDoc(
  bucket: R2Bucket,
  symbol: string
): Promise<StockFundamental | null> {
  const normSymbol = (symbol || '').trim().toUpperCase();
  if (!normSymbol) return null;
  const obj = await bucket.get(`fundamentals/${normSymbol}.md`);
  if (!obj) return null;
  const markdown = await obj.text();
  return parseOkfFundamentalBrief(markdown);
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
