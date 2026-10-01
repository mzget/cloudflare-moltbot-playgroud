import { test, expect } from '@playwright/test';

test.describe('Command Center - Gmail Newsletters Tab', () => {
  const mockSubscriptions = [
    {
      id: 1,
      name: "Morning Brew Daily",
      sender: "crew@morningbrew.com",
      subject_filter: "Daily",
      label_filter: "newsletters",
      raw_query: "",
      frequency: "daily",
      is_active: 1,
      created_at: 1720000000,
    },
    {
      id: 2,
      name: "Finimize Macro",
      sender: "",
      subject_filter: "",
      label_filter: "",
      raw_query: "from:finimize.com has:attachment",
      frequency: "hourly",
      is_active: 1,
      created_at: 1720001000,
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Inject auth token into localStorage so user session is valid
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'mock-valid-jwt-token');
    });

    // Intercept authentication and general user state
    await page.route('**/api/auth/user/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            email: 'local@example.com',
            name: 'Local User',
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

    await page.route('**/api/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pause_daily_report_facebook: '0',
          pause_email_digest_facebook: '0',
          pause_custom_facebook: '0',
          pause_market_breakout_notifications: '0',
          pause_market_breakout_scan: '0',
        }),
      });
    });

    await page.route('**/api/sources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/reports', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/email-digests', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('should display connected Gmail status and list existing newsletter rules in the table', async ({ page }) => {
    await page.route('**/api/auth/google/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: true }),
      });
    });

    await page.route('**/api/subscriptions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSubscriptions),
      });
    });

    await page.goto('/command-center');

    // Switch to Gmail Newsletters tab
    const gmailTab = page.getByRole('tab', { name: /Gmail Newsletters/i });
    await expect(gmailTab).toBeVisible();
    await gmailTab.click();

    // Verify Gmail connection status
    await expect(page.getByText('Gmail API Connection')).toBeVisible();
    await expect(page.getByText('Connected to your Gmail account. Ready to poll newsletter emails.')).toBeVisible();

    // Verify action buttons exist
    await expect(page.getByRole('button', { name: /Sync Now/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Test Digest/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Disconnect/i })).toBeVisible();

    // Verify Newsletter Rules Table content
    await expect(page.getByText('Morning Brew Daily')).toBeVisible();
    await expect(page.getByText(/from:crew@morningbrew.com/i)).toBeVisible();
    await expect(page.getByText('Finimize Macro')).toBeVisible();
    await expect(page.getByText('from:finimize.com has:attachment')).toBeVisible();
  });

  test('should trigger manual background sync via /api/email-sync when clicking Sync Now', async ({ page }) => {
    let emailSyncCalled = false;

    await page.route('**/api/auth/google/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: true }),
      });
    });

    await page.route('**/api/subscriptions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSubscriptions),
      });
    });

    await page.route('**/api/email-sync', async (route) => {
      emailSyncCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'Email sync started via Workflow: manual-email-sync-123',
      });
    });

    // Automatically accept native browser alert dialog
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.goto('/command-center');
    await page.getByRole('tab', { name: /Gmail Newsletters/i }).click();

    const syncBtn = page.getByRole('button', { name: /Sync Now/i });
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();

    // Wait and assert that /api/email-sync was hit
    await expect.poll(() => emailSyncCalled).toBe(true);
    expect(dialogMessage).toContain('Gmail sync and AI summarization task started in background.');
  });

  test('should trigger single-email digest via /api/test-email-digest when clicking Test Digest', async ({ page }) => {
    let testDigestCalled = false;

    await page.route('**/api/auth/google/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: true }),
      });
    });

    await page.route('**/api/subscriptions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSubscriptions),
      });
    });

    await page.route('**/api/test-email-digest', async (route) => {
      testDigestCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Email digest generated successfully. Processed 1 email from queue.',
        }),
      });
    });

    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.goto('/command-center');
    await page.getByRole('tab', { name: /Gmail Newsletters/i }).click();

    const testDigestBtn = page.getByRole('button', { name: /Test Digest/i });
    await expect(testDigestBtn).toBeVisible();
    await testDigestBtn.click();

    await expect.poll(() => testDigestCalled).toBe(true);
    await expect.poll(() => dialogMessage).toContain('Email digest generated successfully!');
  });

  test('should open Add Newsletter Rule modal and submit a new subscription rule', async ({ page }) => {
    let createdPayload: any = null;

    await page.route('**/api/auth/google/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: true }),
      });
    });

    await page.route('**/api/subscriptions', async (route) => {
      if (route.request().method() === 'POST') {
        createdPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: 'Subscription added',
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockSubscriptions),
        });
      }
    });

    await page.goto('/command-center');
    await page.getByRole('tab', { name: /Gmail Newsletters/i }).click();

    // Click Add Newsletter Rule
    const addRuleBtn = page.getByRole('button', { name: /Add Newsletter Rule/i });
    await expect(addRuleBtn).toBeEnabled();
    await addRuleBtn.click();

    // Verify modal is open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Add Newsletter Rule/i })).toBeVisible();

    // Fill in rule form fields
    await page.getByPlaceholder(/Matt Levine's Money Stuff/i).fill("Howard Marks Memo");
    await page.getByPlaceholder(/newsletters@bloomberg\.net/i).fill("memo@oaktree.com");
    await page.getByPlaceholder(/^e\.g\. Money Stuff$/i).fill("The Indispensability of Risk");

    // Check live query preview alert
    await expect(page.getByText(/from:memo@oaktree.com subject:\(The Indispensability of Risk\)/i)).toBeVisible();

    // Save Rule
    const saveBtn = page.getByRole('button', { name: /Save Rule/i });
    await saveBtn.click();

    // Verify POST payload
    await expect.poll(() => createdPayload).not.toBeNull();
    expect(createdPayload.name).toBe("Howard Marks Memo");
    expect(createdPayload.sender).toBe("memo@oaktree.com");
    expect(createdPayload.subject_filter).toBe("The Indispensability of Risk");
  });

  test('should display disconnected prompt and disable Add Rule when Gmail is not connected', async ({ page }) => {
    await page.route('**/api/auth/google/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: false }),
      });
    });

    await page.route('**/api/subscriptions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/command-center');
    await page.getByRole('tab', { name: /Gmail Newsletters/i }).click();

    // Verify disconnected state
    await expect(page.getByText('Connect your Gmail account to ingest newsletters and run AI summarization.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect Gmail/i })).toBeVisible();

    // Add Newsletter Rule button should be disabled when not connected
    const addRuleBtn = page.getByRole('button', { name: /Add Newsletter Rule/i });
    await expect(addRuleBtn).toBeDisabled();
  });
});
