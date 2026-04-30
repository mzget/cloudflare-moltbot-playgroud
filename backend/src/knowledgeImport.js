const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const csvPath = path.join(__dirname, '../../My Investing - FY2026.xlsx - My Port.csv');
const sqlPath = path.join(__dirname, '../import.sql');

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const { data } = Papa.parse(csvContent, { header: false, skipEmptyLines: true });

const sqlStatements = [];

// Helper to escape SQL strings
const escapeSql = (str) => str ? str.replace(/'/g, "''") : '';

// 1. Portfolio Holdings (Rows 2-26)
for (let i = 1; i <= 25; i++) {
  const row = data[i];
  if (!row) continue;
  
  const symbol = row[0];
  const weightStr = row[1] || '';
  const weight = parseFloat(weightStr.replace('%', '')) / 100 || 0;
  const thesis = row[2] || '';
  const category = (i >= 1 && i <= 6) ? symbol : 'Stock'; // basic categorization
  
  if (symbol && symbol.trim() !== '' && symbol !== 'Total') {
    sqlStatements.push(
      `INSERT INTO portfolio_holdings (symbol, weight, thesis, category) VALUES ('${escapeSql(symbol)}', ${weight}, '${escapeSql(thesis)}', '${escapeSql(category)}') ON CONFLICT(symbol) DO UPDATE SET weight=excluded.weight, thesis=excluded.thesis;`
    );
  }
}

// 2. Portfolio History (Rows 2-6, Columns AB-AF approx, let's just extract the static history found at rows 2-6, cols 26-30 approx)
// Based on file preview:
// Row 2 (index 1): 2021, "฿1,400,733", "฿1,355,200", -3.25%, "ปี 2021 ขาดทุนหนัก..."
// Row 3 (index 2): 2022, "฿2,075,445", "฿1,635,100", -21.22%, "ปี 2022 ขาดทุนหนัก..."
// Row 4 (index 3): 2023, "฿2,536,169", "฿2,423,657", -4.44%, "ปี 2023 ตัดขาดทุนหนัก..."
// Row 5 (index 4): 2024, "฿3,114,000", "฿3,290,100", 5.66%, "ปี 24 ตลาด s&p500..."
// Row 6 (index 5): 2025, "฿3,681,300", "฿4,239,900", 15.17%, "FY25 s&p500..."
const yearIndices = [1, 2, 3, 4, 5];
yearIndices.forEach(idx => {
  const row = data[idx];
  if (row) {
    const year = parseInt(row[26], 10);
    if (!isNaN(year)) {
      const capital = parseFloat((row[27] || '0').replace(/[^0-9.-]+/g, ''));
      const balance = parseFloat((row[28] || '0').replace(/[^0-9.-]+/g, ''));
      const gainStr = row[29] || '0';
      const gainPct = parseFloat(gainStr.replace('%', '')) / 100 || 0;
      const remark = row[30] || '';
      
      sqlStatements.push(
        `INSERT INTO portfolio_history (year, capital, balance, total_gain_pct, remark) VALUES (${year}, ${capital}, ${balance}, ${gainPct}, '${escapeSql(remark)}') ON CONFLICT(year) DO UPDATE SET capital=excluded.capital, balance=excluded.balance, total_gain_pct=excluded.total_gain_pct, remark=excluded.remark;`
      );
    }
  }
});

// 3. Knowledge Base
// A generalized approach to ingest the textual information from rows 42-122
let currentCategory = 'General';
for (let i = 41; i <= 122; i++) {
  const row = data[i];
  if (!row) continue;
  
  // Checking col A, B, C for content
  const colA = row[0] || '';
  const colC = row[2] || '';
  const colI = row[8] || ''; // Sometimes col I has headers
  
  // Very simplistic heuristic to grab text
  if (colA.startsWith('#')) currentCategory = colA.replace(/#/g, '').trim();
  else if (colI.startsWith('#')) currentCategory = colI.replace(/#/g, '').trim();
  
  const contentTokens = [];
  if (colA && !colA.startsWith('#')) contentTokens.push(colA);
  if (colC && !colC.startsWith('#') && colC !== colA) contentTokens.push(colC);
  if (colI && !colI.startsWith('#') && colI !== colA && colI !== colC) contentTokens.push(colI);
  
  const content = contentTokens.join(' | ').trim();
  if (content && content.length > 5) { // Skip very short/empty rows
    sqlStatements.push(
      `INSERT INTO knowledge_base (category, title, content) VALUES ('${escapeSql(currentCategory)}', 'Note', '${escapeSql(content)}');`
    );
  }
}

fs.writeFileSync(sqlPath, sqlStatements.join('\n'));
console.log('import.sql generated successfully. Run it with: npx wrangler d1 execute oaktree-db --local --file=import.sql');
