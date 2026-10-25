-- 1) Normalize legacy names to canonical presets (Q1: rename)
UPDATE dcf_calculations SET scenario_name = 'Base Case'
  WHERE scenario_name <> 'Base Case' AND LOWER(scenario_name) LIKE 'base case%';
UPDATE dcf_calculations SET scenario_name = 'Bear Case'
  WHERE scenario_name <> 'Bear Case' AND LOWER(scenario_name) LIKE 'bear case%';
UPDATE dcf_calculations SET scenario_name = 'Bull Case'
  WHERE scenario_name <> 'Bull Case' AND LOWER(scenario_name) LIKE 'bull case%';

-- 2) Collisions: keep newest per (symbol, scenario_name)
DELETE FROM dcf_calculations WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY symbol, scenario_name ORDER BY created_at DESC, id DESC) AS rn
    FROM dcf_calculations
  ) WHERE rn = 1
);

-- 3) Enforce ADR-0004 at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS ux_dcf_symbol_scenario
  ON dcf_calculations(symbol, scenario_name);
