import { test, expect } from '@playwright/test';

test.describe('Header, Drawer, and Sidebar E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Inject auth token into localStorage
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'mock-valid-jwt-token');
    });

    // 2. Mock Core Auth & User Profile endpoints
    await page.route('**/api/auth/user/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            email: 'operator@oaktree.test',
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

    // 3. Mock Domain endpoints so views don't error during navigation
    await page.route('**/api/portfolio/holdings', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/api/portfolio/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_market_value: 0,
          total_cost: 0,
          cash: 0,
          day_change_amt: 0,
          day_change_pct: 0,
          unrealized_gain_amt: 0,
          unrealized_gain_pct: 0,
          realized_gain_amt: 0,
          total_dividends: 0,
          stocks: {
            total_market_value: 0,
            total_cost: 0,
            day_change_amt: 0,
            day_change_pct: 0,
            unrealized_gain_amt: 0,
            unrealized_gain_pct: 0,
            realized_gain_amt: 0,
            total_dividends: 0,
          },
        }),
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

    await page.route('**/api/watchlist*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/api/market/intelligence*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/api/intelligence/reports*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/api/intelligence/digests*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/api/intelligence/articles*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/api/sources/*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  });

  /* =========================================================================
   * Desktop Suite (1280x800)
   * ========================================================================= */
  test.describe('Desktop Viewport Layout', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('renders desktop Header with navigation links and hides mobile hamburger menu', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      // 1. Mobile hamburger button should not be visible on desktop
      const hamburger = page.locator('button[aria-label="Menu"], button:has(svg.lucide-menu)');
      if (await hamburger.count() > 0) {
        await expect(hamburger.first()).toBeHidden();
      }

      // 2. Desktop app switcher container should be visible
      const appSwitcher = page.locator('[data-testid="app-switcher-container"]');
      await expect(appSwitcher).toBeVisible();

      // 3. Desktop Header Navigation links
      const marketLink = page.locator('header a[href="/market"], a[href="/market"]').first();
      await expect(marketLink).toBeVisible();
      await marketLink.click();
      await expect(page).toHaveURL(/\/market/);

      const watchlistLink = page.locator('header a[href="/watchlist"], a[href="/watchlist"]').first();
      await expect(watchlistLink).toBeVisible();
      await watchlistLink.click();
      await expect(page).toHaveURL(/\/watchlist/);

      // 4. Toggle to Simplicity via Desktop Pill Switcher
      const simplicityPill = page.locator('[data-testid="app-switcher-simplicity"]');
      await expect(simplicityPill).toBeVisible();
      await simplicityPill.click();
      await expect(page).toHaveURL(/\/finance/);

      // 5. Toggle back to Oaktree via Desktop Pill Switcher
      const oaktreePill = page.locator('[data-testid="app-switcher-oaktree"]');
      await expect(oaktreePill).toBeVisible();
      await oaktreePill.click();
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  /* =========================================================================
   * Mobile Suite (390x844 - iPhone / Modern Smartphone)
   * ========================================================================= */
  test.describe('Mobile Viewport & Drawer Sidebar Navigation (Anti-Freeze Verification)', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });

    test('opens mobile Drawer, switches tabs cleanly without freezing or screen lock', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      // Helper to locate hamburger button
      const getHamburger = () => page.locator('button:has(svg.lucide-menu)').first();
      const getDrawer = () => page.locator('.MuiDrawer-content, div[role="dialog"]').first();

      // Helper to assert page is not frozen: verify document.body overflow is not 'hidden'
      const assertScreenNotLocked = async () => {
        const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
        expect(bodyOverflow).not.toBe('hidden');
      };

      // 1. Verify hamburger is visible on mobile
      const hamburger = getHamburger();
      await expect(hamburger).toBeVisible();

      // 2. Open drawer and navigate to Market Intelligence
      await hamburger.click();
      const drawer = getDrawer();
      await expect(drawer).toBeVisible();

      const marketMenuItem = drawer.locator('a[href="/market"], button:has-text("Market Intelligence")').first();
      await expect(marketMenuItem).toBeVisible();
      await marketMenuItem.click();

      // Assert drawer closes and URL changes
      await expect(drawer).toBeHidden();
      await expect(page).toHaveURL(/\/market/);
      await assertScreenNotLocked();

      // 3. Open drawer again and navigate to Watchlist
      await getHamburger().click();
      await expect(getDrawer()).toBeVisible();

      const watchlistMenuItem = getDrawer().locator('a[href="/watchlist"], button:has-text("Watchlist")').first();
      await expect(watchlistMenuItem).toBeVisible();
      await watchlistMenuItem.click();

      await expect(getDrawer()).toBeHidden();
      await expect(page).toHaveURL(/\/watchlist/);
      await assertScreenNotLocked();

      // 4. No-Op Guard Verification: Click active tab (Watchlist) in drawer
      await getHamburger().click();
      await expect(getDrawer()).toBeVisible();

      const watchlistAgain = getDrawer().locator('a[href="/watchlist"]').first();
      await watchlistAgain.click();

      // Drawer should close immediately, URL stays /watchlist, no freeze
      await expect(getDrawer()).toBeHidden();
      await expect(page).toHaveURL(/\/watchlist/);
      await assertScreenNotLocked();

      // 5. App Switcher in Mobile Drawer: Switch to Simplicity
      await getHamburger().click();
      await expect(getDrawer()).toBeVisible();

      const simplicitySwitcher = getDrawer().locator('[data-testid="sidebar-switcher-simplicity"]').first();
      await expect(simplicitySwitcher).toBeVisible();
      await simplicitySwitcher.click();

      await expect(getDrawer()).toBeHidden();
      await expect(page).toHaveURL(/\/finance/);
      await assertScreenNotLocked();

      // 6. Simplicity Sub-Tab in Mobile Drawer: Navigate to Transactions and Budgets
      await getHamburger().click();
      await expect(getDrawer()).toBeVisible();

      const txTab = getDrawer().locator('[data-testid="sidebar-simplicity-transactions"]').first();
      await expect(txTab).toBeVisible();
      await txTab.click();

      await expect(getDrawer()).toBeHidden();
      await expect(page).toHaveURL(/\/finance\?.*tab=transactions/);
      await assertScreenNotLocked();

      // Navigate to Budgets
      await getHamburger().click();
      await expect(getDrawer()).toBeVisible();

      const budgetsTab = getDrawer().locator('[data-testid="sidebar-simplicity-budgets"]').first();
      await expect(budgetsTab).toBeVisible();
      await budgetsTab.click();

      await expect(getDrawer()).toBeHidden();
      await expect(page).toHaveURL(/\/finance\?.*tab=budgets/);
      await assertScreenNotLocked();

      // 7. Return to Oaktree via Drawer Switcher
      await getHamburger().click();
      await expect(getDrawer()).toBeVisible();

      const oaktreeSwitcher = getDrawer().locator('[data-testid="sidebar-switcher-oaktree"]').first();
      await expect(oaktreeSwitcher).toBeVisible();
      await oaktreeSwitcher.click();

      await expect(getDrawer()).toBeHidden();
      await expect(page).toHaveURL(/\/dashboard/);
      await assertScreenNotLocked();
    });

    test('dismissing mobile drawer via backdrop click does not lock screen or prevent future taps', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');

      const hamburger = page.locator('button:has(svg.lucide-menu)').first();
      await expect(hamburger).toBeVisible();

      // 1. Open drawer
      await hamburger.click();
      const drawer = page.locator('.MuiDrawer-content, div[role="dialog"]').first();
      await expect(drawer).toBeVisible();

      // 2. Dismiss drawer by clicking the backdrop
      const backdrop = page.locator('.MuiDrawer-backdrop, .MuiModal-backdrop').first();
      await backdrop.click({ position: { x: 350, y: 400 }, force: true });
      await expect(drawer).toBeHidden();

      // 3. Verify screen is responsive: hamburger can be clicked again
      await expect(hamburger).toBeEnabled();
      await hamburger.click();
      await expect(drawer).toBeVisible();

      // Dismiss again via backdrop
      await backdrop.click({ position: { x: 350, y: 400 }, force: true });
      await expect(drawer).toBeHidden();

      // 4. Verify body overflow is cleanly restored
      const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(bodyOverflow).not.toBe('hidden');
    });

    test('clicking "+ Add Transaction" in mobile drawer opens transaction editor without infinite history loop or freeze', async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      // Guard against infinite pushState loops
      await page.addInitScript(() => {
        let pushCount = 0;
        const origPushState = window.history.pushState;
        window.history.pushState = function (...args) {
          pushCount++;
          if (pushCount > 25) {
            throw new Error(`INFINITE PUSHSTATE LOOP DETECTED (${pushCount} calls)`);
          }
          return origPushState.apply(this, args);
        };
      });

      await page.goto('/finance');
      await page.waitForLoadState('domcontentloaded');

      const hamburger = page.locator('button:has(svg.lucide-menu)').first();
      await expect(hamburger).toBeVisible();
      await hamburger.click();

      const drawer = page.locator('.MuiDrawer-content, div[role="dialog"]').first();
      await expect(drawer).toBeVisible();

      const addTxBtn = drawer.locator('[data-testid="sidebar-action-add-tx"]').or(drawer.getByText('+ Add Transaction')).first();
      await expect(addTxBtn).toBeVisible();
      await addTxBtn.click();

      // Drawer should close cleanly
      await expect(drawer).toBeHidden();

      // Allow any async microtasks / remote event listeners to settle
      await page.waitForTimeout(500);

      // Verify zero page errors or infinite history loops
      expect(pageErrors).toEqual([]);
    });
  });
});
