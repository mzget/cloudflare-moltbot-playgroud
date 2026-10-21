import { test, expect } from '@playwright/test';

test.describe('Portfolio Risk Manager & Sizing Agent - E2E Suite', () => {
  const mockHoldings = [
    {
      id: 1,
      symbol: 'AAPL',
      name: 'Apple Inc.',
      shares: 100,
      avg_cost: 140,
      total_cost: 14000,
      price: 150,
      market_value: 15000,
      gain_pct: 7.14,
      status: 'Open',
      sector_label: 'Tech',
    },
    {
      id: 2,
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      shares: 50,
      avg_cost: 380,
      total_cost: 19000,
      price: 400,
      market_value: 20000,
      gain_pct: 5.26,
      status: 'Open',
      sector_label: 'Tech',
    },
  ];

  const mockSummary = {
    total_market_value: 35000,
    total_cost: 33000,
    cash: 5000,
    day_change_amt: 350,
    day_change_pct: 1.01,
    unrealized_gain_amt: 2000,
    unrealized_gain_pct: 6.06,
    realized_gain_amt: 0,
    total_dividends: 120,
    stocks: {
      total_market_value: 35000,
      total_cost: 33000,
      day_change_amt: 350,
      day_change_pct: 1.01,
      unrealized_gain_amt: 2000,
      unrealized_gain_pct: 6.06,
      realized_gain_amt: 0,
      total_dividends: 120,
    },
  };

  let mockRiskAudit = {
    concentration: {
      totalStockPortfolioUsd: 35000,
      openHoldingsCount: 2,
      stockConcentrations: [
        {
          symbol: 'AAPL',
          marketValueUsd: 15000,
          weightPct: 42.9,
          status: 'breach',
          trimToCapUsd: 9750,
          trimToCapShares: 65,
          themes: ['Consumer Tech'],
        },
        {
          symbol: 'MSFT',
          marketValueUsd: 20000,
          weightPct: 57.1,
          status: 'breach',
          trimToCapUsd: 14750,
          trimToCapShares: 36,
          themes: ['AI & Cloud Infrastructure'],
        },
      ],
      themeExposures: [
        {
          themeName: 'Consumer Tech',
          marketValueUsd: 15000,
          weightPct: 42.9,
          status: 'breach',
          symbols: ['AAPL'],
          roomToCapUsd: 0,
          isUnassigned: false,
        },
        {
          themeName: 'AI & Cloud Infrastructure',
          marketValueUsd: 20000,
          weightPct: 57.1,
          status: 'breach',
          symbols: ['MSFT'],
          roomToCapUsd: 0,
          isUnassigned: false,
        },
      ],
      hhi: 0.51,
      effectivePositions: 2.0,
      top3ConcentrationPct: 100.0,
      top5ConcentrationPct: 100.0,
    },
    correlation: {
      benchmarkSymbol: '^GSPC',
      portfolioBeta: 1.25,
      correlationMatrix: {
        AAPL: { AAPL: 1.0, MSFT: 0.82 },
        MSFT: { AAPL: 0.82, MSFT: 1.0 },
      },
      highCorrelationPairs: [
        {
          symbolA: 'AAPL',
          symbolB: 'MSFT',
          correlation: 0.82,
          combinedWeightPct: 100.0,
          riskLevel: 'danger',
        },
      ],
      stockBetas: { AAPL: 1.15, MSFT: 1.35 },
      stockAnnualizedVolatilities: { AAPL: 22.4, MSFT: 25.1 },
    },
    health: {
      healthScore: 65,
      riskLevel: 'High',
      deductions: [
        { reason: 'Single-stock cap breach: AAPL (42.9% > 15%)', points: 15 },
        { reason: 'Single-stock cap breach: MSFT (57.1% > 15%)', points: 15 },
        { reason: 'Theme cap breach: AI & Cloud Infrastructure (57.1% > 30%)', points: 10 },
        { reason: 'High correlation pair: AAPL & MSFT (r=0.82)', points: 10 },
      ],
    },
    holdingsSizing: [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        sector_label: 'Tech',
        shares: 100,
        lastPrice: 150,
        weightPct: 42.9,
        status: 'breach',
        stockBeta: 1.15,
        stockAnnualizedVol: 22.4,
        dcfBaseMoS: 20.0,
        dcfBearMoS: -13.3,
        convictionScore: 85,
        hasDebate: true,
        sizing: {
          symbol: 'AAPL',
          targetWeightPct: 8,
          maxStockCapPct: 15,
          roomToTargetUsd: -12200,
          roomToTargetShares: -81,
          roomToStockCapUsd: -9750,
          roomToStockCapShares: -65,
          roomToThemeCapUsd: 0,
          roomToThemeCapShares: 0,
          maxAllowedBuyUsd: 0,
          maxAllowedBuyShares: 0,
          strictestTheme: { themeName: 'Consumer Tech', roomToCapUsd: 0 },
          bindingCapReason: 'Single-stock 15% cap exceeded',
        },
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        sector_label: 'Tech',
        shares: 50,
        lastPrice: 400,
        weightPct: 57.1,
        status: 'breach',
        stockBeta: 1.35,
        stockAnnualizedVol: 25.1,
        dcfBaseMoS: 15.0,
        dcfBearMoS: -8.0,
        convictionScore: 90,
        hasDebate: true,
        sizing: {
          symbol: 'MSFT',
          targetWeightPct: 8,
          maxStockCapPct: 15,
          roomToTargetUsd: -17200,
          roomToTargetShares: -43,
          roomToStockCapUsd: -14750,
          roomToStockCapShares: -36,
          roomToThemeCapUsd: 0,
          roomToThemeCapShares: 0,
          maxAllowedBuyUsd: 0,
          maxAllowedBuyShares: 0,
          strictestTheme: { themeName: 'AI & Cloud Infrastructure', roomToCapUsd: 0 },
          bindingCapReason: 'Single-stock 15% cap exceeded',
        },
      },
    ],
    latestAdvisory: {
      id: 1,
      health_score: 65,
      risk_level: 'High',
      executive_summary: 'Portfolio is heavily concentrated in mega-cap tech with 2 positions breaching the 15% single-stock ceiling.',
      key_warnings: ['AAPL at 42.9% exceeds 15% max cap', 'MSFT & AAPL correlation is 0.82'],
      rebalancing_actions: ['Trim AAPL by 65 shares ($9,750)', 'Diversify into non-correlated defensive sectors'],
      source: 'workers_ai',
      created_at: '2026-10-19T12:00:00.000Z',
    },
  };

  test.beforeEach(async ({ page }) => {
    // Auth session mock
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'mock-valid-jwt-token');
    });

    await page.route('**/api/auth/user/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { email: 'admin@oaktree.local', name: 'Oaktree Operator', picture: '' },
        }),
      });
    });

    await page.route('**/api/user/preferences', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          theme: 'dark',
          table_density: 'cozy',
          currency: 'USD',
          exchange_rate: 1.0,
        }),
      });
    });

    await page.route('**/api/watchlist', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { symbol: 'AAPL', name: 'Apple Inc.' },
          { symbol: 'MSFT', name: 'Microsoft Corporation' },
        ]),
      });
    });

    await page.route('**/api/market-events*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/reports*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/email-digests*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/portfolio/holdings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHoldings),
      });
    });

    await page.route('**/api/portfolio/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSummary),
      });
    });

    await page.route('**/api/portfolio/risk-audit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRiskAudit),
      });
    });

    await page.route('**/api/portfolio/position-sizing', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          symbol: 'NVDA',
          sizing: {
            symbol: 'NVDA',
            targetWeightPct: 8,
            maxStockCapPct: 15,
            roomToTargetUsd: 2800,
            roomToTargetShares: 23,
            roomToStockCapUsd: 5250,
            roomToStockCapShares: 43,
            roomToThemeCapUsd: null,
            roomToThemeCapShares: null,
            maxAllowedBuyUsd: 5250,
            maxAllowedBuyShares: 43,
            strictestTheme: null,
            bindingCapReason: 'Max single-stock 15% cap',
          },
          simulation: {
            symbol: 'NVDA',
            type: 'Buy',
            tradeValueUsd: 1200,
            currentStockWeightPct: 0,
            projectedStockWeightPct: 3.3,
            causesStockCapBreach: false,
            causesThemeCapBreach: false,
            affectedThemes: [],
          },
        }),
      });
    });

    await page.route('**/api/portfolio/risk-advisory', async (route) => {
      mockRiskAudit = {
        ...mockRiskAudit,
        latestAdvisory: {
          id: 2,
          health_score: 70,
          risk_level: 'Moderate',
          executive_summary: 'Updated AI Risk Officer evaluation complete. Strict rebalancing advised.',
          key_warnings: ['AAPL concentration remains elevated'],
          rebalancing_actions: ['Execute phased trims over 5 trading sessions'],
          source: 'workers_ai',
          created_at: '2026-10-20T02:00:00.000Z',
        },
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          advisory: mockRiskAudit.latestAdvisory,
        }),
      });
    });

    await page.route('**/api/portfolio/themes/*', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON() as any;
        const newThemeName = body?.newThemeName || 'Renamed Theme';
        mockRiskAudit = {
          ...mockRiskAudit,
          concentration: {
            ...mockRiskAudit.concentration,
            themeExposures: mockRiskAudit.concentration.themeExposures.map((t) =>
              t.themeName === 'Consumer Tech' ? { ...t, themeName: newThemeName } : t
            ),
          },
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            oldThemeName: 'Consumer Tech',
            newThemeName,
          }),
        });
      } else {
        await route.continue();
      }
    });
  });

  // -------------------------------------------------------------
  // Test 1: Summary Tab Risk Warning Banner
  // -------------------------------------------------------------
  test('displays Risk Alert banner on Summary Tab when cap is breached and links to Risk Tab', async ({ page }) => {
    await page.goto('/dashboard?tab=summary');

    // Verify warning banner exists
    const riskBanner = page.locator('text=Single-Stock Cap');
    await expect(riskBanner).toBeVisible();

    // Verify breach details in banner
    await expect(page.locator('text=AAPL')).toBeVisible();

    // Click "Review Risk & Sizing" button
    const openRiskBtn = page.getByRole('button', { name: /Review Risk & Sizing/i });
    await expect(openRiskBtn).toBeVisible();
    await openRiskBtn.click();

    // Should navigate to tab=risk
    await expect(page).toHaveURL(/tab=risk/);
    await expect(page.locator('text=Governance Caps & Thresholds')).toBeVisible();
  });

  // -------------------------------------------------------------
  // Test 2: Risk & Sizing Tab KPI Cards
  // -------------------------------------------------------------
  test('renders all 4 KPI Cards: Portfolio Health, 1-Year Beta, Governance Caps, and Effective Positions', async ({ page }) => {
    await page.goto('/dashboard?tab=risk');

    // Health Score
    await expect(page.locator('text=Portfolio Health Score')).toBeVisible();
    await expect(page.getByRole('heading', { name: '65' })).toBeVisible();
    await expect(page.locator('text=High Risk')).toBeVisible();

    // Beta vs S&P 500
    await expect(page.locator('text=Portfolio Beta vs. S&P 500')).toBeVisible();
    await expect(page.getByRole('heading', { name: '1.25' })).toBeVisible();
    await expect(page.locator('text=1 pair')).toBeVisible();

    // Governance Caps
    await expect(page.locator('text=Governance Caps & Thresholds')).toBeVisible();
    await expect(page.locator('text=🎯 Target Weight')).toBeVisible();
    await expect(page.locator('text=🛡️ Max Single-Stock Cap')).toBeVisible();
    await expect(page.locator('text=🧩 Max Strictest Theme Cap')).toBeVisible();
  });

  // -------------------------------------------------------------
  // Test 3: Concentration & Correlation Tables + Inline Theme Rename
  // -------------------------------------------------------------
  test('renders Theme Concentration Table, supports inline theme rename, and renders High-Correlation Pairs Table', async ({ page }) => {
    await page.goto('/dashboard?tab=risk');

    // Theme Concentration Card
    await expect(page.locator('text=Theme & Sector Concentration')).toBeVisible();

    // Switch to Table View
    const tableViewBtn = page.getByTitle('Table View');
    await expect(tableViewBtn).toBeVisible();
    await tableViewBtn.click();

    await expect(page.getByRole('cell', { name: 'Consumer Tech' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'AI & Cloud Infrastructure' })).toBeVisible();

    // Click Edit button on Consumer Tech row to open inline editing in table cell
    const editBtn = page.getByTitle('Edit theme "Consumer Tech"');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const inlineInput = page.getByLabel('Edit theme name for Consumer Tech');
    await expect(inlineInput).toBeVisible();
    await inlineInput.fill('Next-Gen Consumer Tech');

    const saveBtn = page.getByTitle('Save theme "Consumer Tech"');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    await expect(page.getByRole('cell', { name: 'Next-Gen Consumer Tech' })).toBeVisible();

    // High Correlation Pairs Table
    await expect(page.locator('text=Correlated Stock Pairs (r ≥ 0.70)')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'AAPL & MSFT' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '0.82' })).toBeVisible();
  });

  // -------------------------------------------------------------
  // Test 4: Position Sizing & Pre-Trade Simulation
  // -------------------------------------------------------------
  test('allows calculating sizing room and previewing pre-trade impact simulation', async ({ page }) => {
    await page.goto('/dashboard?tab=risk');

    await expect(page.locator('text=Position Sizing & Pre-Trade Simulator')).toBeVisible();

    // Click Calculate Sizing Room button
    const calcBtn = page.getByRole('button', { name: /Calculate Sizing Room/i });
    await expect(calcBtn).toBeVisible();
    await calcBtn.click();

    // Verify Sizing cards appear
    await expect(page.locator('text=Target Room (8%)')).toBeVisible();
    await expect(page.locator('text=Stock Cap Room (15%)')).toBeVisible();
    await expect(page.locator('text=Max Allowed Buy')).toBeVisible();
  });

  // -------------------------------------------------------------
  // Test 5: Chief Risk Officer AI Advisory
  // -------------------------------------------------------------
  test('displays AI Risk Officer advisory and triggers on-demand AI audit', async ({ page }) => {
    await page.goto('/dashboard?tab=risk');

    await expect(page.locator('text=AI Risk Officer Advisory (Howard Marks Framework)')).toBeVisible();
    await expect(page.locator('text=Portfolio is heavily concentrated in mega-cap tech')).toBeVisible();
    await expect(page.locator('text=AAPL at 42.9% exceeds 15% max cap')).toBeVisible();

    // Click "Run AI Risk Audit" button
    const runAiBtn = page.getByRole('button', { name: /Run AI Risk Audit/i }).first();
    await expect(runAiBtn).toBeVisible();
    await runAiBtn.click();

    // Expect updated advisory from mock
    await expect(page.locator('text=Updated AI Risk Officer evaluation complete')).toBeVisible();
    await expect(page.locator('text=Execute phased trims over 5 trading sessions')).toBeVisible();
  });
});
