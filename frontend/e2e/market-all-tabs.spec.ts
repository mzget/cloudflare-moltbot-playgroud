import { test, expect } from '@playwright/test';

test.describe('Market Intelligence - All Tabs E2E Suite', () => {
  let mockReports: any[];
  let mockDigests: any[];
  let mockArticles: any[];

  test.beforeEach(async ({ page }) => {
    // Reset test mock data
    mockReports = [
      {
        id: 101,
        symbol: 'NVDA',
        report_date: '2026-10-07',
        sentiment_score: 0.8,
        summary: 'Strong datacenter revenue growth across all regions.',
        key_takeaways: JSON.stringify(['Record revenue in Q3', 'Gross margins above 75%']),
        is_readed: 0,
        created_at: 1720000000,
        source_type: 'daily_report',
      },
    ];

    mockDigests = [
      {
        id: 201,
        category: 'Semiconductor Digest',
        summary: 'Weekly summary of global chip makers and fab utilization.',
        key_takeaways: JSON.stringify(['TSMC expands N2 capacity', 'Packaging capacity tight']),
        source_emails: JSON.stringify([{ id: 'email-1', subject: 'Chip Weekly', sender: 'analyst@semi.com' }]),
        digest_date: '2026-10-07',
        created_at: 1720000000,
        is_readed: 0,
        source_type: 'email_digest',
      },
    ];

    mockArticles = [
      {
        id: 1,
        title: 'AI Revolution in Healthcare',
        symbol: 'PATH',
        summary: 'Machine learning applications transforming clinical diagnostics.',
        key_takeaways: JSON.stringify(['FDA approvals accelerated', 'High barrier to entry']),
        source: 'notebooklm',
        category: 'Healthcare',
        url: 'https://example.com/ai-health',
        auto_publish: 0,
        is_readed: 0,
        created_at: 1720000000,
        facebook_status: null,
        facebook_post_id: null,
        facebook_error: null,
        source_type: 'notebook_article',
      },
      {
        id: 2,
        title: 'Tech Valuation Memo',
        symbol: 'NVDA',
        summary: 'Howard Marks perspective on cyclical highs and margin of safety.',
        key_takeaways: JSON.stringify(['Valuation multiples elevated', 'Discipline matters']),
        source: 'gemini_spark',
        category: 'Tech & Semiconductors',
        url: 'https://example.com/tech-valuation',
        auto_publish: 0,
        is_readed: 0,
        created_at: 1720001000,
        facebook_status: null,
        facebook_post_id: null,
        facebook_error: null,
        source_type: 'notebook_article',
      },
    ];

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

    // Mock sidebar events to prevent noise
    await page.route('**/api/watchlist', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/market-events*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Intelligence Feed Endpoints
    await page.route('**/api/reports', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockReports),
      });
    });

    await page.route('**/api/reports/mark-read', async (route) => {
      const data = JSON.parse(route.request().postData() || '{}');
      mockReports = mockReports.map(r => r.id === data.id ? { ...r, is_readed: 1 } : r);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/email-digests', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDigests),
      });
    });

    await page.route('**/api/email-digests/mark-read', async (route) => {
      const data = JSON.parse(route.request().postData() || '{}');
      mockDigests = mockDigests.map(d => d.id === data.id ? { ...d, is_readed: 1 } : d);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/notebook-articles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockArticles.filter(a => (a.is_readed || 0) === 0)),
      });
    });

    await page.route('**/api/notebook-articles/mark-read', async (route) => {
      const data = JSON.parse(route.request().postData() || '{}');
      mockArticles = mockArticles.map(a => a.id === data.id ? { ...a, is_readed: 1 } : a);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Article marked as read' }),
      });
    });

    await page.route('**/api/notebook-articles/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        const url = route.request().url();
        const id = parseInt(url.split('/').pop() || '0', 10);
        mockArticles = mockArticles.filter(a => a.id !== id);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Article deleted successfully' }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test('1. "All" tab displays feeds from all 3 sources and shows unread badges', async ({ page }) => {
    await page.goto('/market');
    await page.waitForLoadState('networkidle');

    // Check title and feed tabs exist
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Symbol Reports' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Email Digests/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Articles & Analyses/i })).toBeVisible();

    // Check items from each source in 'All' tab
    await expect(page.getByText('Strong datacenter revenue growth across all regions.')).toBeVisible();
    await expect(page.getByText('Semiconductor Digest')).toBeVisible();
    await expect(page.getByText('AI Revolution in Healthcare')).toBeVisible();
    await expect(page.getByText('Tech Valuation Memo')).toBeVisible();
  });

  test('2. "Symbol Reports" tab filters only reports and can mark report as read', async ({ page }) => {
    await page.goto('/market');
    await page.waitForLoadState('networkidle');

    // Switch to Symbol Reports tab
    await page.getByRole('button', { name: 'Symbol Reports' }).click();

    // Only symbol report visible, others filtered out
    await expect(page.getByText('Strong datacenter revenue growth across all regions.')).toBeVisible();
    await expect(page.getByText('Semiconductor Digest')).not.toBeVisible();
    await expect(page.getByText('AI Revolution in Healthcare')).not.toBeVisible();

    // Click Mark as Read on the report
    const markReadBtn = page.getByRole('button', { name: 'Mark as Read' });
    if (await markReadBtn.isVisible()) {
      await markReadBtn.click();
      // Should show 'Read' chip
      await expect(page.getByText('Read', { exact: true })).toBeVisible();
    }
  });

  test('3. "Email Digests" tab filters only digests and marks digest as read', async ({ page }) => {
    await page.goto('/market');
    await page.waitForLoadState('networkidle');

    // Switch to Email Digests tab
    await page.getByRole('button', { name: /Email Digests/i }).click();

    // Only email digest visible
    await expect(page.getByText('Semiconductor Digest')).toBeVisible();
    await expect(page.getByText('Strong datacenter revenue growth across all regions.')).not.toBeVisible();
    await expect(page.getByText('AI Revolution in Healthcare')).not.toBeVisible();

    // Mark digest as read
    const markReadBtn = page.getByRole('button', { name: 'Mark as Read' });
    await expect(markReadBtn).toBeVisible();
    await markReadBtn.click();

    // Optimistic UI updates digest list
    await expect(page.getByText('Semiconductor Digest')).not.toBeVisible();
    // Tab empty state
    await expect(page.getByText(/No email digests generated yet/i)).toBeVisible();
  });

  test('4. "Articles & Analyses" tab - verifies no bottom delete button, marks article as read', async ({ page }) => {
    await page.goto('/market');
    await page.waitForLoadState('networkidle');

    // Switch to Articles & Analyses tab
    await page.getByRole('button', { name: /Articles & Analyses/i }).click();

    // Verify articles are visible and others are filtered out
    await expect(page.getByText('AI Revolution in Healthcare')).toBeVisible();
    await expect(page.getByText('Tech Valuation Memo')).toBeVisible();
    await expect(page.getByText('Semiconductor Digest')).not.toBeVisible();
    await expect(page.getByText('Strong datacenter revenue growth across all regions.')).not.toBeVisible();

    // Verify NO regular text button "Delete Article" exists on cards (only top-right icon buttons with tooltip)
    const cardContent = page.locator('.MuiCardContent-root');
    await expect(cardContent.getByRole('button', { name: 'Delete Article', exact: true })).toHaveCount(0);

    // Verify top-right header trash icon button exists on each card
    const headerTrashButtons = page.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
    await expect(headerTrashButtons).toHaveCount(2);

    // Mark "Tech Valuation Memo" article as read
    const targetArticleCard = page.locator('.MuiCard-root').filter({ hasText: 'Tech Valuation Memo' });
    const markReadBtn = targetArticleCard.getByRole('button', { name: 'Mark as Read' });
    await expect(markReadBtn).toBeVisible();
    await markReadBtn.click();

    // Verify article is removed from view once marked as read
    await expect(page.getByText('Tech Valuation Memo')).not.toBeVisible();
  });

  test('5. "Articles & Analyses" tab - delete article with confirmation modal dialog', async ({ page }) => {
    await page.goto('/market');
    await page.waitForLoadState('networkidle');

    // Switch to Articles & Analyses tab
    await page.getByRole('button', { name: /Articles & Analyses/i }).click();
    await expect(page.getByText('AI Revolution in Healthcare')).toBeVisible();

    // Locate the specific article card for "AI Revolution in Healthcare"
    const targetArticleCard = page.locator('.MuiCard-root').filter({ hasText: 'AI Revolution in Healthcare' });
    const trashButton = targetArticleCard.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
    await trashButton.click();

    // Modal dialog opens
    const modalDialog = page.locator('div[role="alertdialog"]');
    await expect(modalDialog).toBeVisible();
    await expect(modalDialog.getByRole('heading', { name: 'Delete Article' })).toBeVisible();
    await expect(modalDialog.getByText(/Are you sure you want to delete/i)).toBeVisible();

    // Test Cancel button inside modal dialog
    await modalDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(modalDialog).not.toBeVisible();
    // Article should still be visible
    await expect(page.getByText('AI Revolution in Healthcare')).toBeVisible();

    // Click trash button again and confirm delete
    await trashButton.click();
    await expect(modalDialog).toBeVisible();
    const confirmDeleteBtn = modalDialog.getByRole('button', { name: 'Delete Article' });
    await confirmDeleteBtn.click();

    // Dialog should close and the specific article should be removed from view
    await expect(modalDialog).not.toBeVisible();
    await expect(page.getByText('AI Revolution in Healthcare')).not.toBeVisible();
    // The second article should still remain
    await expect(page.getByText('Tech Valuation Memo')).toBeVisible();
  });
});
