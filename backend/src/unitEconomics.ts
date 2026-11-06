/**
 * unitEconomics.ts — Domain Models, Deterministic Parsers, and AI Extraction
 * for Business Model & Unit Economics Matrix (ADR-0020)
 */

export interface RevenueSegmentItem {
  readonly name: string;
  readonly sharePct: number | null;
  readonly revenueMillions: number | null;
  readonly revenueDisplay: string | null;
  readonly isImpliedRevenue?: boolean;
  readonly yoyGrowthPct: number | null;
  readonly marginPct: number | null;
  readonly marginType?: 'Gross Margin' | 'Operating Margin' | 'EBITDA Margin' | null;
  readonly drivers?: string | null;
}

export interface UnitEconomicMetricItem {
  readonly label: string;
  readonly value: string;
  readonly changeDisplay: string | null;
  readonly changeDirection?: 'up' | 'down' | 'neutral';
  readonly progressPct?: number | null;
  readonly category?: 'volume' | 'monetization' | 'retention' | 'efficiency';
  readonly context?: string | null;
}

export interface BusinessModelMatrix {
  readonly archetype: string | null;
  readonly summary: string | null;
  readonly periodLabel: string | null;
  readonly asOfDate: string | null;
  readonly segments: readonly RevenueSegmentItem[];
  readonly unitEconomics: readonly UnitEconomicMetricItem[];
  readonly source: 'mcp' | 'ai_extracted' | 'parsed';
}

/**
 * Format currency amount in millions into human readable format (e.g. $836M, $1.2B)
 */
export function formatMillionsCurrency(millions: number | null | undefined): string | null {
  if (millions === null || millions === undefined || isNaN(millions)) return null;
  const abs = Math.abs(millions);
  const sign = millions < 0 ? '-' : '';
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}B`;
  }
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}M`;
}

/**
 * Clean and normalize text from markdown / symbols
 */
function cleanSegmentText(str: string): string {
  return str.replace(/[*_#`]/g, '').trim();
}

/**
 * Parses revenue segments from qualitative business_model description.
 * Supports patterns like:
 * "1) Subscription Solutions (สัดส่วน 22.4% ของรายได้รวม Gross Margin สูง 79.7%) คิดค่าธรรมเนียมซอฟต์แวร์... และ 2) Merchant Solutions (สัดส่วน 77.6%...)"
 * or "(1) Transaction Revenue (51% ของรายได้สุทธิใน Q3 2026 ที่ $590.2 ล้านดอลลาร์) ... และ (2) Subscription & Services (49% ...)"
 */
export function parseSegmentsFromText(
  text: string,
  latestQuarterlyRevenueMillions: number | null = null
): RevenueSegmentItem[] {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  const segments: RevenueSegmentItem[] = [];

  // Match numbered segments: 1) or (1) or 1.
  const regex = /(?:^|\s)(?:[1-9]\)|\([1-9]\)|[1-9]\.)\s+/g;
  const splitIndices: { index: number; length: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = regex.exec(trimmed)) !== null) {
    splitIndices.push({ index: m.index, length: m[0].length });
  }

  if (splitIndices.length > 0) {
    for (let i = 0; i < splitIndices.length; i++) {
      const start = splitIndices[i].index + splitIndices[i].length;
      const end = i + 1 < splitIndices.length ? splitIndices[i + 1].index : trimmed.length;
      const chunk = trimmed.substring(start, end).trim();
      if (!chunk) continue;
      const seg = parseSingleSegmentChunk(chunk, latestQuarterlyRevenueMillions);
      if (seg) {
        segments.push(seg);
      }
    }
  } else {
    // If no 1) 2) markers, try matching clauses containing percentage shares e.g. "สัดส่วน XX.X%"
    const shareMatches = Array.from(trimmed.matchAll(/([^:.;\n]+?(?:สัดส่วน|คิดเป็นสัดส่วน|สัดส่วนรายได้)\s*~?\s*\d+(?:\.\d+)?%[^:.;\n]*)/g));
    for (const sm of shareMatches) {
      const chunk = sm[1]?.trim() || '';
      const seg = parseSingleSegmentChunk(chunk, latestQuarterlyRevenueMillions);
      if (seg) {
        segments.push(seg);
      }
    }
  }

  return segments;
}

