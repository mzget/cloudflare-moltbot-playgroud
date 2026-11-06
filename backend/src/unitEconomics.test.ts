import { describe, it, expect } from 'vitest';
import {
  parseBusinessModelMatrixFromBrief,
  parseSegmentsFromText,
  parseUnitEconomicsFromKpis,
  enrichSegmentsWithImpliedRevenue,
  resolveBusinessModelMatrix,
  normalizeBusinessModelMatrix,
  formatMillionsCurrency,
  extractArchetype,
} from './unitEconomics';

describe('unitEconomics Domain & Parser', () => {
  const shopifyBusinessModel = `Shopify ดำเนินธุรกิจในฐานะระบบปฏิบัติการด้านพาณิชย์ครบวงจร (Unified Commerce Operating System) ผ่าน 2 โมเดลรายได้หลัก: 1) Subscription Solutions (สัดส่วน 22.4% ของรายได้รวม Gross Margin สูง 79.7%) คิดค่าธรรมเนียมซอฟต์แวร์ตามระดับการใช้งานตั้งแต่ Basic $29/เดือน จนถึง Shopify Plus เริ่มต้น $2,300/เดือน และ 2) Merchant Solutions (สัดส่วน 77.6% ของรายได้ Gross Margin 38.4%) สร้างรายได้แปรผันตามปริมาณยอดขาย (GMV) ผ่านระบบชำระเงิน Shopify Payments, ค่าธรรมเนียมธุรกรรม Shop Pay, บริการจัดส่ง Shopify Shipping, สินเชื่อ Shopify Capital และโฆษณา โดยมี Attach Rate รวมระดับแข็งแกร่งที่ 3.10%`;

  const shopifyKpis = [
    'Gross Merchandise Volume (GMV): ล่าสุด Q2 2026 อยู่ที่ $115.567 พันล้าน (+32% YoY) ต้องติดตามการเติบโตไม่ให้ต่ำกว่า 25-30% YoY',
    'Gross Payments Volume (GPV) Penetration Rate: อัตราการประมวลผลผ่าน Shopify Payments ล่าสุดอยู่ที่ 68% ($78.1 พันล้าน เติบโต +38% YoY)',
    'Monthly Recurring Revenue (MRR): รายได้ประจำรายเดือนล่าสุดแตะ $212 ล้านใน Q1 2026 เติบโตเฉลี่ย 19% 5-Year CAGR และโต 19% YoY ใน Q2 2026',
    'Attach Rate: สัดส่วนรายได้ต่อปริมาณ GMV รวม ทรงตัวที่ระดับ 3.10% สะท้อนความสามารถในการ Cross-sell ผลิตภัณฑ์เสริม',
    'Free Cash Flow (FCF) Margin: ล่าสุดอยู่ที่ 18.2% ใน Q2 2026 (10 ไตรมาสติดต่อกันที่ FCF Margin เป็นตัวเลขสองหลัก) โดย Guidance Q3 2026 อยู่ที่กรอบ High Teens ถึง Low 20s',
    'Enterprise Merchant Retention: อัตราการคงอยู่ของลูกค้าระยะ 5 ปี สำหรับกลุ่มร้านค้า GMV >$1M (92%) และ GMV >$10M (97%)',
  ];

  it('formats millions currency properly', () => {
    expect(formatMillionsCurrency(null)).toBeNull();
    expect(formatMillionsCurrency(undefined)).toBeNull();
    expect(formatMillionsCurrency(NaN)).toBeNull();
    expect(formatMillionsCurrency(836)).toBe('$836M');
    expect(formatMillionsCurrency(3742)).toBe('$3.7B');
    expect(formatMillionsCurrency(96302)).toBe('$96.3B');
    expect(formatMillionsCurrency(-500)).toBe('-$500M');
  });

  it('extracts archetype title from descriptive text', () => {
    expect(extractArchetype(shopifyBusinessModel)).toBe('Unified Commerce Operating System');
    expect(extractArchetype('Coinbase (Full-Stack On-chain Financial Infrastructure & Everything Exchange)')).toBe(
      'Full-Stack On-chain Financial Infrastructure & Everything Exchange'
    );
    expect(extractArchetype('Arm Holdings (Pure-play Semiconductor IP & Architecture Licensing)')).toBe(
      'Pure-play Semiconductor IP & Architecture Licensing'
    );
    expect(extractArchetype(null)).toBeNull();
  });

  describe('parseSegmentsFromText', () => {
    it('parses Shopify segments with share percentage and margins', () => {
      const segments = parseSegmentsFromText(shopifyBusinessModel, 3742);
      expect(segments).toHaveLength(2);

      const sub = segments[0];
      expect(sub.name).toContain('Subscription Solutions');
      expect(sub.sharePct).toBe(22.4);
      expect(sub.marginPct).toBe(79.7);
      expect(sub.marginType).toBe('Gross Margin');
      expect(sub.revenueMillions).toBe(838); // 22.4% of 3742
      expect(sub.revenueDisplay).toBe('$838M');
      expect(sub.isImpliedRevenue).toBe(true);

      const merchant = segments[1];
      expect(merchant.name).toContain('Merchant Solutions');
      expect(merchant.sharePct).toBe(77.6);
      expect(merchant.marginPct).toBe(38.4);
      expect(merchant.marginType).toBe('Gross Margin');
      expect(merchant.revenueMillions).toBe(2904); // 77.6% of 3742
      expect(merchant.revenueDisplay).toBe('$2.9B');
      expect(merchant.isImpliedRevenue).toBe(true);
    });

    it('parses Google segments with explicit billion amounts, growth %, and operating margin', () => {
      const googleModel = `Alphabet สร้างรายได้หลักผ่าน 2 เสาหลักทางธุรกิจ: 1) Google Services (สัดส่วน 75.5% ของรายได้ใน Q3 2026 หรือ $96,302 ล้านดอลลาร์) อาศัยโมเดลโฆษณาดิจิทัล และ 2) Google Cloud (สัดส่วน 24.1% หรือ $30,709 ล้านดอลลาร์ โต 103% YoY) พร้อมอัตรากำไรจากการดำเนินงานของ Cloud ที่ขยายตัวแตะ 36.2%`;
      const segments = parseSegmentsFromText(googleModel);

      expect(segments).toHaveLength(2);
      expect(segments[0].name).toContain('Google Services');
      expect(segments[0].sharePct).toBe(75.5);
      expect(segments[0].revenueMillions).toBe(96302);
      expect(segments[0].revenueDisplay).toBe('$96,302M');
      expect(segments[0].isImpliedRevenue).toBeUndefined();

      expect(segments[1].name).toContain('Google Cloud');
      expect(segments[1].sharePct).toBe(24.1);
      expect(segments[1].revenueMillions).toBe(30709);
      expect(segments[1].yoyGrowthPct).toBe(103);
      expect(segments[1].marginPct).toBe(36.2);
      expect(segments[1].marginType).toBe('Operating Margin');
    });

    it('handles empty or blank text gracefully', () => {
      expect(parseSegmentsFromText('')).toEqual([]);
      expect(parseSegmentsFromText('   ')).toEqual([]);
    });
  });

  describe('parseUnitEconomicsFromKpis', () => {
    it('parses Shopify KPIs into structured hero values and growth rates', () => {
      const kpis = parseUnitEconomicsFromKpis(shopifyKpis);
      expect(kpis.length).toBeGreaterThanOrEqual(5);

      const gmv = kpis.find((k) => k.label.includes('GMV'));
      expect(gmv).toBeDefined();
      expect(gmv?.value).toBe('$115.6B');
      expect(gmv?.changeDisplay).toBe('+32% YoY');
      expect(gmv?.changeDirection).toBe('up');
      expect(gmv?.category).toBe('volume');

      const gpv = kpis.find((k) => k.label.includes('GPV'));
      expect(gpv).toBeDefined();
      expect(gpv?.value).toBe('68%');
      expect(gpv?.progressPct).toBe(68);
      expect(gpv?.changeDisplay).toBe('+38% YoY');
      expect(gpv?.changeDirection).toBe('up');

      const mrr = kpis.find((k) => k.label.includes('MRR'));
      expect(mrr).toBeDefined();
      expect(mrr?.value).toBe('$212M');
      expect(mrr?.changeDisplay).toBe('+19% YoY');
      expect(mrr?.category).toBe('retention');

      const attach = kpis.find((k) => k.label.includes('Attach Rate'));
      expect(attach).toBeDefined();
      expect(attach?.value).toBe('3.10%');
    });

    it('handles stringified JSON kpis', () => {
      const jsonStr = JSON.stringify(['Active Users: 3.64 พันล้านคน (+13% YoY)', 'ARPP: $17.72 (+22.5% YoY)']);
      const kpis = parseUnitEconomicsFromKpis(jsonStr);
      expect(kpis).toHaveLength(2);
      expect(kpis[0].label).toBe('Active Users');
      expect(kpis[0].changeDisplay).toBe('+13% YoY');
      expect(kpis[1].label).toBe('ARPP');
      expect(kpis[1].changeDisplay).toBe('+22.5% YoY');
    });

    it('handles empty or null kpis', () => {
      expect(parseUnitEconomicsFromKpis(null)).toEqual([]);
      expect(parseUnitEconomicsFromKpis([])).toEqual([]);
      expect(parseUnitEconomicsFromKpis('')).toEqual([]);
    });
  });

  describe('parseBusinessModelMatrixFromBrief', () => {
    it('constructs complete BusinessModelMatrix with Implied Revenue from Shopify brief', () => {
      const matrix = parseBusinessModelMatrixFromBrief({
        businessModel: shopifyBusinessModel,
        thesisKpis: shopifyKpis,
        asOfDate: '2026-10-08',
        latestQuarterlyRevenueMillions: 3742,
        latestPeriodLabel: "Q3 '26",
      });

      expect(matrix).not.toBeNull();
      expect(matrix?.archetype).toBe('Unified Commerce Operating System');
      expect(matrix?.periodLabel).toBe("Q3 '26");
      expect(matrix?.asOfDate).toBe('2026-10-08');
      expect(matrix?.segments).toHaveLength(2);
      expect(matrix?.segments[0].revenueMillions).toBe(838);
      expect(matrix?.segments[1].revenueMillions).toBe(2904);
      expect(matrix?.unitEconomics.length).toBeGreaterThanOrEqual(5);
      expect(matrix?.source).toBe('parsed');
    });

    it('returns null if both businessModel and thesisKpis are empty', () => {
      expect(parseBusinessModelMatrixFromBrief({})).toBeNull();
      expect(
        parseBusinessModelMatrixFromBrief({
          businessModel: '',
          thesisKpis: [],
        })
      ).toBeNull();
    });
  });

  describe('resolveBusinessModelMatrix', () => {
    it('prioritizes valid unit_economics_json over parsing', () => {
      const mockSaved = {
        archetype: 'Custom AI Archetype',
        summary: 'Saved summary',
        periodLabel: "Q3 '26",
        asOfDate: '2026-10-08',
        segments: [
          {
            name: 'Subscription Solutions',
            sharePct: 22.3,
            revenueMillions: 836,
            revenueDisplay: '$836M',
            yoyGrowthPct: 19.6,
            marginPct: 79.7,
            marginType: 'Gross Margin',
            drivers: 'Basic to Plus',
          },
        ],
        unitEconomics: [
          {
            label: 'GMV',
            value: '$115.6B',
            changeDisplay: '+32% YoY',
            changeDirection: 'up',
            progressPct: null,
            category: 'volume',
          },
        ],
        source: 'mcp',
      };

      const row = {
        symbol: 'SHOP',
        business_model: shopifyBusinessModel,
        thesis_kpis: shopifyKpis,
        as_of_date: '2026-10-08',
        unit_economics_json: JSON.stringify(mockSaved),
      };

      const resolved = resolveBusinessModelMatrix(row, 3742, "Q3 '26");
      expect(resolved).not.toBeNull();
      expect(resolved?.archetype).toBe('Custom AI Archetype');
      expect(resolved?.source).toBe('mcp');
      expect(resolved?.segments[0].revenueDisplay).toBe('$836M');
    });

    it('falls back to deterministic parser when unit_economics_json is missing or corrupt', () => {
      const row = {
        symbol: 'SHOP',
        business_model: shopifyBusinessModel,
        thesis_kpis: shopifyKpis,
        as_of_date: '2026-10-08',
        unit_economics_json: '{ corrupt json ]',
      };

      const resolved = resolveBusinessModelMatrix(row, 3742, "Q3 '26");
      expect(resolved).not.toBeNull();
      expect(resolved?.archetype).toBe('Unified Commerce Operating System');
      expect(resolved?.source).toBe('parsed');
      expect(resolved?.segments).toHaveLength(2);
    });

    it('enriches saved segments with implied revenue if sharePct is present but revenueMillions is null', () => {
      const mockSavedWithoutDollar = {
        archetype: 'Unified Commerce',
        summary: 'Summary',
        periodLabel: null,
        asOfDate: '2026-10-08',
        segments: [
          {
            name: 'Subscription Solutions',
            sharePct: 22.4,
            revenueMillions: null,
            revenueDisplay: null,
            marginPct: 79.7,
          },
        ],
        unitEconomics: [],
        source: 'ai_extracted',
      };

      const enriched = enrichSegmentsWithImpliedRevenue(mockSavedWithoutDollar as any, 3742, "Q3 '26");
      expect(enriched.segments[0].revenueMillions).toBe(838);
      expect(enriched.segments[0].revenueDisplay).toBe('$838M');
      expect(enriched.segments[0].isImpliedRevenue).toBe(true);
      expect(enriched.periodLabel).toBe("Q3 '26");
    });

    it('correctly normalizes and resolves snake_case unit_economics_json from Gemini MCP save_fundamental_brief', () => {
      const geminiMcpJson = {
        archetype: 'Pure-play Semiconductor IP',
        period_label: 'Q3 2026',
        as_of_date: '2026-11-05',
        segments: [
          {
            name: 'License and Other Revenue',
            share_pct: 53.6,
            revenue_display: '$773M',
            yoy_growth_pct: 50,
            margin_pct: 98.5,
            margin_type: 'Gross Margin',
            drivers: 'Arm Total Access (>60 contracts) and SoftBank deal',
          },
          {
            name: 'Royalty Revenue',
            share_pct: 46.4,
            revenue_display: '$670M',
            yoy_growth_pct: 23,
            margin_pct: 97.2,
            margin_type: 'Gross Margin',
            drivers: 'Data Center Royalty doubling (>100% YoY)',
          },
        ],
        unit_economics: [
          {
            label: 'Total Architecture Chips Shipped',
            value: '8.2B units',
            change_display: '+12% YoY',
            change_direction: 'up',
            progress_pct: 82,
            category: 'volume',
            context: 'Compounding per-chip royalty engine',
          },
        ],
      };

      const row = {
        symbol: 'ARM',
        business_model: 'Some model text',
        thesis_kpis: ['KPI 1'],
        as_of_date: '2026-11-05',
        unit_economics_json: JSON.stringify(geminiMcpJson),
      };

      const resolved = resolveBusinessModelMatrix(row, 1443, "Q3 '26");
      expect(resolved).not.toBeNull();
      expect(resolved?.archetype).toBe('Pure-play Semiconductor IP');
      expect(resolved?.periodLabel).toBe('Q3 2026');
      expect(resolved?.source).toBe('mcp');

      // Verify segments normalized to camelCase
      expect(resolved?.segments).toHaveLength(2);
      expect(resolved?.segments[0].sharePct).toBe(53.6);
      expect(resolved?.segments[0].marginPct).toBe(98.5);
      expect(resolved?.segments[0].marginType).toBe('Gross Margin');
      expect(resolved?.segments[0].yoyGrowthPct).toBe(50);
      expect(resolved?.segments[0].revenueDisplay).toBe('$773M');

      expect(resolved?.segments[1].sharePct).toBe(46.4);
      expect(resolved?.segments[1].marginPct).toBe(97.2);

      // Verify unitEconomics normalized to camelCase
      expect(resolved?.unitEconomics).toHaveLength(1);
      expect(resolved?.unitEconomics[0].label).toBe('Total Architecture Chips Shipped');
      expect(resolved?.unitEconomics[0].value).toBe('8.2B units');
      expect(resolved?.unitEconomics[0].changeDisplay).toBe('+12% YoY');
      expect(resolved?.unitEconomics[0].changeDirection).toBe('up');
      expect(resolved?.unitEconomics[0].progressPct).toBe(82);
      expect(resolved?.unitEconomics[0].category).toBe('volume');
      expect(resolved?.unitEconomics[0].context).toBe('Compounding per-chip royalty engine');
    });

    it('normalizeBusinessModelMatrix handles null and edge-case inputs gracefully', () => {
      expect(normalizeBusinessModelMatrix(null)).toBeNull();
      expect(normalizeBusinessModelMatrix(undefined)).toBeNull();
      expect(normalizeBusinessModelMatrix({})).toBeNull();
      expect(normalizeBusinessModelMatrix({ segments: [], unit_economics: [] })).toBeNull();

      const partial = normalizeBusinessModelMatrix({
        segments: [{ name: 'Test', share_pct: 'not-a-number', margin_pct: null }],
        unit_economics: [{ label: 'Metric', value: 123 }],
      });
      expect(partial).not.toBeNull();
      expect(partial?.segments[0].name).toBe('Test');
      expect(partial?.segments[0].sharePct).toBeNull();
      expect(partial?.segments[0].marginPct).toBeNull();
      expect(partial?.unitEconomics[0].label).toBe('Metric');
      expect(partial?.unitEconomics[0].value).toBe('123');
    });
  });
});

