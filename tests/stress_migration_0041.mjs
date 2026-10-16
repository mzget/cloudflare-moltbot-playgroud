import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';

const migrationPath = path.resolve('backend/migrations/0041_fundamental_intelligence.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

console.log('====================================================');
console.log('EMPIRICAL STRESS TEST: Migration 0041 against SQLite');
console.log('====================================================\n');

const db = new DatabaseSync(':memory:');

// 1. Migration idempotency
console.log('--- Test 1: Migration Idempotency ---');
try {
  db.exec(migrationSql);
  console.log('✓ Migration executed first time successfully.');
  db.exec(migrationSql);
  console.log('✓ Migration executed second time (idempotent IF NOT EXISTS) successfully.');
} catch (err) {
  console.error('✗ Migration idempotency failed:', err.message);
  process.exit(1);
}

// 2. Table and index schema verification
console.log('\n--- Test 2: Schema Inspection ---');
const tables = db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' ORDER BY type, name").all();
console.log('Objects in database:', tables);

// 3. Test Constraints on stock_fundamentals
console.log('\n--- Test 3: Constraints on stock_fundamentals ---');
// Insert valid record
db.prepare(`
  INSERT INTO stock_fundamentals (symbol, business_model, moat, competitors, guidance, key_risks, thesis_kpis, as_of_date, notebook_id, source_count)
  VALUES ('ARM', 'IP Licensing', 'ISA Monopoly', '["RISC-V", "x86"]', '{"margin_target": "45%"}', '["China joint venture risk"]', '["v9 royalty rate"]', '2026-07-29', 'nb-arm-01', 3)
`).run();
console.log('✓ Inserted valid stock_fundamentals row for ARM.');

// Duplicate primary key
try {
  db.prepare(`
    INSERT INTO stock_fundamentals (symbol, business_model, as_of_date)
    VALUES ('ARM', 'Duplicate attempt', '2026-07-30')
  `).run();
  console.error('✗ Duplicate symbol in stock_fundamentals should have failed!');
} catch (err) {
  console.log(`✓ Duplicate symbol correctly rejected: [${err.code || 'CONSTRAINT'}] ${err.message}`);
}

// NULL primary key
try {
  db.prepare(`
    INSERT INTO stock_fundamentals (symbol, business_model, as_of_date)
    VALUES (NULL, 'Null symbol attempt 1', '2026-07-30')
  `).run();
  console.log('⚠️ SQLite quirk: First NULL symbol was ALLOWED because "symbol TEXT PRIMARY KEY" lacks NOT NULL constraint!');
  
  db.prepare(`
    INSERT INTO stock_fundamentals (symbol, business_model, as_of_date)
    VALUES (NULL, 'Null symbol attempt 2', '2026-07-31')
  `).run();
  console.log('⚠️ SQLite quirk: Second NULL symbol was ALSO ALLOWED! In SQLite, PRIMARY KEY without NOT NULL allows multiple NULL rows!');
  const nullRows = db.prepare("SELECT * FROM stock_fundamentals WHERE symbol IS NULL").all();
  console.log('Rows with symbol IS NULL:', nullRows.length);
} catch (err) {
  console.log(`✓ NULL symbol correctly rejected: [${err.code || 'CONSTRAINT'}] ${err.message}`);
}

// NULL as_of_date
try {
  db.prepare(`
    INSERT INTO stock_fundamentals (symbol, business_model, as_of_date)
    VALUES ('NVDA', 'GPU compute', NULL)
  `).run();
  console.error('✗ NULL as_of_date should have failed!');
} catch (err) {
  console.log(`✓ NULL as_of_date correctly rejected: [${err.code || 'CONSTRAINT'}] ${err.message}`);
}

// Default values test
db.prepare(`
  INSERT INTO stock_fundamentals (symbol, as_of_date)
  VALUES ('MSFT', '2026-08-01')
`).run();
const msftRow = db.prepare("SELECT * FROM stock_fundamentals WHERE symbol = 'MSFT'").get();
console.log('✓ Default values verification for MSFT: source_count =', msftRow.source_count, ', updated_at =', msftRow.updated_at);
if (msftRow.source_count !== 1 || !msftRow.updated_at) {
  console.error('✗ Unexpected defaults for stock_fundamentals!');
}

// 4. Test Constraints on theme_sector_contexts
console.log('\n--- Test 4: Constraints on theme_sector_contexts ---');
// Insert valid theme context
db.prepare(`
  INSERT INTO theme_sector_contexts (notebook_id, theme_name, industry_dynamics)
  VALUES ('theme-semi-ai', 'AI Semiconductors & Advanced Packaging', 'CoWoS supply constraints')
`).run();
console.log('✓ Inserted valid theme_sector_contexts row.');

// Duplicate primary key
try {
  db.prepare(`
    INSERT INTO theme_sector_contexts (notebook_id, theme_name)
    VALUES ('theme-semi-ai', 'Duplicate theme')
  `).run();
  console.error('✗ Duplicate notebook_id in theme_sector_contexts should have failed!');
} catch (err) {
  console.log(`✓ Duplicate notebook_id correctly rejected: [${err.code || 'CONSTRAINT'}] ${err.message}`);
}

// NULL theme_name
try {
  db.prepare(`
    INSERT INTO theme_sector_contexts (notebook_id, theme_name)
    VALUES ('theme-null-name', NULL)
  `).run();
  console.error('✗ NULL theme_name in theme_sector_contexts should have failed!');
} catch (err) {
  console.log(`✓ NULL theme_name correctly rejected: [${err.code || 'CONSTRAINT'}] ${err.message}`);
}

// 5. Test Constraints & Composite PK on theme_symbol_mappings
console.log('\n--- Test 5: Constraints & Composite PK on theme_symbol_mappings ---');
// Insert valid mappings
db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES ('theme-semi-ai', 'ARM')").run();
db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES ('theme-semi-ai', 'NVDA')").run();
console.log('✓ Inserted mappings (theme-semi-ai, ARM) and (theme-semi-ai, NVDA).');

// Another theme mapping to ARM (many-to-many)
db.prepare("INSERT INTO theme_sector_contexts (notebook_id, theme_name) VALUES ('theme-edge-iot', 'Edge AI & IoT')").run();
db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES ('theme-edge-iot', 'ARM')").run();
console.log('✓ Inserted mapping (theme-edge-iot, ARM) - same symbol, different theme notebook.');

// Duplicate composite primary key (theme-semi-ai, ARM)
try {
  db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES ('theme-semi-ai', 'ARM')").run();
  console.error('✗ Duplicate (notebook_id, symbol) in theme_symbol_mappings should have failed!');
} catch (err) {
  console.log(`✓ Duplicate composite PK correctly rejected: [${err.code || 'CONSTRAINT'}] ${err.message}`);
}

// NULL notebook_id
try {
  db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES (NULL, 'QCOM')").run();
  console.error('✗ NULL notebook_id in theme_symbol_mappings should have failed!');
} catch (err) {
  console.log(`✓ NULL notebook_id correctly rejected: [${err.code || 'CONSTRAINT'}] ${err.message}`);
}

// NULL symbol
try {
  db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES ('theme-semi-ai', NULL)").run();
  console.error('✗ NULL symbol in theme_symbol_mappings should have failed!');
} catch (err) {
  console.log(`✓ NULL symbol correctly rejected: [${err.code || 'CONSTRAINT'}] ${err.message}`);
}

// 6. Test Foreign Key Cascade
console.log('\n--- Test 6: Foreign Key Cascade Deletion ---');
// SQLite requires PRAGMA foreign_keys = ON;
db.exec('PRAGMA foreign_keys = ON;');
const fkStatus = db.prepare('PRAGMA foreign_keys').get();
console.log('PRAGMA foreign_keys enabled:', fkStatus);

// Test FK violation when inserting non-existent notebook_id
try {
  db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES ('non-existent-theme', 'TSM')").run();
  console.error('✗ Inserting orphaned symbol mapping should have failed foreign key constraint!');
} catch (err) {
  console.log(`✓ Orphaned mapping correctly rejected: [${err.code || 'CONSTRAINT'}] ${err.message}`);
}

// Inspect mappings before delete
const mappingsBefore = db.prepare("SELECT * FROM theme_symbol_mappings WHERE notebook_id = 'theme-semi-ai'").all();
console.log('Mappings before deleting theme-semi-ai (count = ' + mappingsBefore.length + '):', mappingsBefore);

// Delete the parent theme context
db.prepare("DELETE FROM theme_sector_contexts WHERE notebook_id = 'theme-semi-ai'").run();
console.log('Executed: DELETE FROM theme_sector_contexts WHERE notebook_id = theme-semi-ai');

// Inspect mappings after delete
const mappingsAfter = db.prepare("SELECT * FROM theme_symbol_mappings WHERE notebook_id = 'theme-semi-ai'").all();
console.log('Mappings after deleting theme-semi-ai (count = ' + mappingsAfter.length + '):', mappingsAfter);
if (mappingsAfter.length === 0) {
  console.log('✓ Foreign key ON DELETE CASCADE verified: All mapped records were deleted automatically.');
} else {
  console.error('✗ CASCADE deletion failed! Records still exist:', mappingsAfter);
}

// Verify that theme-edge-iot mappings were NOT affected
const otherMappings = db.prepare("SELECT * FROM theme_symbol_mappings WHERE notebook_id = 'theme-edge-iot'").all();
console.log('✓ Other theme mappings unaffected (count = ' + otherMappings.length + '):', otherMappings);

// 7. Index Usage Verification via EXPLAIN QUERY PLAN
console.log('\n--- Test 7: Index Usage via EXPLAIN QUERY PLAN ---');

// Populate additional data so planner has stats
for (let i = 1; i <= 20; i++) {
  const sym = `SYM${i}`;
  const date = `2026-0${(i % 9) + 1}-15`;
  db.prepare("INSERT INTO stock_fundamentals (symbol, as_of_date) VALUES (?, ?)").run(sym, date);
  db.prepare("INSERT INTO theme_symbol_mappings (notebook_id, symbol) VALUES ('theme-edge-iot', ?)").run(sym);
}

// Query 7a: Exact as_of_date
const plan7a = db.prepare("EXPLAIN QUERY PLAN SELECT * FROM stock_fundamentals WHERE as_of_date = '2026-07-29'").all();
console.log('Plan 7a (WHERE as_of_date = ?):', plan7a);

// Query 7b: Range as_of_date
const plan7b = db.prepare("EXPLAIN QUERY PLAN SELECT * FROM stock_fundamentals WHERE as_of_date >= '2026-05-01'").all();
console.log('Plan 7b (WHERE as_of_date >= ?):', plan7b);

// Query 7c: ORDER BY as_of_date
const plan7c = db.prepare("EXPLAIN QUERY PLAN SELECT * FROM stock_fundamentals ORDER BY as_of_date DESC").all();
console.log('Plan 7c (ORDER BY as_of_date DESC):', plan7c);

// Query 7d: Symbol lookup on theme_symbol_mappings
const plan7d = db.prepare("EXPLAIN QUERY PLAN SELECT * FROM theme_symbol_mappings WHERE symbol = 'ARM'").all();
console.log('Plan 7d (theme_symbol_mappings WHERE symbol = ?):', plan7d);

// Query 7e: Notebook lookup on theme_symbol_mappings (Composite PK index)
const plan7e = db.prepare("EXPLAIN QUERY PLAN SELECT * FROM theme_symbol_mappings WHERE notebook_id = 'theme-edge-iot'").all();
console.log('Plan 7e (theme_symbol_mappings WHERE notebook_id = ?):', plan7e);

// Query 7f: Grounding JOIN query (Debate Engine)
const plan7f = db.prepare(`
  EXPLAIN QUERY PLAN
  SELECT t.notebook_id, t.theme_name, t.industry_dynamics, t.macro_trends
  FROM theme_sector_contexts t
  JOIN theme_symbol_mappings m ON t.notebook_id = m.notebook_id
  WHERE m.symbol = 'ARM'
`).all();
console.log('Plan 7f (Debate Engine Grounding JOIN):', plan7f);

console.log('\n====================================================');
console.log('EMPIRICAL STRESS TEST COMPLETE');
console.log('====================================================');