function parseSingleSegmentChunk(
  chunk: string,
  latestQuarterlyRevenueMillions: number | null
): RevenueSegmentItem | null {
  // 1. Extract Name: usually before the first parenthesis or colon
  let name = '';
  const colonIdx = chunk.indexOf(':');
  const parenIdx = chunk.indexOf('(');

  if (parenIdx !== -1 && (colonIdx === -1 || parenIdx < colonIdx)) {
    name = cleanSegmentText(chunk.substring(0, parenIdx));
  } else if (colonIdx !== -1) {
    name = cleanSegmentText(chunk.substring(0, colonIdx));
  } else {
    // Take first few words
    const words = chunk.split(/\s+/).slice(0, 4).join(' ');
    name = cleanSegmentText(words);
  }

  if (!name || name.length > 60) {
    name = cleanSegmentText(chunk.slice(0, 40));
  }

  // 2. Extract Share Percentage: e.g. "สัดส่วน 22.4%", "51% ของรายได้", "~83%"
  let sharePct: number | null = null;
  const shareMatch = chunk.match(/(?:สัดส่วน|คิดเป็นสัดส่วน|สัดส่วนรายได้)?\s*~?\s*(\d+(?:\.\d+)?)\s*%\s*(?:ของรายได้|ของรายได้รวม|ของรายได้สุทธิ)?/);
  if (shareMatch) {
    const parsedPct = parseFloat(shareMatch[1]);
    if (!isNaN(parsedPct) && parsedPct > 0 && parsedPct <= 100) {
      sharePct = parsedPct;
    }
  }

  // 3. Extract Revenue Amount in Millions if explicitly mentioned:
  // e.g. "$590.2 ล้านดอลลาร์", "$836 ล้าน", "$3,637.1M", "$96,302 ล้านดอลลาร์", "$114.3M", "63.9 พันล้านดอลลาร์"
  let revenueMillions: number | null = null;
  let revenueDisplay: string | null = null;
  let isImpliedRevenue = false;

  const revMatchBillion = chunk.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:พันล้านดอลลาร์|พันล้าน|B|Billion)/i);
  const revMatchMillion = chunk.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:ล้านดอลลาร์|ล้าน|M|Million)/i);

  if (revMatchBillion) {
    const rawNum = parseFloat(revMatchBillion[1].replace(/,/g, ''));
    if (!isNaN(rawNum)) {
      revenueMillions = Math.round(rawNum * 1000);
      revenueDisplay = `$${rawNum.toFixed(1)}B`;
    }
  } else if (revMatchMillion) {
    const rawNum = parseFloat(revMatchMillion[1].replace(/,/g, ''));
    if (!isNaN(rawNum)) {
      revenueMillions = Math.round(rawNum);
      revenueDisplay = `$${Math.round(rawNum).toLocaleString('en-US')}M`;
    }
  }

  // Implied Revenue calculation if sharePct is known and total revenue is known
  if (revenueMillions === null && sharePct !== null && latestQuarterlyRevenueMillions && latestQuarterlyRevenueMillions > 0) {
    revenueMillions = Math.round((sharePct / 100) * latestQuarterlyRevenueMillions);
    revenueDisplay = formatMillionsCurrency(revenueMillions);
    isImpliedRevenue = true;
  }

  // 4. Extract YoY Growth Percentage: e.g. "โต 103% YoY", "+22% YoY", "เติบโต 35% YoY", "เติบโต 30% YoY", "+19.6% YoY"
  let yoyGrowthPct: number | null = null;
  const growthMatch = chunk.match(/(?:\+|เติบโต|โต|ขยายตัว)?\s*(\+?-?\d+(?:\.\d+)?)\s*%\s*YoY/i);
  if (growthMatch) {
    const rawGrowth = parseFloat(growthMatch[1]);
    if (!isNaN(rawGrowth)) {
      yoyGrowthPct = rawGrowth;
    }
  }

  // 5. Extract Margin & Margin Type:
  // e.g. "Gross Margin สูง 79.7%", "Gross Margin 38.4%", "Operating Margin ที่ 36.2%", "Non-GAAP Gross Margin 98.1%"
  let marginPct: number | null = null;
  let marginType: 'Gross Margin' | 'Operating Margin' | 'EBITDA Margin' | null = null;

  const gmMatch = chunk.match(/(?:Gross\s*Margin|กำไรขั้นต้น|อัตรากำไรขั้นต้น)[^\d%]{0,30}?(\d+(?:\.\d+)?)\s*%/i);
  const opMatch = chunk.match(/(?:Operating\s*Margin|กำไรจากการดำเนินงาน|อัตรากำไรจากการดำเนินงาน)[^\d%]{0,30}?(\d+(?:\.\d+)?)\s*%/i);
  const ebitdaMatch = chunk.match(/EBITDA\s*Margin[^\d%]{0,30}?(\d+(?:\.\d+)?)\s*%/i);

  if (gmMatch) {
    marginPct = parseFloat(gmMatch[1]);
    marginType = 'Gross Margin';
  } else if (opMatch) {
    marginPct = parseFloat(opMatch[1]);
    marginType = 'Operating Margin';
  } else if (ebitdaMatch) {
    marginPct = parseFloat(ebitdaMatch[1]);
    marginType = 'EBITDA Margin';
  }

  // 6. Extract Drivers / Mechanisms (the remaining explanation)
  let drivers: string | null = null;
  if (parenIdx !== -1) {
    const afterParen = chunk.substring(parenIdx);
    const closeParenIdx = afterParen.lastIndexOf(')');
    if (closeParenIdx !== -1 && closeParenIdx + 1 < afterParen.length) {
      drivers = cleanSegmentText(afterParen.substring(closeParenIdx + 1));
    } else {
      drivers = cleanSegmentText(chunk);
    }
  } else {
    drivers = cleanSegmentText(chunk);
  }

  if (drivers && drivers.length > 150) {
    drivers = drivers.substring(0, 147) + '...';
  }

  return {
    name,
    sharePct,
    revenueMillions,
    revenueDisplay,
    isImpliedRevenue: isImpliedRevenue || undefined,
    yoyGrowthPct,
    marginPct,
    marginType,
    drivers: drivers || null,
  };
}

