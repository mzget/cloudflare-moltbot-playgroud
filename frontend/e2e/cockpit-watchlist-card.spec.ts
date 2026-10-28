import { test, expect } from '@playwright/test';

test.describe('Cockpit Integrated Watchlist Card E2E Suite', () => {
  const mockRmbsOverview = {
    symbol: 'RMBS',
    name: 'Rambus Inc.',
    exchange: 'NASDAQ',
    sector: 'Technology',
    industry: 'Semiconductors',
    currency: 'USD',
    updatedAt: '2026-10-27',
    price: 52.0,
    annual: [],
    quarterly: [],
    dcfScenarios: {
      price: 52.0,
      bear: 45.0,
      base: 65.0,
      bull: 80.0,
      wacc: 9.5,
      terminalGrowth: 3.0,
    },
    companyStatistics: {
      profileMarginsReturns: [],
      valuationHealth: [],
      growthDividends: [],
    },
  };

  const mockRmbsWatchlistItem = {
    symbol: 'RMBS',
    name: 'Rambus Inc.',
    is_active: 1,
    in_portfolio: 1,
    type: 'STOCK',
    active_alerts_count: 2,
    sector_label: 'IP, Memory, HBM, MRDIMM, CXL',
    sector_label_color: '#10b981',
    mos_price: 52.0,
    dcf_bear: 45.0,
    dcf_base: 65.0,
    dcf_bull: 80.0,
    mos_base: -25.9,
  };

  const mockRmbsFundamental = {
    symbol: 'RMBS',
    company_name: 'Rambus Inc.',
    as_of_date: '2026-09-30',
    status: 'active',
    source_count: 5,
    theme_tags: ['Semiconductor & Memory IP'],
    updated_at: '2026-09-30T10:00:00Z',
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
            email: 'investor@oaktree.test',
            name: 'Oaktree Partner',
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

    await page.route('**/api/analysis/overview?symbol=RMBS*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRmbsOverview),
      });
    });

    await page.route('**/api/analysis/results?symbol=RMBS*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          symbol: 'RMBS',
          summary: 'Rambus deep value fundamental analysis.',
          conviction_level: 'High',
          created_at: '2026-10-27',
          debate: {
            symbol: 'RMBS',
            synthesis: { conviction_label: 'High' },
          },
        }),
      });
    });

    await page.route('**/api/analysis/theses?symbol=RMBS*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/portfolio/risk-audit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          concentration: {
            totalStockPortfolioUsd: 150000,
            openHoldingsCount: 5,
            holdings: [{ symbol: 'RMBS', currentPrice: 52.0 }],
          },
          themeMappings: [],
        }),
      });
    });

    await page.route('**/api/watchlist', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockRmbsWatchlistItem]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: 'Symbol updated',
        });
      }
    });

    await page.route('**/api/fundamentals/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [mockRmbsFundamental],
        }),
      });
    });

    await page.route('**/api/market-events/today', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/alert-rules?symbol=RMBS', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('1. Renders merged watchlist governance controls, metadata, and buttons in Cockpit Hero Header', async ({ page }) => {
    await page.goto('/analysis?symbol=RMBS&tab=dossier');

    // Header Grid layout is visible
    await expect(page.locator('[data-testid="cockpit-header-grid"]')).toBeVisible();

    // Header contains Symbol and Company details
    await expect(page.getByText('RMBS').first()).toBeVisible();
    await expect(page.getByText('Rambus Inc.').first()).toBeVisible();
    await expect(page.getByText('STOCK', { exact: true })).toBeVisible();

    // Subtitle sector label chip
    await expect(page.getByText('IP, Memory, HBM, MRDIMM, CXL').first()).toBeVisible();

    // Fundamental freshness badge & info in header
    await expect(page.getByText(/Active \(<90d\)/i).first()).toBeVisible();
    await expect(page.getByText('2026-09-30').first()).toBeVisible();
    await expect(page.getByText('5 srcs').first()).toBeVisible();

    // Merged switches in Header
    await expect(page.locator('[data-testid="cockpit-active-switch"]')).toBeVisible();
    await expect(page.locator('[data-testid="cockpit-portfolio-switch"]')).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await expect(page.getByText('Portfolio', { exact: true })).toBeVisible();

    // Merged Action buttons in Header: Edit & Alerts
    const editBtn = page.locator('[data-testid="cockpit-edit-security-btn"]');
    await expect(editBtn).toBeVisible();

    const alertsBtn = page.locator('[data-testid="cockpit-alerts-btn"]');
    await expect(alertsBtn).toBeVisible();
    await expect(page.getByText('2', { exact: true })).toBeVisible();
  });

  test('2. Strictly verifies redundant separate Watchlist Card is removed from Cockpit', async ({ page }) => {
    await page.goto('/analysis?symbol=RMBS&tab=dossier');

    // Separate Watchlist Card container must NOT exist
    const cardSection = page.locator('[data-testid="cockpit-watchlist-card-section"]');
    await expect(cardSection).toHaveCount(0);

    const watchlistCard = page.locator('[data-testid="watchlist-card"]');
    await expect(watchlistCard).toHaveCount(0);

    // Copy Prompt button must NOT exist anywhere in Cockpit
    const copyPromptBtn = page.getByRole('button', { name: /Copy Prompt/i });
    await expect(copyPromptBtn).toHaveCount(0);
  });

  test('3. Allows toggling Active and Portfolio switches from within Cockpit Hero Header', async ({ page }) => {
    let putPayload: any = null;
    await page.route('**/api/watchlist', async (route) => {
      if (route.request().method() === 'PUT') {
        putPayload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({ status: 200, body: 'Symbol updated' });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockRmbsWatchlistItem]),
        });
      }
    });

    await page.goto('/analysis?symbol=RMBS&tab=dossier');

    const activeSwitchInput = page.locator('[data-testid="cockpit-active-switch"] input[type="checkbox"]');
    await expect(activeSwitchInput).toBeVisible();

    await activeSwitchInput.click();
    await page.waitForTimeout(300);

    expect(putPayload).not.toBeNull();
    expect(putPayload.symbol).toBe('RMBS');
    expect(putPayload.is_active).toBe(0);
  });

  test('4. Clicking Edit button and Alerts button opens their respective dialog modals', async ({ page }) => {
    await page.goto('/analysis?symbol=RMBS&tab=dossier');

    // 1. Click Edit button -> opens Edit Security Modal
    const editBtn = page.locator('[data-testid="cockpit-edit-security-btn"]');
    await editBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Edit Security/i).first()).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 2. Click Alerts button -> opens Alerts Manager Modal
    const alertsBtn = page.locator('[data-testid="cockpit-alerts-btn"]');
    await alertsBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Alert Manager: RMBS/i)).toBeVisible();
  });
});
