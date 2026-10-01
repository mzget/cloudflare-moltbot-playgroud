import { test, expect } from '@playwright/test';

test.describe('Watchlist Breakouts Feature', () => {
	const mockBreakoutsPayload = {
		summary: {
			totalWatchlist: 2,
			athCount: 1,
			high52wCount: 0,
			low52wCount: 0,
			atlCount: 0,
			nearAthCount: 0,
			nearHigh52wCount: 1,
			nearLow52wCount: 0,
			nearAtlCount: 0,
			totalBreakouts: 1,
			highsRatio: 100,
			lowsRatio: 0
		},
		todayBreakouts: [
			{
				symbol: 'NVDA',
				name: 'NVIDIA Corporation',
				price: 140.0,
				percentChange: 3.5,
				yearHigh: 135.0,
				yearLow: 70.0,
				allTimeHigh: 138.0,
				allTimeLow: 30.0,
				breakoutType: 'ath'
			}
		],
		matrix: [
			{
				symbol: 'NVDA',
				name: 'NVIDIA Corporation',
				sectorLabel: 'AI Chips',
				price: 140.0,
				percentChange: 3.5,
				yearHigh: 135.0,
				yearLow: 70.0,
				allTimeHigh: 138.0,
				allTimeLow: 30.0,
				distance52wHigh: 3.7,
				distanceAth: 1.45,
				distance52wLow: 100.0,
				distanceAtl: 366.67,
				status: 'ath'
			},
			{
				symbol: 'MSFT',
				name: 'Microsoft Corp',
				sectorLabel: 'Cloud',
				price: 395.0,
				percentChange: 0.5,
				yearHigh: 400.0,
				yearLow: 300.0,
				allTimeHigh: 450.0,
				allTimeLow: 50.0,
				distance52wHigh: -1.25,
				distanceAth: -12.22,
				distance52wLow: 31.67,
				distanceAtl: 690.0,
				status: 'near_52w_high'
			}
		]
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
						name: 'Test User',
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

		await page.route('**/api/watchlist-breakouts', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(mockBreakoutsPayload),
			});
		});

		await page.route('**/api/market-breakouts*', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(mockBreakoutsPayload),
			});
		});

		await page.route('**/api/scan-watchlist', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					count: 1,
					...mockBreakoutsPayload
				}),
			});
		});

		await page.route('**/api/scan-market', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					count: 1,
					...mockBreakoutsPayload
				}),
			});
		});
	});

	test('should display Watchlist Breakouts tab with summary cards, active breakouts, and matrix', async ({ page }) => {
		await page.goto('/watchlist');

		const breakoutsTab = page.getByRole('tab', { name: /Watchlist Breakouts/i });
		await expect(breakoutsTab).toBeVisible();
		await breakoutsTab.click();

		await expect(page.getByRole('heading', { name: 'Watchlist Breakouts', level: 2 })).toBeVisible();
		const scanButton = page.getByRole('button', { name: /Scan Watchlist/i });
		await expect(scanButton).toBeVisible();

		await expect(page.getByText('All-Time High', { exact: true })).toBeVisible();
		await expect(page.getByText('52-Week High', { exact: true })).toBeVisible();
		await expect(page.getByText('52-Week Low', { exact: true })).toBeVisible();
		await expect(page.getByText('All-Time Low', { exact: true })).toBeVisible();

		await expect(page.getByText(/Today's Active Breakouts/i)).toBeVisible();
		await expect(page.getByText('NVDA', { exact: false }).first()).toBeVisible();

		await expect(page.getByText(/Watchlist Proximity Matrix/i)).toBeVisible();
		await expect(page.getByText('MSFT')).toBeVisible();
		await expect(page.getByText('Near 52W High')).toBeVisible();

		await scanButton.click();
		await expect(page.getByText(/Scan complete/i)).toBeVisible();
	});
});