/**
 * Parses quantitative Unit Economics items from thesis_kpis array.
 * Examples:
 * - "Gross Merchandise Volume (GMV): ล่าสุด Q2 2026 อยู่ที่ $115.567 พันล้าน (+32% YoY) ต้องติดตามการเติบโตไม่ให้ต่ำกว่า 25-30% YoY"
 * - "Gross Payments Volume (GPV) Penetration Rate: อัตราการประมวลผลผ่าน Shopify Payments ล่าสุดอยู่ที่ 68% ($78.1 พันล้าน เติบโต +38% YoY)"
 * - "Monthly Recurring Revenue (MRR): รายได้ประจำรายเดือนล่าสุดแตะ $212 ล้านใน Q1 2026 เติบโตเฉลี่ย 19% 5-Year CAGR และโต 19% YoY ใน Q2 2026"
 * - "Attach Rate: สัดส่วนรายได้ต่อปริมาณ GMV รวม ทรงตัวที่ระดับ 3.10%"
 */
export function parseUnitEconomicsFromKpis(kpis: readonly string[] | string | null | undefined): UnitEconomicMetricItem[] {
  if (!kpis) return [];

  let kpiList: string[] = [];
  if (Array.isArray(kpis)) {
    kpiList = kpis.map(String).map((s) => s.trim()).filter(Boolean);
  } else if (typeof kpis === 'string') {
    const trimmed = kpis.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          kpiList = parsed.map(String).map((s) => s.trim()).filter(Boolean);
        }
      } catch {
        kpiList = trimmed.split('\n').map((s) => s.trim()).filter(Boolean);
      }
    } else {
      kpiList = trimmed.split('\n').map((s) => s.trim()).filter(Boolean);
    }
  }

  const items: UnitEconomicMetricItem[] = [];

  for (const raw of kpiList) {
    const cleaned = cleanSegmentText(raw.replace(/^[-*•\d.]+\s*/, ''));
    if (!cleaned) continue;

    // Separate label before colon
    const colonIdx = cleaned.indexOf(':');
    let label = cleaned;
    let detail = '';

    if (colonIdx !== -1) {
      label = cleanSegmentText(cleaned.substring(0, colonIdx));
      detail = cleanSegmentText(cleaned.substring(colonIdx + 1));
    } else {
      detail = cleaned;
    }

    // Extract Hero Value: e.g. "$115.567 พันล้าน", "$115.6B", "68%", "3.10%", "$212 ล้าน", "92% - 97%", "$677B", "103%"
    let value = '—';
    let progressPct: number | null = null;

    const isRateMetric = /rate|penetration|retention|churn|margin|share|สัดส่วน|อัตรา/i.test(label);
    const pctRangeMatch = detail.match(/(\d+(?:\.\d+)?\s*%\s*(?:-\s*\d+(?:\.\d+)?\s*%)?)/);
    const currMatchBillion = detail.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:พันล้านดอลลาร์|พันล้าน|B|Billion)/i);
    const currMatchMillion = detail.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:ล้านดอลลาร์|ล้าน|M|Million)/i);
    const simpleNumMatch = detail.match(/(\d+(?:\.\d+)?\s*(?:x|เท่า|ล้านคน|คน|ล้านราย|ราย))/i);

    if (isRateMetric && pctRangeMatch) {
      value = pctRangeMatch[1].trim();
      const firstPct = parseFloat(value);
      if (!isNaN(firstPct) && firstPct >= 0 && firstPct <= 100) {
        progressPct = Math.round(firstPct);
      }
    } else if (currMatchBillion) {
      const num = parseFloat(currMatchBillion[1].replace(/,/g, ''));
      value = !isNaN(num) ? `$${num.toFixed(1)}B` : currMatchBillion[0];
    } else if (currMatchMillion) {
      const num = parseFloat(currMatchMillion[1].replace(/,/g, ''));
      value = !isNaN(num) ? `$${Math.round(num).toLocaleString('en-US')}M` : currMatchMillion[0];
    } else if (pctRangeMatch) {
      value = pctRangeMatch[1].trim();
      const firstPct = parseFloat(value);
      if (!isNaN(firstPct) && firstPct >= 0 && firstPct <= 100) {
        progressPct = Math.round(firstPct);
      }
    } else if (simpleNumMatch) {
      value = simpleNumMatch[1].trim();
    } else {
      // Fallback: look for first standalone number or metric word
      const fallbackNum = detail.match(/(?:อยู่ที่|แตะ|ระดับ|ที่)?\s*([$¥€]?[\d,]+(?:\.\d+)?\s*[%BBMKx]?)/i);
      if (fallbackNum && fallbackNum[1]) {
        value = fallbackNum[1].trim();
      }
    }

    // Extract Change Display: e.g. "+32% YoY", "+38% YoY", "โต 19% YoY", "+22.5% YoY"
    let changeDisplay: string | null = null;
    let changeDirection: 'up' | 'down' | 'neutral' = 'neutral';

    const yoyMatch = detail.match(/(?:\(|,\s*)?(?:\+|โต|เติบโต)?\s*(\+?-?\d+(?:\.\d+)?)\s*%\s*YoY(?:\)|,)?/i);
    if (yoyMatch) {
      const rawNum = parseFloat(yoyMatch[1]);
      if (!isNaN(rawNum)) {
        changeDisplay = `${rawNum > 0 ? '+' : ''}${rawNum}% YoY`;
        changeDirection = rawNum > 0 ? 'up' : rawNum < 0 ? 'down' : 'neutral';
      }
    }

    // Categorize
    let category: 'volume' | 'monetization' | 'retention' | 'efficiency' = 'monetization';
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('volume') || lowerLabel.includes('gmv') || lowerLabel.includes('gpv') || lowerLabel.includes('dau') || lowerLabel.includes('mau') || lowerLabel.includes('users') || lowerLabel.includes('traffic')) {
      category = 'volume';
    } else if (lowerLabel.includes('retention') || lowerLabel.includes('churn') || lowerLabel.includes('mrr') || lowerLabel.includes('arr') || lowerLabel.includes('rpo') || lowerLabel.includes('backlog')) {
      category = 'retention';
    } else if (lowerLabel.includes('margin') || lowerLabel.includes('leverage') || lowerLabel.includes('fcf') || lowerLabel.includes('ebitda') || lowerLabel.includes('capex')) {
      category = 'efficiency';
    }

    items.push({
      label,
      value,
      changeDisplay,
      changeDirection,
      progressPct,
      category,
      context: detail && detail !== value ? detail : null,
    });
  }

  return items;
}

