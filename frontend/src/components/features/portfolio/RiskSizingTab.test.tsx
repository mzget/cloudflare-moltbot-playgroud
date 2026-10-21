import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import RiskSizingTab from './RiskSizingTab';

describe('RiskSizingTab Component', () => {
  const mockAuditData = {
    concentration: {
      totalStockPortfolioUsd: 100000,
      openHoldingsCount: 4,
      hhi: 0.28,
      effectivePositions: 3.57,
      top3ConcentrationPct: 65.0,
      top5ConcentrationPct: 100.0,
      stockConcentrations: [
        {
          symbol: 'MSFT',
          marketValueUsd: 35000,
          weightPct: 35.0,
          status: 'breach',
          trimToCapUsd: 20000,
          trimToCapShares: 50,
          themes: ['AI & Cloud Infrastructure'],
        },
        {
          symbol: 'AAPL',
          marketValueUsd: 25000,
          weightPct: 25.0,
          status: 'breach',
          trimToCapUsd: 10000,
          trimToCapShares: 66.6,
          themes: ['Consumer Tech'],
        },
        {
          symbol: 'NVDA',
          marketValueUsd: 25000,
          weightPct: 25.0,
          status: 'breach',
          trimToCapUsd: 10000,
          trimToCapShares: 40,
          themes: ['AI & Cloud Infrastructure', 'Semiconductor Leaders'],
        },
        {
          symbol: 'AMZN',
          marketValueUsd: 15000,
          weightPct: 15.0,
          status: 'warning',
          trimToCapUsd: 0,
          trimToCapShares: 0,
          themes: ['Unassigned'],
        },
      ],
      themeExposures: [
        {
          themeName: 'AI & Cloud Infrastructure',
          marketValueUsd: 60000,
          weightPct: 60.0,
          status: 'breach',
          symbols: ['MSFT', 'NVDA'],
          roomToCapUsd: 0,
          isUnassigned: false,
        },
        {
          themeName: 'Consumer Tech',
          marketValueUsd: 25000,
          weightPct: 25.0,
          status: 'warning',
          symbols: ['AAPL'],
          roomToCapUsd: 5000,
          isUnassigned: false,
        },
        {
          themeName: 'Semiconductor Leaders',
          marketValueUsd: 25000,
          weightPct: 25.0,
          status: 'warning',
          symbols: ['NVDA'],
          roomToCapUsd: 5000,
          isUnassigned: false,
        },
        {
          themeName: 'Legacy Computing',
          marketValueUsd: 0,
          weightPct: 0.0,
          status: 'ok',
          symbols: ['INTC'],
          roomToCapUsd: 30000,
          isUnassigned: false,
        },
        {
          themeName: 'Unassigned',
          marketValueUsd: 15000,
          weightPct: 15.0,
          status: 'ok',
          symbols: ['AMZN'],
          roomToCapUsd: 0,
          isUnassigned: true,
        },
      ],
    },
    correlation: {
      portfolioBeta: 1.25,
      stockBetas: { MSFT: 1.15, AAPL: 0.95, NVDA: 1.75, AMZN: 1.1 },
      stockAnnualizedVolatilities: { MSFT: 24.5, AAPL: 18.2, NVDA: 45.0, AMZN: 28.0 },
      highCorrelationPairs: [
        { symbolA: 'MSFT', symbolB: 'NVDA', correlation: 0.82, combinedWeightPct: 60.0 },
      ],
    },
    health: {
      healthScore: 65,
      riskLevel: 'Elevated',
      deductions: [
        { rule: 'Single-Stock Cap Breach', penalty: 20, reason: 'MSFT exceeds 15% cap (35.0%)' },
        {
          rule: 'Theme Concentration Breach',
          penalty: 15,
          reason: 'Theme AI & Cloud Infrastructure breaches 30% cap (60.0%)',
        },
      ],
    },
    holdingsSizing: [
      {
        symbol: 'MSFT',
        name: 'Microsoft Corp',
        shares: 87.5,
        lastPrice: 400,
        marketValueUsd: 35000,
        weightPct: 35.0,
        status: 'breach',
        stockBeta: 1.15,
        stockAnnualizedVol: 24.5,
        dcfBaseMoS: 12.5,
        dcfBearMoS: -5.2,
        convictionScore: 8,
        hasDebate: true,
        sizing: {
          symbol: 'MSFT',
          currentPrice: 400,
          currentMarketValueUsd: 35000,
          currentWeightPct: 35.0,
          targetWeightPct: 8.0,
          maxStockCapPct: 15.0,
          maxThemeCapPct: 30.0,
          roomToTargetUsd: 0,
          roomToTargetShares: 0,
          roomToStockCapUsd: 0,
          roomToStockCapShares: 0,
          roomToThemeCapUsd: 0,
          strictestTheme: { themeName: 'AI & Cloud Infrastructure', weightPct: 60.0 },
          maxAllowedBuyUsd: 0,
          maxAllowedBuyShares: 0,
          bindingCapReason: 'Max Theme Cap (30%) Binding',
        },
      },
      {
        symbol: 'AAPL',
        name: 'Apple Inc',
        shares: 166.6,
        lastPrice: 150,
        marketValueUsd: 25000,
        weightPct: 25.0,
        status: 'breach',
        stockBeta: 0.95,
        stockAnnualizedVol: 18.2,
        dcfBaseMoS: 18.0,
        dcfBearMoS: 2.1,
        convictionScore: 6,
        hasDebate: true,
        sizing: {
          symbol: 'AAPL',
          currentPrice: 150,
          currentMarketValueUsd: 25000,
          currentWeightPct: 25.0,
          targetWeightPct: 8.0,
          maxStockCapPct: 15.0,
          maxThemeCapPct: 30.0,
          roomToTargetUsd: 0,
          roomToTargetShares: 0,
          roomToStockCapUsd: 0,
          roomToStockCapShares: 0,
          roomToThemeCapUsd: 5000,
          strictestTheme: { themeName: 'Consumer Tech', weightPct: 25.0 },
          maxAllowedBuyUsd: 0,
          maxAllowedBuyShares: 0,
          bindingCapReason: 'Max Stock Cap (15%) Binding',
        },
      },
    ],
    latestAdvisory: {
      id: 42,
      health_score: 65,
      risk_level: 'Elevated',
      executive_summary: 'Significant concentration in AI & Cloud Infrastructure and Mega-cap Tech.',
      key_warnings: ['MSFT exceeds single-stock cap at 35%', 'Theme AI & Cloud breaches 30% cap'],
      rebalancing_actions: ['Trim MSFT by $20,000 to return within 15% cap'],
      source: 'workers_ai',
      created_at: '2026-10-21T20:00:00.000Z',
    },
  };

  it('renders loading state when initialAuditData is null', () => {
    const html = renderToString(<RiskSizingTab autoFetch={false} />);
    expect(html).toContain('Loading Portfolio Risk &amp; Position Sizing Engine...');
  });

  it('renders top KPI cards with Health Score, Beta, and Governance Caps', () => {
    const html = renderToString(
      <RiskSizingTab initialAuditData={mockAuditData} autoFetch={false} />
    );
    const cleanHtml = html.replace(/<!--.*?-->/g, '');

    // KPI 1: Risk Health
    expect(cleanHtml).toContain('Portfolio Health Score');
    expect(cleanHtml).toContain('65');
    expect(cleanHtml).toContain('Elevated Risk');
    expect(cleanHtml).toContain('Top 3 Weight');

    // KPI 2: Portfolio Beta
    expect(cleanHtml).toContain('Portfolio Beta vs. S&amp;P 500');
    expect(cleanHtml).toContain('1.25');
    expect(cleanHtml).toContain('High-Corr Pairs (r ≥ 0.70)');
    expect(cleanHtml).toContain('1 pair');

    // KPI 3: Governance Caps
    expect(cleanHtml).toContain('Governance Caps &amp; Thresholds');
    expect(cleanHtml).toContain('Target Weight');
    expect(cleanHtml).toContain('8.0%');
    expect(cleanHtml).toContain('Max Single-Stock Cap');
    expect(cleanHtml).toContain('15.0%');
    expect(cleanHtml).toContain('Max Strictest Theme Cap');
    expect(cleanHtml).toContain('30.0%');
  });

  it('renders Position Sizing & Pre-Trade Simulator Card', () => {
    const html = renderToString(
      <RiskSizingTab
        initialAuditData={mockAuditData}
        autoFetch={false}
        initialSelectedSymbol="MSFT"
      />
    );
    const cleanHtml = html.replace(/<!--.*?-->/g, '');

    expect(cleanHtml).toContain('Position Sizing &amp; Pre-Trade Simulator');
    expect(cleanHtml).toContain('Select Holding or Enter Ticker');
    expect(cleanHtml).toContain('Calculate Sizing Room');
    expect(cleanHtml).toContain('Target Room (8%)');
    expect(cleanHtml).toContain('Stock Cap Room (15%)');
    expect(cleanHtml).toContain('Strictest Theme Cap (30%)');
    expect(cleanHtml).toContain('Max Allowed Buy');
  });

  it('verifies responsive Grid 8 and 4 layout structure for Theme Concentration and Correlated Pairs cards', () => {
    const html = renderToString(
      <RiskSizingTab initialAuditData={mockAuditData} autoFetch={false} />
    );

    // Section 3 cards
    expect(html).toContain('Theme &amp; Sector Concentration (30% Cap)');
    expect(html).toContain('Correlated Stock Pairs (r ≥ 0.70)');

    // In MUI Joy UI, <Grid xs={12} lg={8} xl={8}> produces classes with MuiGrid-grid-lg-8 and MuiGrid-grid-xl-8
    // and <Grid xs={12} lg={4} xl={4}> produces MuiGrid-grid-lg-4 and MuiGrid-grid-xl-4
    expect(html).toMatch(/MuiGrid-grid-(?:lg|xl)-8/);
    expect(html).toMatch(/MuiGrid-grid-(?:lg|xl)-4/);
  });

  it('renders Theme & Sector Concentration table with symbols, market values, status, and Action delete button', () => {
    const html = renderToString(
      <RiskSizingTab
        initialAuditData={mockAuditData}
        autoFetch={false}
        initialThemeViewMode="table"
      />
    );
    const cleanHtml = html.replace(/<!--.*?-->/g, '');

    // Table Headers
    expect(cleanHtml).toContain('Theme Name');
    expect(cleanHtml).toContain('Symbols');
    expect(cleanHtml).toContain('Market Value');
    expect(cleanHtml).toContain('Weight %');
    expect(cleanHtml).toContain('30% Cap Room');
    expect(cleanHtml).toContain('Status');
    expect(cleanHtml).toContain('Action');

    // Theme rows
    expect(cleanHtml).toContain('AI &amp; Cloud Infrastructure');
    expect(cleanHtml).toContain('Consumer Tech');
    expect(cleanHtml).toContain('Semiconductor Leaders');
    expect(cleanHtml).toContain('Legacy Computing');
    expect(cleanHtml).toContain('Unassigned');

    // Unused theme with $0 and 0.0%
    expect(cleanHtml).toContain('0.0%');

    // Status chips
    expect(cleanHtml).toContain('BREACH');
    expect(cleanHtml).toContain('WARNING');
    expect(cleanHtml).toContain('OK');

    // Action column: Delete button with title on named theme rows
    expect(cleanHtml).toContain('title="Delete theme &quot;Consumer Tech&quot;"');
    expect(cleanHtml).toContain('title="Delete theme &quot;Legacy Computing&quot;"');
    expect(cleanHtml).toContain('title="Delete theme &quot;AI &amp; Cloud Infrastructure&quot;"');

    // Unassigned row should NEVER have a delete button
    expect(cleanHtml).not.toContain('title="Delete theme &quot;Unassigned&quot;"');
  });

  it('renders Delete Theme confirmation modal dialog when deletingThemeName is set', () => {
    const html = renderToString(
      <RiskSizingTab
        initialAuditData={mockAuditData}
        autoFetch={false}
        initialDeletingTheme="AI & Cloud Infrastructure"
      />
    );
    const cleanHtml = html.replace(/<!--.*?-->/g, '');

    // Alert dialog role
    expect(cleanHtml).toContain('role="alertdialog"');
    expect(cleanHtml).toContain('Delete Theme');
    expect(cleanHtml).toContain('Are you sure you want to delete the theme');
    expect(cleanHtml).toContain('AI &amp; Cloud Infrastructure');
    expect(cleanHtml).toContain('This will remove the theme and unmap any associated stocks.');
    expect(cleanHtml).toContain('Cancel');
  });

  it('renders Correlated Stock Pairs table with pairs, r coefficient, and fragility impact', () => {
    const html = renderToString(
      <RiskSizingTab initialAuditData={mockAuditData} autoFetch={false} />
    );
    const cleanHtml = html.replace(/<!--.*?-->/g, '');

    expect(cleanHtml).toContain('Correlated Stock Pairs (r ≥ 0.70)');
    expect(cleanHtml).toContain('252 Trading Days');
    expect(cleanHtml).toContain('MSFT &amp; NVDA');
    expect(cleanHtml).toContain('0.82');
    expect(cleanHtml).toContain('60.0%');
    expect(cleanHtml).toContain('High Fragility');
  });

  it('renders clean empty state when no high-correlation pairs exist', () => {
    const emptyCorrData = {
      ...mockAuditData,
      correlation: {
        ...mockAuditData.correlation,
        highCorrelationPairs: [],
      },
    };

    const html = renderToString(
      <RiskSizingTab initialAuditData={emptyCorrData} autoFetch={false} />
    );

    expect(html).toContain(
      'Excellent diversification! No holding pairs exceed the 0.70 correlation threshold.'
    );
  });

  it('renders Holdings Risk Concentration & Sizing Capacity table', () => {
    const html = renderToString(
      <RiskSizingTab initialAuditData={mockAuditData} autoFetch={false} />
    );
    const cleanHtml = html.replace(/<!--.*?-->/g, '');

    expect(cleanHtml).toContain('Holdings Risk Concentration &amp; Sizing Capacity');
    expect(cleanHtml).toContain('Microsoft Corp');
    expect(cleanHtml).toContain('Apple Inc');
    expect(cleanHtml).toContain('1.15'); // MSFT beta
    expect(cleanHtml).toContain('0.95'); // AAPL beta
  });

  it('renders AI Risk Officer Advisory card with recommendations', () => {
    const html = renderToString(
      <RiskSizingTab initialAuditData={mockAuditData} autoFetch={false} />
    );
    const cleanHtml = html.replace(/<!--.*?-->/g, '');

    expect(cleanHtml).toContain('AI Risk Officer Advisory');
    expect(cleanHtml).toContain('Significant concentration in AI &amp; Cloud Infrastructure');
    expect(cleanHtml).toContain('MSFT exceeds single-stock cap at 35%');
    expect(cleanHtml).toContain('Trim MSFT by $20,000 to return within 15% cap');
    expect(cleanHtml).toContain('Run AI Risk Audit');
  });

  it('renders clean fallback when no AI Risk Officer Advisory exists yet', () => {
    const noAdvisoryData = {
      ...mockAuditData,
      latestAdvisory: null,
    };

    const html = renderToString(
      <RiskSizingTab initialAuditData={noAdvisoryData} autoFetch={false} />
    );

    expect(html).toContain('No Risk Officer Advisory generated yet.');
    expect(html).toContain('Generate First AI Risk Audit');
  });
});
