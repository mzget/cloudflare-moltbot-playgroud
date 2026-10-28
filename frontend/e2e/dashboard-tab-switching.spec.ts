import { test, expect } from '@playwright/test';

test.describe('Dashboard Cross-Tab Switching & React Error #310 Prevention', () => {
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
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      shares: 50,
      avg_cost: 120,
      total_cost: 6000,
      price: 140,
      market_value: 7000,
      gain_pct: 16.67,
      status: 'Open',
      sector_label: 'Tech',
    },
  ];

  const mockSummary = {
    total_market_value: 22000,
    total_cost: 20000,
    cash: 3000,
    day_change_amt: 250,
    day_change_pct: 1.15,
    unrealized_gain_amt: 2000,
    unrealized_gain_pct: 10.0,
    realized_gain_amt: 500,
    total_dividends: 100,
    stocks: {
      total_market_value: 22000,
      total_cost: 20000,
      day_change_amt: 250,
      day_change_pct: 1.15,
      unrealized_gain_amt: 2000,
      unrealized_gain_pct: 10.0,
      realized_gain_amt: 500,
      total_dividends: 100,
    },
  };

  const mockNvdaOverview = {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Semiconductors',
    currency: 'USD',
    updatedAt: '2026-10-28',
    price: 140.0,
    annual: [],
    quarterly: [],
    dcfScenarios: {
      price: 140.0,
      bear: 110.0,
      base: 160.0,
      bull: 190.0,
      wacc: 10.0,
      terminalGrowth: 3.5,
    },
    companyStatistics: {
      profileMarginsReturns: [],
      valuationHealth: [],
      growthDividends: [],
    },
  };

  test.beforeEach(async ({ page }) => {
    // Inject auth token into localStorage before page loads
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'mock-valid-jwt-token');
    });

    // Mock Authentication and User Preferences
    await page.route('**/api/auth/user/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            email: 'investor@oaktree.test',
            name: 'Oaktree Operator',
            picture: '',
          },
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

    await page.route('**/api/triggered-alerts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock Portfolio endpoints
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

    await page.route('**/api/watchlist*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/portfolio/history/yearly*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/portfolio/tax-savings*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/portfolio/funds*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/portfolio/categories*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/portfolio/allocations*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/portfolio/brokers*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/portfolio/risk-audit*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          concentration: { totalStockPortfolioUsd: 22000, openHoldingsCount: 2, stockConcentrations: [] },
          themes: [],
          correlation: { correlatedPairs: [] },
          advisory: null,
        }),
      });
    });

    // Mock Analysis endpoints
    await page.route('**/api/analysis/overview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockNvdaOverview),
      });
    });

    await page.route('**/api/analysis/results*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          symbol: 'NVDA',
          summary: 'NVIDIA deep value analysis.',
          conviction_level: 'High',
          created_at: '2026-10-28',
          debate: { symbol: 'NVDA', synthesis: { conviction_label: 'High' } },
        }),
      });
    });

    await page.route('**/api/analysis/theses*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // Mock Market intelligence endpoints
    await page.route('**/api/market-intelligence*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/market-events*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/sources/intelligence*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  });

  test('switching from Analysis (/analysis?symbol=NVDA&tab=dossier) to Dashboard does not crash with React Error #310', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // 1. Start on the Analysis page with symbol and tab query parameters
    await page.goto('/analysis?symbol=NVDA&tab=dossier');
    await page.waitForLoadState('networkidle');

    // 2. Click the Dashboard navigation link in the Header
    const dashboardNavLink = page.locator('a[href="/dashboard"]').first();
    await expect(dashboardNavLink).toBeVisible();
    await dashboardNavLink.click();

    // 3. Verify the URL transitioned cleanly to /dashboard without foreign tab parameters
    await expect(page).toHaveURL(/\/dashboard$/);

    // 4. Verify Dashboard content renders (Holdings tab by default)
    await expect(page.locator('.yf-portfolio')).toBeVisible();
    await expect(page.getByRole('tab', { name: /holdings/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /summary/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /risk & sizing/i })).toBeVisible();

    // 5. Ensure NO React Error #310 or other uncaught page errors occurred
    const react310Errors = pageErrors.filter((msg) =>
      msg.includes('Minified React error #310') ||
      msg.includes('Rendered more hooks than during the previous render') ||
      msg.includes('Rendered fewer hooks than during the previous render')
    );
    expect(react310Errors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('switching from Watchlist (/watchlist?tab=market-breakouts) to Dashboard cleans query params and avoids hook mismatch', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // 1. Start on Watchlist with a specific subtab
    await page.goto('/watchlist?tab=market-breakouts');
    await page.waitForLoadState('networkidle');

    // 2. Navigate to Dashboard
    const dashboardNavLink = page.locator('a[href="/dashboard"]').first();
    await expect(dashboardNavLink).toBeVisible();
    await dashboardNavLink.click();

    // 3. Confirm clean URL and stable Dashboard render
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.yf-portfolio')).toBeVisible();

    // 4. Verify user can switch between internal Dashboard tabs without errors
    const summaryTab = page.getByRole('tab', { name: /summary/i });
    await summaryTab.click();
    await expect(page).toHaveURL(/\/dashboard\?tab=summary/);

    const holdingsTab = page.getByRole('tab', { name: /holdings/i });
    await holdingsTab.click();
    await expect(page).toHaveURL(/\/dashboard\?tab=holdings/);

    // 5. Assert zero hook mismatch errors
    const hookErrors = pageErrors.filter((msg) =>
      msg.includes('Minified React error #310') ||
      msg.includes('hooks')
    );
    expect(hookErrors).toHaveLength(0);
  });

  test('direct navigation to /dashboard with unexpected tab query param renders safely without crashing', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Direct navigation with an invalid tab parameter (which previously triggered early-return before hooks)
    await page.goto('/dashboard?tab=dossier');
    await page.waitForLoadState('networkidle');

    // Should show 404 cleanly without React #310 hook crash
    const react310Errors = pageErrors.filter((msg) =>
      msg.includes('Minified React error #310') ||
      msg.includes('Rendered more hooks than during the previous render')
    );
    expect(react310Errors).toHaveLength(0);

    // Now clicking Dashboard in Header should navigate to valid clean dashboard
    const dashboardNavLink = page.locator('a[href="/dashboard"]').first();
    await dashboardNavLink.click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.yf-portfolio')).toBeVisible();

    expect(pageErrors.filter((e) => e.includes('Minified React error #310'))).toHaveLength(0);
  });

  test('rapid sequential transitions between tabs remain completely error-free', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/analysis?symbol=NVDA&tab=dossier');
    await page.waitForLoadState('networkidle');

    // Analysis -> Dashboard
    await page.locator('a[href="/dashboard"]').first().click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.yf-portfolio')).toBeVisible();

    // Dashboard -> Watchlist
    await page.locator('a[href="/watchlist"]').first().click();
    await expect(page).toHaveURL(/\/watchlist$/);

    // Watchlist -> Dashboard
    await page.locator('a[href="/dashboard"]').first().click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.yf-portfolio')).toBeVisible();

    // Verify browser back / forward
    await page.goBack();
    await expect(page).toHaveURL(/\/watchlist$/);

    await page.goForward();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.yf-portfolio')).toBeVisible();

    expect(pageErrors.filter((e) => e.includes('Minified React error #310'))).toHaveLength(0);
  });
});