/**
 * Extracts business archetype title from business_model description.
 * Examples:
 * - "Shopify ดำเนินธุรกิจในฐานะระบบปฏิบัติการด้านพาณิชย์ครบวงจร (Unified Commerce Operating System) ผ่าน 2 โมเดล..." -> "Unified Commerce Operating System"
 * - "Coinbase ... 'โครงสร้างพื้นฐานทางการเงินและสินทรัพย์ดิจิทัลระดับสถาบันแบบครบวงจร' (Full-Stack On-chain Financial Infrastructure & Everything Exchange)" -> "Full-Stack On-chain Financial Infrastructure"
 * - "Arm Holdings ดำเนินธุรกิจแบบ Pure-play Semiconductor IP & Architecture Licensing..." -> "Pure-play Semiconductor IP & Architecture Licensing"
 */
export function extractArchetype(text?: string | null): string | null {
  if (!text) return null;
  const matchParenEng = text.match(/\((Full-Stack[^)]+|Unified Commerce[^)]+|Agentic Commerce[^)]+|Pure-play[^)]+|Single System of Record[^)]+|Everything Exchange[^)]+)\)/i);
  if (matchParenEng) {
    return matchParenEng[1].trim();
  }

  const matchQuotes = text.match(/['"]([^'"]{10,60})['"]/);
  if (matchQuotes) {
    return matchQuotes[1].trim();
  }

  const matchInParen = text.match(/\(([A-Za-z\s&-]{8,50})\)/);
  if (matchInParen) {
    return matchInParen[1].trim();
  }

  return null;
}

