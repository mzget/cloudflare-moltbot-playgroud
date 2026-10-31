import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import StockDossierCockpit from './StockDossierCockpit';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

describe('StockDossierCockpit Component', () => {
  const mockOverview = {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Software - Infrastructure',
    currency: 'USD',
    updatedAt: '2026-10-24',
    annual: [{ period: '2025' }],
    quarterly: [{ period: "Q2 '25" }],
    dcfScenarios: {
      price: 420.0,
      bear: 350.0,
      base: 485.0,
      bull: 560.0,
    },
    companyStatistics: {
      profileMarginsReturns: [],
      valuationHealth: [
        {
          category: 'Valuation',
          items: [
            { label: 'P/E', value: '31.2x' },
            { label: 'P/FCF', value: '28.5x' },
          ],
        },
      ],
      growthDividends: [],
    },
  };

  const mockReport = {
    symbol: 'MSFT',
    summary: 'Deep value investment thesis for Microsoft.',
    conviction_level: 'High',
    created_at: '2026-10-24',
    debate: {
      symbol: 'MSFT',
      round1: {
        bull: {
          bull_thesis: 'Dominant enterprise cloud and AI leadership driving sustained double-digit growth.',
          growth_catalysts: ['Azure AI copilot expansion', 'Office 365 ARPU uplift'],
          competitive_advantages: ['Enterprise distribution moat', 'Deep ecosystem integration'],
          valuation_upside: 'Target $560',
        },
        bear: {
          bear_thesis: 'High GPU infrastructure capex compressing near-term free cash flow margins.',
          downside_risks: ['Elevated hyperscaler capex depreciation', 'Cloud growth moderation'],
          structural_headwinds: ['Hardware cost escalation'],
          valuation_stretch: 'Over-extended multiples',
        },
      },
      synthesis: {
        key_tensions: [
          {
            topic: 'AI Capex Monetization',
            bull_argument: 'Enterprise demand is accelerating and converting to high-margin recurring software revenues.',
            bear_argument: 'Capital depreciation will run ahead of actual revenue realization.',
            decisive_factor: 'Sustained commercial cloud gross margins above 70%.',
          },
        ],
        consensus_points: ['Unquestioned enterprise software distribution moat.'],
        conviction_score: 85,
        conviction_label: 'High',
        verdict_summary: 'Asymmetric risk/reward supported by robust FCF generation despite heavy capex cycle.',
      },
    },
  };

  const mockTheses = [
    {
      id: 1,
      symbol: 'MSFT',
      title: 'Long-term Enterprise AI Dominance',
      buy_price: 400.0,
      sell_price: 550.0,
      conviction: 'High',
      status: 'Active',
      catalysts: 'Azure Copilot growth + commercial cloud expansion',
      risks: 'Capex cycle peak',
      note: 'Accumulate on pullbacks below $420.',
      created_at: '2026-10-20T10:00:00Z',
      updated_at: '2026-10-24T12:00:00Z',
    },
  ];

  const mockRiskAudit = {
    concentration: {
      totalStockPortfolioUsd: 100000,
      openHoldingsCount: 3,
      hhi: 0.25,
      effectivePositions: 4.0,
      top3ConcentrationPct: 50.0,
      top5ConcentrationPct: 100.0,
      stockConcentrations: [
        {
          symbol: 'MSFT',
          marketValueUsd: 5000,
          weightPct: 5.0,
          status: 'ok',
          trimToCapUsd: 0,
          trimToCapShares: 0,
          themes: ['AI & Cloud Infrastructure'],
        },
      ],
      themeExposures: [
        {
          themeName: 'AI & Cloud Infrastructure',
          marketValueUsd: 15000,
          weightPct: 15.0,
          status: 'ok',
          symbols: ['MSFT', 'NVDA'],
          roomToCapUsd: 15000,
          isUnassigned: false,
        },
      ],
    },
    correlation: {
      pairs: [
        {
          stock1: 'MSFT',
          stock2: 'NVDA',
          r: 0.76,
          fragilityContribution: 12.5,
          interpretation: 'High positive correlation',
        },
      ],
      portfolioBeta: 1.08,
    },
    health: {
      healthScore: 88,
      status: 'Excellent',
      penalties: [],
    },
    holdingsSizing: [
      {
        symbol: 'MSFT',
        shares: 11.9,
        lastPrice: 420.0,
        currentMarketValueUsd: 5000,
        currentWeightPct: 5.0,
        targetWeightPct: 8.0,
        maxStockCapPct: 15.0,
        roomToTargetDollars: 3000,
        roomToTargetShares: 7,
        roomToStockCapDollars: 10000,
        roomToStockCapShares: 23,
        bindingCapReason: 'Single-Stock Cap (15%)',
        strictestThemeName: 'AI & Cloud Infrastructure',
        roomToThemeCapDollars: 15000,
        isTrimRequired: false,
      },
    ],
    themeMappings: [
      { symbol: 'MSFT', themeName: 'AI & Cloud Infrastructure' },
      { symbol: 'NVDA', themeName: 'AI & Cloud Infrastructure' },
    ],
    latestAdvisory: {
      advisory_text: 'Maintain disciplined accumulation within 8% target weight.',
      created_at: '2026-10-24',
    },
  };

  it('renders loading state when initial data is omitted', () => {
    const html = renderToString(
      <StockDossierCockpit symbol="MSFT" onNavigateTab={vi.fn()} />
    );
    expect(html).toContain('Loading Unified Dossier for');
    expect(html).toContain('MSFT');
  });

  it('renders Hero Cockpit banner with ticker, name, price, MoS bar, and sizing capacity', () => {
    const html = renderToString(
      <StockDossierCockpit
        symbol="MSFT"
        onNavigateTab={vi.fn()}
        initialOverview={mockOverview}
        initialReport={mockReport}
        initialTheses={mockTheses}
        initialRiskAudit={mockRiskAudit}
      />
    );

    // Hero details
    expect(html).toContain('MSFT');
    expect(html).toContain('Microsoft Corporation');
    expect(html).toContain('NASDAQ');
    expect(html).toContain('Technology');
    expect(html).toContain('$420.00');
    expect(html).toContain('Conviction:');
    expect(html).toContain('High');

    // Sizing Room & Governance badge
    expect(html).toContain('Position Sizing Room');
    expect(html).toContain('Bound by:');
    expect(html).toContain('Quick Sim');
  });

  it('renders the 4-Quadrant High-Density Grid in Executive Cockpit view', () => {
    const html = renderToString(
      <StockDossierCockpit
        symbol="MSFT"
        onNavigateTab={vi.fn()}
        initialOverview={mockOverview}
        initialReport={mockReport}
        initialTheses={mockTheses}
        initialRiskAudit={mockRiskAudit}
      />
    );

    // Quadrant A: Valuation Anchor
    expect(html).toContain('Quadrant A: Valuation Anchor');
    expect(html).toContain('$350.00'); // Bear
    expect(html).toContain('$485.00'); // Base Fair Value
    expect(html).toContain('$560.00'); // Bull
    expect(html).toContain('Base Margin of Safety:');
    expect(html).toContain('DCF Model');

    // Quadrant B: Adversarial Debate
    expect(html).toContain('Quadrant B: Adversarial Debate');
    expect(html).toContain('Bull Catalyst');
    expect(html).toContain('Azure AI copilot expansion');
    expect(html).toContain('Bear Risk');
    expect(html).toContain('Elevated hyperscaler capex depreciation');
    expect(html).toContain('Key Tension:');
    expect(html).toContain('AI Capex Monetization');
    expect(html).toContain('Full Debate');

    // Quadrant C: Portfolio Fit & Risk Governance
    expect(html).toContain('Quadrant C: Portfolio Governance');
    expect(html).toContain('Risk Tab');
    expect(html).toContain('data-testid="cockpit-risk-tab-btn"');
    expect(html).toContain('Howard Marks Governance:');
    expect(html).toContain('8% Target • 15% Stock • 30% Theme');
    expect(html).toContain('Room to 8% Target:');
    expect(html).toContain('Correlated Stock Pairs (r ≥ 0.70):');
    expect(html).toContain('NVDA');

    // Quadrant D: Investor Thesis
    expect(html).toContain('Quadrant D: Investor Thesis');
    expect(html).toContain('Long-term Enterprise AI Dominance');
    expect(html).toContain('Target Buy Price:');
    expect(html).toContain('$400.00');
    expect(html).toContain('Target Sell Price:');
    expect(html).toContain('$550.00');
    expect(html).toContain('Edit Thesis');
  });

  it('renders clean fallback empty states when debate or theses are not yet present', () => {
    const emptyOverview = { ...mockOverview, dcfScenarios: null };
    const html = renderToString(
      <StockDossierCockpit
        symbol="XYZ"
        onNavigateTab={vi.fn()}
        initialOverview={emptyOverview}
        initialReport={{ symbol: 'XYZ', summary: '', conviction_level: 'Medium' }}
        initialTheses={[]}
        initialRiskAudit={mockRiskAudit}
      />
    );

    expect(html).toContain('XYZ');
    expect(html).toContain('No dialectical debate recorded for');
    expect(html).toContain('No active investment thesis drafted for');
    expect(html).toContain('Draft Thesis Now');
  });

  it('renders Decision Trace Flow with all 5 stages when initialViewMode is trace', () => {
    const html = renderToString(
      <StockDossierCockpit
        symbol="MSFT"
        onNavigateTab={vi.fn()}
        initialOverview={mockOverview}
        initialReport={mockReport}
        initialTheses={mockTheses}
        initialRiskAudit={mockRiskAudit}
        initialViewMode="trace"
      />
    );

    expect(html).toContain('Multi-Agent Decision Trace &amp; Auditability Flow');
    expect(html).toContain('Stage 1: Raw Financial Ingestion &amp; Telemetry');
    expect(html).toContain('Stage 2: Dialectical Bull vs. Bear Debate');
    expect(html).toContain('Stage 3: DCF Parameter Extractor &amp; Scenarios');
    expect(html).toContain('Stage 4: Portfolio Governance &amp; Concentration Audit');
    expect(html).toContain('Stage 5: Final Actionable Execution Advisory');
    expect(html).toContain('Approved for entry/accumulation up to');
  });

  it('renders Quadrant A Valuation Anchor from overview dcfScenarios for RDDT', () => {
    const rddtOverviewWithDcf = {
      symbol: 'RDDT',
      name: 'Reddit Inc',
      exchange: 'NYSE',
      sector: 'Ads, Data',
      industry: 'Media',
      currency: 'USD',
      updatedAt: '2026-10-25',
      annual: [],
      quarterly: [],
      dcfScenarios: {
        price: 144.25,
        base: 142.88,
        bull: 205.5,
        bear: 78.13,
        wacc: 10.5,
        terminalGrowth: 2.5,
      },
      companyStatistics: { profileMarginsReturns: [], valuationHealth: [], growthDividends: [] },
    };

    const html = renderToString(
      <StockDossierCockpit
        symbol="RDDT"
        onNavigateTab={vi.fn()}
        initialOverview={rddtOverviewWithDcf}
        initialReport={{ symbol: 'RDDT', summary: '', conviction_level: 'High' }}
        initialTheses={[]}
        initialRiskAudit={mockRiskAudit}
      />
    );

    expect(html).toContain('Quadrant A: Valuation Anchor');
    expect(html).toContain('$142.88'); // Base Fair Value
    expect(html).toContain('$205.50'); // Bull Case
    expect(html).toContain('$78.13');  // Bear Case
    expect(html).toContain('WACC:');
    expect(html).toContain('10.5%');
    expect(html).toContain('Terminal Growth:');
    expect(html).toContain('2.5%');
  });

  it('renders 0% when WACC or terminalGrowth is 0 (does not treat 0 as falsy)', () => {
    const rddtOverviewZeroRates = {
      symbol: 'RDDT',
      dcfScenarios: {
        price: 100.0,
        base: 120.0,
        bull: 150.0,
        bear: 80.0,
        wacc: 0,
        terminalGrowth: 0,
      },
    };

    const html = renderToString(
      <StockDossierCockpit
        symbol="RDDT"
        onNavigateTab={vi.fn()}
        initialOverview={rddtOverviewZeroRates}
        initialReport={{ symbol: 'RDDT' }}
        initialTheses={[]}
        initialRiskAudit={mockRiskAudit}
      />
    );

    expect(html).toContain('WACC:');
    expect(html).toContain('0%');
    expect(html).toContain('Terminal Growth:');
  });

  it('correctly formats asymmetric upside/downside without +- when stock is overvalued across all cases', () => {
    const overvaluedOverview = {
      symbol: 'OVER',
      dcfScenarios: {
        price: 100.0,
        base: 70.0,
        bull: 90.0,
        bear: 50.0,
      },
    };

    const html = renderToString(
      <StockDossierCockpit
        symbol="OVER"
        onNavigateTab={vi.fn()}
        initialOverview={overvaluedOverview}
        initialReport={{ symbol: 'OVER' }}
        initialTheses={[]}
        initialRiskAudit={mockRiskAudit}
      />
    );

    // Bull is -10% and Bear is -50%: should be "-10.00% / -50.00%", NEVER "+-10.00%"
    expect(html).toContain('-10.00% / -50.00%');
    expect(html).not.toContain('+-10.00%');
  });

  it('correctly displays positive bear upside when stock is deeply undervalued even in bear case', () => {
    const deepValueOverview = {
      symbol: 'VALUE',
      dcfScenarios: {
        price: 100.0,
        base: 150.0,
        bull: 200.0,
        bear: 120.0,
      },
    };

    const html = renderToString(
      <StockDossierCockpit
        symbol="VALUE"
        onNavigateTab={vi.fn()}
        initialOverview={deepValueOverview}
        initialReport={{ symbol: 'VALUE' }}
        initialTheses={[]}
        initialRiskAudit={mockRiskAudit}
      />
    );

    // Bull is +100% and Bear is +20%: should be "+100.00% / +20.00%", NEVER "-20.00%"
    expect(html).toContain('+100.00% / +20.00%');
    expect(html).not.toContain('/ -20.00%');
  });

  it('renders partial single-scenario fallback cleanly', () => {
    const singleBullOverview = {
      symbol: 'BULLY',
      dcfScenarios: {
        price: 100.0,
        base: null,
        bull: 140.0,
        bear: null,
      },
    };

    const html = renderToString(
      <StockDossierCockpit
        symbol="BULLY"
        onNavigateTab={vi.fn()}
        initialOverview={singleBullOverview}
        initialReport={{ symbol: 'BULLY' }}
        initialTheses={[]}
        initialRiskAudit={mockRiskAudit}
      />
    );

    expect(html).toContain('+40.00% (Bull vs Current)');
  });
  it('renders merged watchlist governance controls, edit, alerts, and freshness inside Cockpit Hero Header without separate watchlist card', () => {
    const mockWatchlist = [
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        is_active: 1,
        in_portfolio: 1,
        type: 'STOCK',
        active_alerts_count: 2,
        sector_label: 'Cloud Infrastructure & Enterprise AI',
        sector_label_color: '#3b82f6',
        mos_price: 420.0,
        mos_base: 15.5,
      },
    ];

    const mockFundamental = {
      symbol: 'MSFT',
      company_name: 'Microsoft Corporation',
      as_of_date: '2026-10-25',
      status: 'active' as const,
      source_count: 6,
      theme_tags: ['Enterprise Software', 'Hyperscaler AI'],
      updated_at: '2026-10-25T12:00:00Z',
    };

    const html = renderToString(
      <StockDossierCockpit
        symbol="MSFT"
        onNavigateTab={vi.fn()}
        initialOverview={mockOverview}
        initialReport={mockReport}
        initialTheses={mockTheses}
        initialRiskAudit={mockRiskAudit}
        initialWatchlist={mockWatchlist}
        initialFundamental={mockFundamental}
      />
    );

    // 1. Header Grid layout is rendered and separate Watchlist Card section is removed
    expect(html).toContain('data-testid="cockpit-header-grid"');
    expect(html).not.toContain('data-testid="cockpit-watchlist-card-section"');
    expect(html).not.toContain('data-testid="watchlist-card"');

    // 2. Merged governance switches exist in Cockpit Hero Header
    expect(html).toContain('data-testid="cockpit-active-switch"');
    expect(html).toContain('data-testid="cockpit-portfolio-switch"');
    expect(html).toContain('Active');
    expect(html).toContain('Portfolio');

    // 3. Merged action buttons: Edit and Alerts exist in Cockpit Hero Header
    expect(html).toContain('data-testid="cockpit-edit-security-btn"');
    expect(html).toContain('data-testid="cockpit-alerts-btn"');

    // 4. Contains fundamental freshness and sector label
    expect(html).toContain('Cloud Infrastructure &amp; Enterprise AI');
    expect(html).toContain('6 srcs');
    expect(html).toContain('2026-10-25');

    // 5. Must NOT contain Copy Prompt button
    expect(html).not.toContain('Copy Prompt');
  });
});
