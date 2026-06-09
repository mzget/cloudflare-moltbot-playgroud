const fs = require('fs');

const databaseChatSpec = `import { test, expect } from '@playwright/test';
import { MockFactory } from './helpers/mock-factory';

test.describe('Database Chat Agent', () => {
  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
  });

  test('Scenario 1: Database Chat Status Connected vs Disabled', async ({ page }) => {
    const mock = new MockFactory(page);
    
    // Part A: Disabled State
    await mock.mockDatabaseStatus(false);
    await mock.mockDefaultServices();
    await page.goto('/?tab=db-agent');
    
    const input = page.locator('input[placeholder="Console is temporarily disabled."]');
    await expect(input).toBeDisabled();
    await expect(page.locator('text=Console Offline')).toBeVisible();
    await expect(page.locator('text=Console Temporarily Offline')).toBeVisible();
    
    // Part B: Enabled State
    await mock.mockDatabaseStatus(true);
    await page.goto('/?tab=db-agent');
    
    const enabledInput = page.locator('input[placeholder="Ask a question or enter a SQL query..."]');
    await expect(enabledInput).toBeEnabled();
    await expect(page.locator('text=D1 & R2 Connected')).toBeVisible();
  });

  test('Scenario 2: List D1 Tables Rendering', async ({ page }) => {
    const mock = new MockFactory(page);
    await mock.mockDatabaseStatus(true);
    await mock.mockDefaultServices();
    
    await mock.mockChatStream('**/database-chat', [
      { type: 'text', content: 'Scanning database...' },
      { type: 'tool_call', id: 'call_list_0', name: 'list_d1_tables', args: {} },
      { type: 'tool_result', id: 'call_list_0', result: { tables: ['watchlist', 'portfolio', 'market_events'] } }
    ]);
    
    await page.goto('/?tab=db-agent');
    
    const input = page.locator('input[placeholder="Ask a question or enter a SQL query..."]');
    await input.fill('List D1 tables');
    await input.press('Enter');
    
    // Check that table names are rendered as Chips
    await expect(page.locator('.MuiChip-root:has-text("watchlist")')).toBeVisible();
    await expect(page.locator('.MuiChip-root:has-text("portfolio")')).toBeVisible();
    await expect(page.locator('.MuiChip-root:has-text("market_events")')).toBeVisible();
  });

  test('Scenario 3: Get Table Schema Rendering', async ({ page }) => {
    const mock = new MockFactory(page);
    await mock.mockDatabaseStatus(true);
    await mock.mockDefaultServices();
    
    await mock.mockChatStream('**/database-chat', [
      { type: 'text', content: 'Reading watchlist schema...' },
      { type: 'tool_call', id: 'call_schema_0', name: 'get_d1_table_schema', args: { table: 'watchlist' } },
      { type: 'tool_result', id: 'call_schema_0', result: { table: 'watchlist', schema: [{ cid: 0, name: 'symbol', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 }] } }
    ]);
    
    await page.goto('/?tab=db-agent');
    
    const input = page.locator('input[placeholder="Ask a question or enter a SQL query..."]');
    await input.fill('Show schema of watchlist table');
    await input.press('Enter');
    
    // Check that schema table is rendered
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('td:has-text("symbol")')).toBeVisible();
    await expect(page.locator('td:has-text("TEXT")')).toBeVisible();
  });

  test('Scenario 4: SQL SELECT Query (Success & Truncation)', async ({ page }) => {
    const mock = new MockFactory(page);
    await mock.mockDatabaseStatus(true);
    await mock.mockDefaultServices();
    
    await mock.mockChatStream('**/database-chat', [
      { type: 'tool_call', id: 'call_sql_0', name: 'execute_d1_sql', args: { sql: 'SELECT * FROM watchlist' } },
      { type: 'tool_result', id: 'call_sql_0', result: { success: true, results: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }], truncated: true } }
    ]);
    
    await page.goto('/?tab=db-agent');
    
    const input = page.locator('input[placeholder="Ask a question or enter a SQL query..."]');
    await input.fill('SELECT * FROM watchlist');
    await input.press('Enter');
    
    // Check table headers and rows
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('th:has-text("symbol")')).toBeVisible();
    await expect(page.locator('td:has-text("AAPL")')).toBeVisible();
    await expect(page.locator('td:has-text("MSFT")')).toBeVisible();
    
    // Check truncation message
    await expect(page.locator('text=Results truncated to 100 rows.')).toBeVisible();
  });

  test('Scenario 5: SQL SELECT Query (Empty result)', async ({ page }) => {
    const mock = new MockFactory(page);
    await mock.mockDatabaseStatus(true);
    await mock.mockDefaultServices();
    
    await mock.mockChatStream('**/database-chat', [
      { type: 'tool_call', id: 'call_sql_empty', name: 'execute_d1_sql', args: { sql: 'SELECT * FROM watchlist WHERE symbol = "NONE"' } },
      { type: 'tool_result', id: 'call_sql_empty', result: { success: true, results: [], truncated: false } }
    ]);
    
    await page.goto('/?tab=db-agent');
    
    const input = page.locator('input[placeholder="Ask a question or enter a SQL query..."]');
    await input.fill('SELECT * FROM watchlist WHERE symbol = "NONE"');
    await input.press('Enter');
    
    // Check empty result message
    await expect(page.locator('text=Query completed successfully. Empty result set.')).toBeVisible();
  });

  test('Scenario 6: SQL Execution Error Rendering', async ({ page }) => {
    const mock = new MockFactory(page);
    await mock.mockDatabaseStatus(true);
    await mock.mockDefaultServices();
    
    await mock.mockChatStream('**/database-chat', [
      { type: 'tool_call', id: 'call_sql_err', name: 'execute_d1_sql', args: { sql: 'SELECT * FROM watchlists' } },
      { type: 'tool_result', id: 'call_sql_err', result: { success: false, error: 'no such table: watchlists' } }
    ]);
    
    await page.goto('/?tab=db-agent');
    
    const input = page.locator('input[placeholder="Ask a question or enter a SQL query..."]');
    await input.fill('SELECT * FROM watchlists');
    await input.press('Enter');
    
    // Check error alert box
    await expect(page.locator('text=SQL Error:')).toBeVisible();
    await expect(page.locator('text=no such table: watchlists')).toBeVisible();
  });

  test('Scenario 7: R2 List Objects Rendering (Success & Empty)', async ({ page }) => {
    const mock = new MockFactory(page);
    await mock.mockDatabaseStatus(true);
    await mock.mockDefaultServices();
    
    // Part A: Success List
    await mock.mockChatStream('**/database-chat', [
      { type: 'tool_call', id: 'call_r2_list', name: 'list_r2_objects', args: {} },
      { type: 'tool_result', id: 'call_r2_list', result: { success: true, objects: [{ key: 'reports/AAPL.json', size: 1024, uploaded: '2026-06-07T00:00:00.000Z' }] } }
    ]);
    
    await page.goto('/?tab=db-agent');
    
    const input = page.locator('input[placeholder="Ask a question or enter a SQL query..."]');
    await input.fill('List R2 objects');
    await input.press('Enter');
    
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('td:has-text("reports/AAPL.json")')).toBeVisible();
    await expect(page.locator('td:has-text("1024")')).toBeVisible();

    // Part B: Empty List
    await mock.mockChatStream('**/database-chat', [
      { type: 'tool_call', id: 'call_r2_empty', name: 'list_r2_objects', args: {} },
      { type: 'tool_result', id: 'call_r2_empty', result: { success: true, objects: [] } }
    ]);
    
    await page.goto('/?tab=db-agent');
    await input.fill('List R2 objects again');
    await input.press('Enter');
    
    await expect(page.locator('text=The R2 bucket is empty or hasn\\\'t been initialized with files.')).toBeVisible();
  });
});
`;

fs.writeFileSync('frontend/e2e/database-chat.spec.ts', databaseChatSpec);
console.log('Wrote database-chat.spec.ts with console logging');