export interface ParseBriefParams {
  readonly businessModel?: string | null;
  readonly thesisKpis?: readonly string[] | string | null;
  readonly asOfDate?: string | null;
  readonly latestQuarterlyRevenueMillions?: number | null;
  readonly latestPeriodLabel?: string | null;
}

/**
 * Pure Deterministic Parser: Transforms raw business_model text & thesis_kpis
 * into structured BusinessModelMatrix with Implied Revenue computation.
 */
export function parseBusinessModelMatrixFromBrief({
  businessModel,
  thesisKpis,
  asOfDate = null,
  latestQuarterlyRevenueMillions = null,
  latestPeriodLabel = null,
}: ParseBriefParams): BusinessModelMatrix | null {
  if (!businessModel && !thesisKpis) {
    return null;
  }

  const archetype = extractArchetype(businessModel);
  const segments = parseSegmentsFromText(businessModel || '', latestQuarterlyRevenueMillions);
  const unitEconomics = parseUnitEconomicsFromKpis(thesisKpis);

  if (segments.length === 0 && unitEconomics.length === 0) {
    return null;
  }

  return {
    archetype,
    summary: businessModel ? cleanSegmentText(businessModel) : null,
    periodLabel: latestPeriodLabel,
    asOfDate,
    segments,
    unitEconomics,
    source: 'parsed',
  };
}

/**
 * Enriches existing BusinessModelMatrix segments with Implied Revenue
 * if sharePct is known and total revenue is available.
 */
export function enrichSegmentsWithImpliedRevenue(
  matrix: BusinessModelMatrix,
  latestQuarterlyRevenueMillions: number | null,
  latestPeriodLabel?: string | null
): BusinessModelMatrix {
  if (!latestQuarterlyRevenueMillions || latestQuarterlyRevenueMillions <= 0) {
    return matrix;
  }

  const enrichedSegments = matrix.segments.map((seg) => {
    if (seg.revenueMillions === null && seg.sharePct !== null && seg.sharePct > 0) {
      const impliedM = Math.round((seg.sharePct / 100) * latestQuarterlyRevenueMillions);
      return {
        ...seg,
        revenueMillions: impliedM,
        revenueDisplay: formatMillionsCurrency(impliedM),
        isImpliedRevenue: true,
      };
    }
    return seg;
  });

  return {
    ...matrix,
    periodLabel: matrix.periodLabel || latestPeriodLabel || null,
    segments: enrichedSegments,
  };
}

