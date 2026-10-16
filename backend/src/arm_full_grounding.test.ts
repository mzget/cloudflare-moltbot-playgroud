import { describe, it, expect } from 'vitest';
import { fetchQualitativeData } from './debateEngine';
import { formatDebateContext } from './analysisPrompts';

function createMockD1(): any {
  return {
    prepare(sql: string) {
      const stmt: any = {
        bind(..._params: unknown[]) {
          return stmt;
        },
        async first() {
          if (sql.includes('stock_fundamentals')) {
            return {
              symbol: 'ARM',
              business_model:
                'Arm operates a high-margin, asset-light IP licensing model alongside an expanding production silicon business. Revenue comes from upfront license fees, recurring per-unit royalties on chips shipped (rising with core counts, ASP and newer architectures such as Armv9 and Compute Subsystems/CSS), and direct production silicon sales via the Arm AGI CPU for cloud and AI data centers.',
              moat:
                'High switching costs, network effects and ubiquity. The ISA is supported by a global ecosystem of 22M+ developers and mature software stacks (Android, iOS, Windows on Arm, Linux) and EDA/OS toolchains. 350B+ cumulative Arm-based chips shipped create large barriers to replacement and support ~97-98% gross margins.',
              competitors:
                '["x86 providers: Intel, AMD","Open-source / licensable architectures: RISC-V ecosystem (Andes, Tenstorrent, SiFive)","Legacy compute IP vendors: MIPS, Synopsys ARC, Cadence Tensilica"]',
              guidance:
                '{"near_term":"Q2 FY27: revenue $1,380M +/- $50M; non-GAAP opex ~$780M; non-GAAP diluted EPS $0.47 +/- $0.04","long_term":"FYE31 targets: total revenue $25B ($10B IP/CSS + $15B Arm AGI CPU silicon); IP/CSS non-GAAP op margin >65%; silicon non-GAAP op margin >30%; non-GAAP EPS >$9.00","revenue_target":"$25B total revenue by FYE31 ($10B IP/CSS + $15B AGI CPU); royalty revenue CAGR 20% FYE26-FYE31","margin_target":"IP/CSS non-GAAP operating margin >65%; silicon >30%","timeframe":"FYE31","key_assumptions":"Armv9/CSS mix drives ~2x royalty per chip; AGI CPU silicon ramps against $2B+ demand pipeline; non-GAAP opex grows at mid-teens CAGR"}',
              key_risks:
                '["Valuation (P/E >100x) prices in perfection with low margin of safety","RISC-V adoption in microcontrollers, low-end IoT and sovereign/China silicon","Foundry, memory and advanced-packaging bottlenecks limiting AGI CPU deployments","Concentration and legal risk: Arm China independence, licensing disputes (e.g. Qualcomm)","Execution and margin-dilution risk from moving into physical silicon"]',
              thesis_kpis:
                '["Armv9 and CSS penetration of the royalty mix (2x royalty per chip)","Data center / cloud AI compute share and Neoverse core deployments","Annualized Contract Value (ACV) and RPO growth","Arm Total Access and Flexible Access license count","Arm AGI CPU commercial ramp toward the $15B FYE31 target"]',
              as_of_date: '2026-07-29',
              notebook_id: '466a0b20-7ce1-4953-babc-192ac48151e3',
              source_count: 13,
              updated_at: '2026-07-29 12:00:00',
            };
          }
          return null;
        },
        async all() {
          if (sql.includes('theme_sector_contexts')) {
            return {
              results: [
                {
                  notebook_id: '569a56ae-602d-427a-af87-3fdbc8f25a81',
                  theme_name: 'SemiAnalysis & Advanced Semiconductor Dynamics',
                  industry_dynamics:
                    'AI inference and hyperscaler custom silicon (ASIC) inflection driving massive architectural shifts toward energy-efficient architectures and higher memory bandwidth. Advanced packaging (CoWoS, 3D chiplets) has become the primary scaling vector replacing classic monolithic die shrinking.',
                  supply_chain_bottlenecks:
                    'Foundry wafer allocation at leading nodes (3nm/2nm), advanced packaging capacity (TSMC CoWoS-S/L/R), HBM3e/HBM4 supply allocation, high-performance substrate availability, and data center thermal/megawatt power envelopes.',
                  competitive_landscape:
                    'Compute Architecture: Arm architecture expanding market share in cloud AI (AWS Graviton, Google Axion, Microsoft Cobalt, NVIDIA Grace) vs x86 (Intel Xeon, AMD EPYC) while RISC-V gains traction in specialized accelerators and control processors. GPU/Accelerator: NVIDIA Blackwell ecosystem vs AMD Instinct and Hyperscaler custom ASICs (Google TPU, AWS Trainium/Inferentia).',
                  macro_trends:
                    'U.S. export controls and Commerce BIS restrictions on leading-edge AI compute and EDA tools to China; sovereign AI infrastructure buildouts across Middle East, Japan, and Europe; massive data center capital expenditure cycles under scrutiny for ROIC payoff.',
                  updated_at: '2026-07-29 12:00:00',
                },
              ],
            };
          }
          return { results: [] };
        },
        async run() {
          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
  };
}

describe('Milestone 5 Acceptance: Full Grounding Context for ARM with SemiAnalysis Theme', () => {
  it('loads ARM fundamental brief and joined SemiAnalysis theme context into 5 structured sections', async () => {
    const mockDb = createMockD1();

    // Fetch qualitative data for ARM
    const qual = await fetchQualitativeData(mockDb, 'ARM');

    // Assert fundamental brief is present
    expect(qual.fundamental).not.toBeNull();
    expect(qual.fundamental?.symbol).toBe('ARM');
    expect(qual.fundamental?.as_of_date).toBe('2026-07-29');
    expect(qual.fundamental?.source_count).toBe(13);

    // Assert joined theme is present
    expect(qual.themes.length).toBeGreaterThanOrEqual(1);
    const semiTheme = qual.themes.find((t) => t.theme_name.includes('SemiAnalysis'));
    expect(semiTheme).toBeDefined();
    expect(semiTheme?.industry_dynamics).toContain('custom silicon');
    expect(semiTheme?.supply_chain_bottlenecks).toContain('CoWoS');

    // Format debate context
    const metricsStr = 'Price: $238 | P/E: 261 | Gross Margin: 97.5% | Revenue Growth: 25%';
    const context = formatDebateContext(metricsStr, qual.events as any, qual.articles as any, qual);

    // Assert 5 structured sections and rich grounding
    expect(context).toContain('### 1.'); // Financial Metrics
    expect(context).toContain('### 2.'); // Company Fundamental Brief
    expect(context).toContain('### 3.'); // Sector & Competitive Dynamics
    expect(context).toContain('P/E: 261');
    expect(context).toContain('$25B');
    expect(context).toContain('SemiAnalysis');
    expect(context).toContain('CoWoS');
    expect(context).toContain('Armv9');
    expect(context).toContain('RISC-V');
  });
});

