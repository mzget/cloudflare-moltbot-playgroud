const fs = require('fs');
const debugSpec = `import { test, expect } from '@playwright/test';

test('Debug page content', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  console.log('Navigating...');
  await page.goto('/?tab=db-agent');
  console.log('Navigated, waiting 3 seconds...');
  await page.waitForTimeout(3000);
  
  console.log('PAGE CONTENT:');
  console.log(await page.content());
});
`;
fs.writeFileSync('frontend/e2e/debug.spec.ts', debugSpec);
console.log('Wrote debug.spec.ts');