/**
 * Normalizes raw matrix payload into canonical BusinessModelMatrix.
 * Handles both snake_case (e.g. from Gemini MCP save_fundamental_brief)
 * and camelCase (e.g. from AI deep extract / internal types).
 */
export function normalizeBusinessModelMatrix(
  raw: any,
  fallbackPeriodLabel?: string | null
): BusinessModelMatrix | null {
  if (!raw || typeof raw !== 'object') return null;

  const rawSegments = Array.isArray(raw.segments) ? raw.segments : [];
  const rawKpis = Array.isArray(raw.unitEconomics)
    ? raw.unitEconomics
    : Array.isArray(raw.unit_economics)
      ? raw.unit_economics
      : [];

  if (rawSegments.length === 0 && rawKpis.length === 0) {
    return null;
  }

  const segments: RevenueSegmentItem[] = rawSegments.map((seg: any) => {
    const name = typeof seg?.name === 'string' ? seg.name.trim() : 'Segment';
    const sharePct = typeof seg?.sharePct === 'number'
      ? seg.sharePct
      : typeof seg?.share_pct === 'number'
        ? seg.share_pct
        : null;
    const revenueMillions = typeof seg?.revenueMillions === 'number'
      ? seg.revenueMillions
      : typeof seg?.revenue_millions === 'number'
        ? seg.revenue_millions
        : null;
    const revenueDisplay = typeof seg?.revenueDisplay === 'string'
      ? seg.revenueDisplay
      : typeof seg?.revenue_display === 'string'
        ? seg.revenue_display
        : formatMillionsCurrency(revenueMillions);
    const yoyGrowthPct = typeof seg?.yoyGrowthPct === 'number'
      ? seg.yoyGrowthPct
      : typeof seg?.yoy_growth_pct === 'number'
        ? seg.yoy_growth_pct
        : null;
    const marginPct = typeof seg?.marginPct === 'number'
      ? seg.marginPct
      : typeof seg?.margin_pct === 'number'
        ? seg.margin_pct
        : null;
    const marginType = seg?.marginType || seg?.margin_type || null;
    const drivers = seg?.drivers ? String(seg.drivers).trim() : null;
    const isImpliedRevenue = Boolean(seg?.isImpliedRevenue ?? seg?.is_implied_revenue);

    return {
      name,
      sharePct,
      revenueMillions,
      revenueDisplay,
      isImpliedRevenue,
      yoyGrowthPct,
      marginPct,
      marginType,
      drivers,
    };
  });

  const unitEconomics: UnitEconomicMetricItem[] = rawKpis.map((kpi: any) => {
    const label = typeof kpi?.label === 'string' ? kpi.label.trim() : '';
    const value = typeof kpi?.value === 'string' ? kpi.value.trim() : String(kpi?.value ?? '');
    const changeDisplay = typeof kpi?.changeDisplay === 'string'
      ? kpi.changeDisplay
      : typeof kpi?.change_display === 'string'
        ? kpi.change_display
        : null;
    const changeDirection = kpi?.changeDirection || kpi?.change_direction || undefined;
    const progressPct = typeof kpi?.progressPct === 'number'
      ? kpi.progressPct
      : typeof kpi?.progress_pct === 'number'
        ? kpi.progress_pct
        : null;
    const category = kpi?.category || undefined;
    const context = kpi?.context ? String(kpi.context).trim() : null;

    return {
      label,
      value,
      changeDisplay,
      changeDirection,
      progressPct,
      category,
      context,
    };
  });

  const archetype = raw.archetype ? String(raw.archetype).trim() : null;
  const summary = raw.summary ? String(raw.summary).trim() : null;
  const periodLabel = raw.periodLabel || raw.period_label || fallbackPeriodLabel || null;
  const asOfDate = raw.asOfDate || raw.as_of_date || null;
  const source = raw.source === 'ai_extracted' || raw.source === 'parsed' ? raw.source : 'mcp';

  return {
    archetype,
    summary,
    periodLabel,
    asOfDate,
    segments,
    unitEconomics,
    source,
  };
}

