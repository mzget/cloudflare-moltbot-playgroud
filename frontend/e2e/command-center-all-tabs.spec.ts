import { test, expect } from '@playwright/test';

test.describe('Command Center - All 3 Tabs E2E Suite', () => {
  const mockWebSources = [
    {
      id: 1,
      name: 'Google News AI & Tech',
      url_pattern: 'https://news.google.com/rss/search?q={symbol}+AI',
      selector: '',
      type: 'RSS',
      enabled: 1,
      created_at: 1720000000,
    },
    {
      id: 2,
      name: 'Yahoo Finance Headlines',
      url_pattern: 'https://finance.yahoo.com/quote/{symbol}/news',
      selector: "section[data-test='qsp-news'] a",
      type: 'WEB',
      enabled: 0,
      created_at: 1720001000,
    },
  ];

  const mockSubscriptions = [
    {
      id: 1,
      name: 'Morning Brew Daily',
      sender: 'crew@morningbrew.com',
      subject_filter: 'Daily',
      label_filter: 'newsletters',
      raw_query: '',
      frequency: 'daily',
      is_active: 1,
      created_at: 1720000000,
    },
    {
      id: 2,
      name: 'Howard Marks Memos',
      sender: 'memo@oaktree.com',
      subject_filter: '',
      label_filter: '',
      raw_query: 'from:memo@oaktree.com',
      frequency: 'daily',
      is_active: 1,
      created_at: 1720001000,
    },
  ];

  const mockCustomPosts = [
    {
      id: 10,
      source_type: 'custom',
      source_id: 0,
      thai_title: 'สรุปงบการเงินไตรมาส 3 NVIDIA',
      thai_content: 'รายได้ Data Center โตกว่า 150% โดยความต้องการชิป Blackwell ยังคงแข็งแกร่งอย่างต่อเนื่อง',
      status: 'draft',
      facebook_post_id: null,
      error_message: null,
      created_at: 1720000000,
    },
    {
      id: 11,
      source_type: 'custom',
      source_id: 0,
      thai_title: 'ข้อคิดการลงทุน Howard Marks',
      thai_content: 'การตระหนักรู้ในความเสี่ยงคือหัวใจสำคัญของการสร้างผลตอบแทนระยะยาว',
      status: 'posted',
      facebook_post_id: 'fb-post-9999',
      error_message: null,
      created_at: 1720002000,
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Inject auth token so session is valid
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'mock-valid-jwt-token');
    });

    // Intercept user auth and preferences
    await page.route('**/api/auth/user/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { email: 'admin@oaktree.local', name: 'Oaktree Admin', picture: '' },
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

    // Mock initial system settings including pause_notebook_facebook
    await page.route('**/api/settings', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            pause_daily_report_facebook: '0',
            pause_email_digest_facebook: '0',
            pause_custom_facebook: '0',
            pause_notebook_facebook: '0',
            pause_market_breakout_notifications: '0',
            pause_market_breakout_scan: '0',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Mock empty reports and email digests
    await page.route('**/api/reports', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/email-digests', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/notebook-articles', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  // ==========================================
  // TAB 1: WEB & RSS CRAWLER
  // ==========================================
  test.describe('Tab 1: Web & RSS Crawler', () => {
    test('displays crawler controls, active web targets table, and handles Add Source modal', async ({ page }) => {
      let createdSourcePayload: any = null;

      await page.route('**/api/sources', async (route) => {
        if (route.request().method() === 'POST') {
          createdSourcePayload = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, id: 3 }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockWebSources),
          });
        }
      });

      await page.goto('/command-center');

      // Verify Tab 1 is active by default
      const crawlerTab = page.getByRole('tab', { name: /Web & RSS Crawler/i });
      await expect(crawlerTab).toBeVisible();

      // Verify Controls & Header
      await expect(page.getByText('Crawler & Report Controls')).toBeVisible();
      await expect(page.getByText('Active Web Targets')).toBeVisible();

      // Verify Table Rows
      await expect(page.getByText('Google News AI & Tech')).toBeVisible();
      await expect(page.getByText('https://news.google.com/rss/search?q={symbol}+AI')).toBeVisible();
      await expect(page.getByText('Yahoo Finance Headlines')).toBeVisible();

      // Open Add Source Modal
      const addSourceBtn = page.getByRole('button', { name: /Add Source/i });
      await expect(addSourceBtn).toBeVisible();
      await addSourceBtn.click();

      // Verify Add Source dialog
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /Add Source/i })).toBeVisible();

      // Fill in source form
      await page.getByPlaceholder(/e\.g\. Yahoo News Tech/i).fill('Bloomberg Tech RSS');
      await page.getByPlaceholder(/https:\/\/finance\.yahoo\.com/i).fill('https://bloomberg.com/feed/{symbol}');

      // Save Source
      const saveSourceBtn = page.getByRole('button', { name: /Save Source/i });
      await saveSourceBtn.click();

      // Verify API was called with correct payload
      await expect.poll(() => createdSourcePayload).not.toBeNull();
      expect(createdSourcePayload.name).toBe('Bloomberg Tech RSS');
      expect(createdSourcePayload.url_pattern).toBe('https://bloomberg.com/feed/{symbol}');
      expect(createdSourcePayload.type).toBe('RSS');
    });
  });

  // ==========================================
  // TAB 2: GMAIL NEWSLETTERS
  // ==========================================
  test.describe('Tab 2: Gmail Newsletters', () => {
    test('displays connection status, sync buttons, and opens Add Rule modal', async ({ page }) => {
      let emailSyncTriggered = false;
      let createdSubPayload: any = null;

      await page.route('**/api/auth/google/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ connected: true }),
        });
      });

      await page.route('**/api/subscriptions', async (route) => {
        if (route.request().method() === 'POST') {
          createdSubPayload = route.request().postDataJSON();
          await route.fulfill({ status: 200, contentType: 'text/plain', body: 'Subscription added' });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockSubscriptions),
          });
        }
      });

      await page.route('**/api/email-sync', async (route) => {
        emailSyncTriggered = true;
        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: 'Email sync started via Workflow',
        });
      });

      // Accept native dialogs
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await page.goto('/command-center');

      // Click Tab 2
      const gmailTab = page.getByRole('tab', { name: /Gmail Newsletters/i });
      await expect(gmailTab).toBeVisible();
      await gmailTab.click();

      // Verify Gmail Connection & Action Buttons
      await expect(page.getByText('Gmail API Connection')).toBeVisible();
      await expect(page.getByRole('button', { name: /Sync Now/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Test Digest/i })).toBeVisible();

      // Verify table items
      await expect(page.getByText('Morning Brew Daily')).toBeVisible();
      await expect(page.getByText('Howard Marks Memos')).toBeVisible();

      // Click Sync Now
      await page.getByRole('button', { name: /Sync Now/i }).click();
      await expect.poll(() => emailSyncTriggered).toBe(true);

      // Open Add Newsletter Rule Modal
      const addRuleBtn = page.getByRole('button', { name: /Add Newsletter Rule/i });
      await addRuleBtn.click();

      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByPlaceholder(/Matt Levine's Money Stuff/i).fill('Stratechery by Ben Thompson');
      await page.getByPlaceholder(/newsletters@bloomberg\.net/i).fill('ben@stratechery.com');
      await page.getByRole('button', { name: /Save Rule/i }).click();

      await expect.poll(() => createdSubPayload).not.toBeNull();
      expect(createdSubPayload.name).toBe('Stratechery by Ben Thompson');
      expect(createdSubPayload.sender).toBe('ben@stratechery.com');
    });
  });

  // ==========================================
  // TAB 3: FACEBOOK PAGE
  // ==========================================
  test.describe('Tab 3: Facebook Page', () => {
    test('displays all 4 pause toggles including pause_notebook_facebook and allows toggling', async ({ page }) => {
      let updatedSettingPayload: any = null;

      await page.route('**/api/settings', async (route) => {
        if (route.request().method() === 'POST') {
          updatedSettingPayload = route.request().postDataJSON();
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              pause_daily_report_facebook: '0',
              pause_email_digest_facebook: '0',
              pause_notebook_facebook: '0',
              pause_custom_facebook: '0',
            }),
          });
        }
      });

      await page.route('**/api/facebook/posts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCustomPosts),
        });
      });

      await page.goto('/command-center');

      // Click Tab 3
      const fbTab = page.getByRole('tab', { name: /Facebook Page/i });
      await expect(fbTab).toBeVisible();
      await fbTab.click();

      // Verify Facebook Auto-Posting Controls section
      await expect(page.getByText('Facebook Auto-Posting Controls')).toBeVisible();

      // Verify all 4 pause cards exist
      await expect(page.getByText('Pause Daily Reports Posting')).toBeVisible();
      await expect(page.getByText('Pause Email Digests Posting')).toBeVisible();
      await expect(page.getByText('Pause Articles & Analyses')).toBeVisible();
      await expect(page.getByText('Pause Custom Posts Posting')).toBeVisible();

      // Locate the Pause Articles & Analyses switch
      const articlesCard = page.locator('div').filter({ hasText: /^Pause Articles & Analyses/ }).first();
      await expect(articlesCard).toBeVisible();

      // Toggle Pause Articles & Analyses
      const articlesSwitch = articlesCard.locator('input[type="checkbox"]');
      await expect(articlesSwitch).not.toBeChecked();
      await articlesSwitch.click();

      // Assert that POST /api/settings received pause_notebook_facebook = '1'
      await expect.poll(() => updatedSettingPayload).not.toBeNull();
      expect(updatedSettingPayload).toEqual({ pause_notebook_facebook: '1' });
    });

    test('lists custom posts, creates draft via modal, and triggers Post Now', async ({ page }) => {
      let createdPostPayload: any = null;
      let postNowCalledWithId: string | null = null;

      await page.route('**/api/facebook/posts', async (route) => {
        if (route.request().method() === 'POST') {
          createdPostPayload = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, message: 'Custom post draft created' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockCustomPosts),
          });
        }
      });

      await page.route('**/api/facebook/posts/*/post-now', async (route) => {
        const url = route.request().url();
        const idMatch = url.match(/\/api\/facebook\/posts\/(\d+)\/post-now/);
        if (idMatch) postNowCalledWithId = idMatch[1];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, facebookPostId: 'fb-posted-now-10' }),
        });
      });

      // Accept window.confirm
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await page.goto('/command-center');
      await page.getByRole('tab', { name: /Facebook Page/i }).click();

      // Verify custom posts table
      await expect(page.getByText('Custom Standalone Posts')).toBeVisible();
      await expect(page.getByText('สรุปงบการเงินไตรมาส 3 NVIDIA')).toBeVisible();
      await expect(page.getByText('ข้อคิดการลงทุน Howard Marks')).toBeVisible();

      // Open Create Custom Post Modal
      const createPostBtn = page.getByRole('button', { name: /Create Custom Post/i });
      await expect(createPostBtn).toBeVisible();
      await createPostBtn.click();

      // Verify Modal
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /Create Custom Post/i })).toBeVisible();

      // Fill in title and content
      await page.getByPlaceholder(/Tesla Q2 Earnings Analysis/i).fill('วิเคราะห์แนวโน้มชิป AI ปี 2026');
      await page.getByPlaceholder(/Write your Facebook post here\.\.\./i).fill('ตลาด AI กำลังเข้าสู่ยุค Reasoning Model อย่างเต็มตัว');

      // Click Save Draft
      const saveDraftBtn = page.getByRole('button', { name: /Save Draft/i });
      await saveDraftBtn.click();

      // Assert draft payload
      await expect.poll(() => createdPostPayload).not.toBeNull();
      expect(createdPostPayload.title).toBe('วิเคราะห์แนวโน้มชิป AI ปี 2026');
      expect(createdPostPayload.content).toBe('ตลาด AI กำลังเข้าสู่ยุค Reasoning Model อย่างเต็มตัว');
      expect(createdPostPayload.status).toBe('draft');

      // Now test Post Now by clicking on the custom post to open Edit Modal
      await page.getByText('สรุปงบการเงินไตรมาส 3 NVIDIA').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: /Edit Custom Post/i })).toBeVisible();

      // Click Post Now inside the Edit Modal
      const postNowBtn = page.getByRole('button', { name: /Post Now/i });
      await expect(postNowBtn).toBeVisible();
      await postNowBtn.click();

      // Verify Post Now endpoint was called with correct ID
      await expect.poll(() => postNowCalledWithId).toBe('10');
    });
  });
});

