import { test, expect } from '@playwright/test';

test.describe('Stock Financial Overview E2E Suite', () => {
  const mockOverviewPayload = {
    symbol: 'META',
    name: 'Meta Platforms, Inc.',
    logo: 'https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/FB.png',
    sector: 'Communication Services',
    industry: 'Media',
    exchange: 'NASDAQ',
    ipoDate: '2012-05-18',
    currency: 'USD',
    quarterly: [
      { period: "Q2 '24", asOfDate: '2024-06-30', totalRevenue: 47516, grossProfit: 38980, operatingProfit: 18775, operatingCashFlow: 25000, freeCashFlow: 14831 },
      { period: "Q3 '24", asOfDate: '2024-09-30', totalRevenue: 51000, grossProfit: 41000, operatingProfit: 20000, operatingCashFlow: 27000, freeCashFlow: 15500 },
      { period: "Q4 '24", asOfDate: '2024-12-31', totalRevenue: 56000, grossProfit: 45000, operatingProfit: 23000, operatingCashFlow: 30000, freeCashFlow: 17000 },
      { period: "Q1 '25", asOfDate: '2025-03-31', totalRevenue: 60000, grossProfit: 48000, operatingProfit: 24000, operatingCashFlow: 32000, freeCashFlow: 18000 },
      { period: "Q2 '25", asOfDate: '2025-06-30', totalRevenue: 64601, grossProfit: 52000, operatingProfit: 26000, operatingCashFlow: 34000, freeCashFlow: 19500 },
    ],
    annual: [
      { period: '2023', asOfDate: '2023-12-31', totalRevenue: 134902, grossProfit: 108943, operatingProfit: 46751, operatingCashFlow: 71113, freeCashFlow: 43010 },
      { period: '2024', asOfDate: '2024-12-31', totalRevenue: 164500, grossProfit: 133200, operatingProfit: 60000, operatingCashFlow: 82000, freeCashFlow: 51000 },
    ],
    companyStatistics: {
      profileMarginsReturns: [
        {
          category: 'Profile',
          items: [
            { label: 'Market Cap', value: '$1.78T' },
            { label: 'Enterprise Value', value: '$1.84T' },
            { label: 'Shares Out', value: '2.55B' },
            { label: 'Revenue (TTM)', value: '$228.4B' },
            { label: '52W High / Low', value: '$779.8 / $520.3' },
            { label: 'ATH / ATL', value: '$780.0 / $88.1' },
          ],
        },
        {
          category: 'Margins (TTM)',
          items: [
            { label: 'Gross', value: '81.8%' },
            { label: 'EBITDA', value: '44.5%' },
            { label: 'Operating', value: '42.5%' },
            { label: 'Pre-Tax', value: '41.2%' },
            { label: 'Net', value: '34.1%' },
            { label: 'FCF', value: '26.3%' },
          ],
        },
        {
          category: 'Returns (TTM / 5Y Avg)',
          items: [
            { label: 'ROA (TTM / 5Y)', value: '18.0% / 16.5%' },
            { label: 'ROE (TTM / 5Y)', value: '29.7% / 27.8%' },
            { label: 'ROI (TTM / 5Y)', value: '22.4% / 20.1%' },
            { label: 'Asset Turnover', value: '0.9x' },
          ],
        },
      ],
      valuationHealth: [
        {
          category: 'Valuation (TTM)',
          items: [
            { label: 'P/E', value: '26.0x' },
            { label: 'P/B', value: '5.5x' },
            { label: 'P/S', value: '7.8x' },
            { label: 'EV/Sales', value: '8.1x' },
            { label: 'EV/EBITDA', value: '18.2x' },
            { label: 'EV/EBIT', value: '19.0x' },
            { label: 'P/OCF', value: '14.5x' },
            { label: 'P/FCF', value: '29.8x' },
          ],
        },
        {
          category: 'Valuation (Forward & Intrinsic)',
          items: [
            { label: 'Forward P/E', value: '23.5x' },
            { label: 'PEG (TTM)', value: '0.65' },
            { label: 'Forward PEG', value: '1.10' },
            { label: 'DCF Base Value', value: '$650.00' },
            { label: 'Margin of Safety', value: '+10.8%', highlight: 'positive' },
          ],
        },
        {
          category: 'Financial Health',
          items: [
            { label: 'Cash', value: '$58.1B' },
            { label: 'Total Debt', value: '$38.2B' },
            { label: 'Net Debt', value: '-$19.9B' },
            { label: 'Debt/Equity', value: '0.32' },
            { label: 'Current Ratio', value: '2.23' },
            { label: 'EBIT/Interest', value: '168.4x' },
          ],
        },
      ],
      growthDividends: [
        {
          category: 'Growth (CAGR / YoY)',
          items: [
            { label: 'Rev Growth (Q YoY)', value: '28.0%' },
            { label: 'Rev 1Yr (TTM)', value: '24.1%' },
            { label: 'Rev 3Yr CAGR', value: '19.9%' },
            { label: 'Rev 5Yr CAGR', value: '17.5%' },
            { label: 'EPS 1Yr (TTM)', value: '38.2%' },
            { label: 'Dil EPS 3Yr CAGR', value: '39.9%' },
            { label: 'Dil EPS 5Yr CAGR', value: '25.4%' },
            { label: 'EBITDA 5Yr CAGR', value: '20.9%' },
            { label: 'FCF 5Yr CAGR', value: '14.3%' },
            { label: 'CapEx 5Yr CAGR', value: '18.5%' },
            { label: 'TBV 5Yr CAGR', value: '16.2%' },
          ],
        },
        {
          category: 'Dividends & R&D Efficiency',
          items: [
            { label: 'Dividend Yield', value: '0.30%' },
            { label: 'Payout Ratio', value: '7.8%' },
            { label: 'DPS (Indicated)', value: '$2.10' },
            { label: 'R&D / Revenue', value: '26.2%' },
            { label: 'CapEx / OCF', value: '45.1%' },
            { label: 'Rev / Employee', value: '$2.93M' },
          ],
        },
      ],
    },
    updatedAt: '2026-10-22T12:00:00Z',
  };

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'mock-valid-jwt-token');
    });

    await page.route('**/api/auth/user/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            email: 'user@example.com',
            name: 'Test Investor',
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

    await page.route('**/api/watchlist', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { symbol: 'META', name: 'Meta Platforms, Inc.', sector_label: 'Communication Services' },
          { symbol: 'NVDA', name: 'NVIDIA Corporation', sector_label: 'Semiconductors' },
        ]),
      });
    });

    await page.route('**/api/analysis/overview*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockOverviewPayload),
      });
    });

    await page.route('**/api/analysis/coverage*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          META: { report: true, dcf: true, thesis: false, count: 2 },
          NVDA: { report: true, dcf: false, thesis: false, count: 1 },
        }),
      });
    });

    await page.route('**/api/analysis/results?symbol=META', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          symbol: 'META',
          summary: 'Meta boasts high cash generation and dominant scale in social platforms.',
          conviction_level: 'High',
          framework_results: JSON.stringify({}),
        }),
      });
    });

    await page.route('**/api/analysis/dcf?symbol=META', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scenarios: [
            { scenario_name: 'Base Case', implied_share_price: 650.0 },
          ],
        }),
      });
    });
  });

  test('1. Loads /analysis?symbol=META and defaults to Overview tab with full company profile', async ({ page }) => {
    // Navigate without specifying tab param to verify default tab selection
    await page.goto('/analysis?symbol=META');

    // Overview Tab should be selected
    const overviewTab = page.getByRole('tab', { name: /Overview/i });
    await expect(overviewTab).toBeVisible();
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    // Header strip details
    await expect(page.getByText('Meta Platforms, Inc.')).toBeVisible();
    await expect(page.getByText('Communication Services')).toBeVisible();
    await expect(page.getByText('Media')).toBeVisible();
    await expect(page.getByText(/NASDAQ • IPO 2012-05-18/i)).toBeVisible();

    // Global stock symbol selector
    const symbolSelector = page.getByRole('combobox');
    await expect(symbolSelector).toBeVisible();
    await expect(symbolSelector).toContainText('META');
  });

  test('2. Displays 3-column Company Statistics with authentic curated metrics', async ({ page }) => {
    await page.goto('/analysis?symbol=META&tab=overview');

    // Card title and Currency badge
    await expect(page.getByText('Company Statistics')).toBeVisible();
    await expect(page.getByText('USD', { exact: true })).toBeVisible();

    // Col 1: Profile & Margins
    await expect(page.getByText('Market Cap')).toBeVisible();
    await expect(page.getByText('$1.78T')).toBeVisible();
    await expect(page.getByText('Enterprise Value')).toBeVisible();
    await expect(page.getByText('$1.84T')).toBeVisible();
    await expect(page.getByText('Revenue (TTM)')).toBeVisible();
    await expect(page.getByText('$228.4B')).toBeVisible();
    await expect(page.getByText('$779.8 / $520.3')).toBeVisible(); // 52W High / Low
    await expect(page.getByText('81.8%')).toBeVisible(); // Gross margin
    await expect(page.getByText('42.5%')).toBeVisible(); // Operating margin

    // Col 2: Valuation & Health
    await expect(page.getByText('26.0x')).toBeVisible(); // P/E
    await expect(page.getByText('5.5x')).toBeVisible(); // P/B
    await expect(page.getByText('DCF Base Value')).toBeVisible();
    await expect(page.getByText('$650.00')).toBeVisible();
    await expect(page.getByText('Margin of Safety')).toBeVisible();
    await expect(page.getByText('+10.8%')).toBeVisible();
    await expect(page.getByText('$58.1B')).toBeVisible(); // Cash
    await expect(page.getByText('$38.2B')).toBeVisible(); // Total Debt

    // Col 3: Growth & Dividends
    await expect(page.getByText('Rev Growth (Q YoY)')).toBeVisible();
    await expect(page.getByText('28.0%')).toBeVisible();
    await expect(page.getByText('Rev 3Yr CAGR')).toBeVisible();
    await expect(page.getByText('19.9%')).toBeVisible();
    await expect(page.getByText('Dividend Yield')).toBeVisible();
    await expect(page.getByText('0.30%')).toBeVisible();
    await expect(page.getByText('R&D / Revenue')).toBeVisible();
    await expect(page.getByText('26.2%')).toBeVisible();
  });

  test('3. Interacts with Financial Performance Bar Chart (Quarterly/Annual switch & Hover Tooltip)', async ({ page }) => {
    await page.goto('/analysis?symbol=META&tab=overview');

    await expect(page.getByText('Financial Performance')).toBeVisible();

    // Frequency switcher buttons
    const quarterlyBtn = page.getByRole('button', { name: 'Quarterly' });
    const annualBtn = page.getByRole('button', { name: 'Annual' });

    await expect(quarterlyBtn).toBeVisible();
    await expect(annualBtn).toBeVisible();

    // Check SVG periods rendered for quarterly
    const svgChart = page.locator('svg').filter({ hasText: "Q2 '25" });
    await expect(svgChart).toBeVisible();
    await expect(page.getByText("Q2 '24")).toBeVisible();
    await expect(page.getByText("Q2 '25")).toBeVisible();

    // Check bar value labels
    await expect(page.getByText('47,516')).toBeVisible();
    await expect(page.getByText('64,601')).toBeVisible();

    // Switch to Annual
    await annualBtn.click();
    await expect(page.getByText('2023')).toBeVisible();
    await expect(page.getByText('2024')).toBeVisible();
    await expect(page.getByText('134,902')).toBeVisible();

    // Switch back to Quarterly
    await quarterlyBtn.click();
    await expect(page.getByText("Q2 '25")).toBeVisible();
  });

  test('4. Interactive Legend toggles series visibility and computes Total Change & CAGR', async ({ page }) => {
    await page.goto('/analysis?symbol=META&tab=overview');

    // Verify legend series and computed metrics
    const revHeader = page.getByText('Total Revenues', { exact: true });
    await expect(revHeader).toBeVisible();
    await expect(page.getByText('(Total Change: +35.96%)')).toBeVisible();
    await expect(page.getByText('(CAGR: +27.9%)').first()).toBeVisible();

    await expect(page.getByText('Gross Profit', { exact: true })).toBeVisible();
    await expect(page.getByText('Operating Profit', { exact: true })).toBeVisible();
    await expect(page.getByText('Cash from Operating Activities', { exact: true })).toBeVisible();
    await expect(page.getByText('Free Cash Flow', { exact: true })).toBeVisible();

    // Verify "47,516" data label is initially visible
    await expect(page.getByText('47,516')).toBeVisible();

    // Click "Total Revenues" to toggle visibility off
    await revHeader.click();

    // Verify "47,516" data label is hidden
    await expect(page.getByText('47,516')).toBeHidden();

    // Click again to restore visibility
    await revHeader.click();
    await expect(page.getByText('47,516')).toBeVisible();
  });

  test('5. Refresh button triggers refetch with refresh=true', async ({ page }) => {
    let refreshRequested = false;

    await page.route('**/api/analysis/overview?symbol=META&refresh=true', async (route) => {
      refreshRequested = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockOverviewPayload,
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/analysis?symbol=META&tab=overview');

    const refreshButton = page.getByTitle('Refresh overview from Finnhub & Yahoo Finance');
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // Wait for network response
    await page.waitForTimeout(500);
    expect(refreshRequested).toBe(true);
  });

  test('6. Tab switching between Overview, Report, DCF Model, and Stock Thesis', async ({ page }) => {
    await page.goto('/analysis?symbol=META&tab=overview');

    // Switch to Report
    const reportTab = page.getByRole('tab', { name: /Report/i });
    await reportTab.click();
    await expect(page).toHaveURL(/tab=report/);
    await expect(page.getByText(/Meta boasts high cash generation/i)).toBeVisible();

    // Switch to DCF Model
    const dcfTab = page.getByRole('tab', { name: /DCF Model/i });
    await dcfTab.click();
    await expect(page).toHaveURL(/tab=dcf-model/);

    // Switch to Stock Thesis
    const thesisTab = page.getByRole('tab', { name: /Stock Thesis/i });
    await thesisTab.click();
    await expect(page).toHaveURL(/tab=stock-thesis/);

    // Switch back to Overview
    const overviewTab = page.getByRole('tab', { name: /Overview/i });
    await overviewTab.click();
    await expect(page).toHaveURL(/tab=overview/);
    await expect(page.getByText('Company Statistics')).toBeVisible();
  });
});