/**
 * Resolves BusinessModelMatrix from stock_fundamentals row:
 * Prioritizes unit_economics_json (from MCP / AI), falling back to deterministic parser.
 */
export function resolveBusinessModelMatrix(
  fundamentalRow: any,
  latestQuarterlyRevenueMillions: number | null = null,
  latestPeriodLabel: string | null = null
): BusinessModelMatrix | null {
  if (!fundamentalRow) return null;

  if (fundamentalRow.unit_economics_json) {
    try {
      const cached = typeof fundamentalRow.unit_economics_json === 'string'
        ? JSON.parse(fundamentalRow.unit_economics_json)
        : fundamentalRow.unit_economics_json;

      const normalized = normalizeBusinessModelMatrix(cached, latestPeriodLabel);
      if (normalized) {
        return enrichSegmentsWithImpliedRevenue(normalized, latestQuarterlyRevenueMillions, latestPeriodLabel);
      }
    } catch (err) {
      console.warn(`[resolveBusinessModelMatrix] Corrupt unit_economics_json for ${fundamentalRow.symbol}:`, err);
    }
  }

  return parseBusinessModelMatrixFromBrief({
    businessModel: fundamentalRow.business_model,
    thesisKpis: fundamentalRow.thesis_kpis,
    asOfDate: fundamentalRow.as_of_date,
    latestQuarterlyRevenueMillions,
    latestPeriodLabel,
  });
}

/**
 * Deep AI Extraction using Workers AI (Gemma 4 26B)
 * Synthesizes business_model, thesis_kpis, deep value analysis report, and stock thesis.
 */
export async function extractBusinessModelMatrixWithAI(
  env: any,
  rawSymbol: string
): Promise<BusinessModelMatrix> {
  const symbol = rawSymbol.trim().toUpperCase();

  // 1. Fetch relevant qualitative records and financial overview from D1
  const [fundamentalRow, reportRow, thesisRow, marketStatsRow] = await Promise.all([
    env.DB.prepare('SELECT * FROM stock_fundamentals WHERE symbol = ?').bind(symbol).first().catch(() => null),
    env.DB.prepare("SELECT summary FROM analysis_results WHERE symbol = ? AND summary IS NOT NULL AND summary != '' ORDER BY created_at DESC LIMIT 1").bind(symbol).first().catch(() => null),
    env.DB.prepare('SELECT note FROM stock_theses WHERE symbol = ? ORDER BY created_at DESC LIMIT 1').bind(symbol).first().catch(() => null),
    env.DB.prepare('SELECT overview_json FROM market_stats WHERE symbol = ?').bind(symbol).first().catch(() => null),
  ]);

  let latestQuarterlyRevenue: number | null = null;
  let latestPeriodLabel: string | null = null;
  if (marketStatsRow?.overview_json) {
    try {
      const parsed = JSON.parse(marketStatsRow.overview_json);
      if (Array.isArray(parsed.quarterly) && parsed.quarterly.length > 0) {
        const lastQ = parsed.quarterly[parsed.quarterly.length - 1];
        latestQuarterlyRevenue = lastQ.totalRevenue ?? null;
        latestPeriodLabel = lastQ.period ?? null;
      }
    } catch {}
  }

  const businessModelText = fundamentalRow?.business_model || '';
  const thesisKpisText = fundamentalRow?.thesis_kpis || '';
  const reportSummary = reportRow?.summary || '';
  const thesisNote = thesisRow?.note || '';

  // If no source text exists, return empty fallback
  if (!businessModelText && !reportSummary && !thesisNote) {
    throw new Error(`No fundamental research, report, or thesis found for ${symbol} to extract.`);
  }

  const prompt = `You are a Senior Wall Street Equity Research Analyst specializing in Business Model Architecture and Unit Economics.
Extract the granular Business Model & Unit Economics Matrix for ${symbol} from the primary sources provided below into valid JSON.

Company Symbol: ${symbol}
Latest Quarterly Total Revenue: ${latestQuarterlyRevenue ? `$${latestQuarterlyRevenue}M (${latestPeriodLabel})` : 'Unknown'}

Primary Sources:
---
[Business Model]:
${businessModelText}

[Thesis KPIs]:
${thesisKpisText}

[Deep Value Analysis Report Excerpt]:
${reportSummary.slice(0, 1500)}

[Thesis Notes Excerpt]:
${thesisNote.slice(0, 1000)}
---

Strict JSON Output Schema:
{
  "archetype": "High-level business categorization (e.g. 'Unified Commerce Operating System', 'Pure-play Semiconductor IP')",
  "summary": "1-2 sentence core monetization synthesis in English or Thai",
  "periodLabel": "${latestPeriodLabel || 'Latest Quarter'}",
  "asOfDate": "${fundamentalRow?.as_of_date || new Date().toISOString().split('T')[0]}",
  "segments": [
    {
      "name": "Segment Name (e.g. 'Subscription Solutions', 'Merchant Solutions')",
      "sharePct": 22.4,
      "revenueMillions": 836,
      "revenueDisplay": "$836M",
      "yoyGrowthPct": 19.6,
      "marginPct": 79.7,
      "marginType": "Gross Margin",
      "drivers": "Key pricing tiers or monetization engines (e.g. Basic $29/mo to Plus $2,300/mo)"
    }
  ],
  "unitEconomics": [
    {
      "label": "Metric Name (e.g. 'Gross Merchandise Volume (GMV)', 'Attach Rate', 'MRR')",
      "value": "Metric Hero Value (e.g. '$115.6B', '3.10%', '$212M', '68%')",
      "changeDisplay": "+32% YoY",
      "changeDirection": "up",
      "progressPct": 68,
      "category": "volume | monetization | retention | efficiency",
      "context": "Brief benchmark or monitoring checkpoint"
    }
  ]
}

Return ONLY valid JSON matching this schema with NO markdown wrapping or commentary.`;

  const aiModel = env.default_ai_model || '@cf/google/gemma-4-26b-a4b-it';
  const aiResult: any = await env.AI.run(aiModel, {
    prompt,
    response_format: { type: 'json_object' },
  });

  let rawJson = aiResult?.response ?? aiResult;
  let parsedMatrix: any = null;

  if (typeof rawJson === 'string') {
    try {
      parsedMatrix = JSON.parse(rawJson);
    } catch {
      // Clean possible markdown code fences
      const clean = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedMatrix = JSON.parse(clean);
    }
  } else if (typeof rawJson === 'object' && rawJson !== null) {
    parsedMatrix = rawJson;
  }

  if (!parsedMatrix || !Array.isArray(parsedMatrix.segments)) {
    throw new Error(`AI extraction failed to generate a valid segments array for ${symbol}`);
  }

  const finalMatrix: BusinessModelMatrix = {
    archetype: parsedMatrix.archetype || extractArchetype(businessModelText),
    summary: parsedMatrix.summary || cleanSegmentText(businessModelText),
    periodLabel: parsedMatrix.periodLabel || latestPeriodLabel || null,
    asOfDate: parsedMatrix.asOfDate || fundamentalRow?.as_of_date || new Date().toISOString().split('T')[0],
    segments: parsedMatrix.segments || [],
    unitEconomics: parsedMatrix.unitEconomics || [],
    source: 'ai_extracted',
  };

  // Enrich with implied revenue if any segment has percentage but missing dollar amount
  const enriched = enrichSegmentsWithImpliedRevenue(finalMatrix, latestQuarterlyRevenue, latestPeriodLabel);

  // Cache back to D1 stock_fundamentals.unit_economics_json
  try {
    const serialized = JSON.stringify(enriched);
    await env.DB.prepare(
      'UPDATE stock_fundamentals SET unit_economics_json = ?, updated_at = (datetime(\'now\')) WHERE symbol = ?'
    ).bind(serialized, symbol).run();
  } catch (dbErr) {
    console.warn(`[extractBusinessModelMatrixWithAI] Error saving unit_economics_json to D1 for ${symbol}:`, dbErr);
  }

  return enriched;
}
