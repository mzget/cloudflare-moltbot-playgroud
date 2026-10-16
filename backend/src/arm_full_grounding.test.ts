import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fetchQualitativeData } from './debateEngine';
import { formatDebateContext } from './analysisPrompts';

function createMockD1(sqlite: DatabaseSync): any {
  return {
    prepare(sql: string) {
      let params: unknown[] = [];
      const stmt: any = {
        bind(...p: unknown[]) {
          params = p;
          return stmt;
        },
        async all() {
          try {
            const rows = sqlite.prepare(sql).all(...(params as any[]));
            return { results: rows };
          } catch {
            return { results: [] };
          }
        },
        async first() {
          try {
            const row = sqlite.prepare(sql).get(...(params as any[]));
            return row ?? null;
          } catch {
            return null;
          }
        },
        async run() {
          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
  };
}

describe('Milestone 5 Acceptance: Full Grounding Context for ARM with SemiAnalysis Theme', () => {
  it('loads ARM fundamental brief and joined SemiAnalysis theme context into 5 structured sections', async () => {
    const sqlite = new DatabaseSync(':memory:');
    
    // 1. Run migration 0041
    const migrationSql = readFileSync('C:/Users/natta/.gemini/antigravity/worktrees/oaktree-agent/plan_bull_bear_debate/backend/migrations/0041_fundamental_intelligence.sql', 'utf8');
    sqlite.exec(migrationSql);

    // 2. Insert ARM fundamental brief
    const armSeedSql = readFileSync('C:/Users/natta/.gemini/antigravity/brain/008f0203-e6fd-42f5-b02e-95ddc007199d/scratch/seed_arm.sql', 'utf8');
    sqlite.exec(armSeedSql);

    // 3. Insert SemiAnalysis theme context and link to ARM
    const semiSeedSql = readFileSync('C:/Users/natta/.gemini/antigravity/brain/008f0203-e6fd-42f5-b02e-95ddc007199d/scratch/seed_semianalysis.sql', 'utf8');
    sqlite.exec(semiSeedSql);

    const mockDb = createMockD1(sqlite);

    // 4. Fetch qualitative data for ARM
    const qual = await fetchQualitativeData(mockDb, 'ARM');

    // Assert fundamental brief is present
    expect(qual.fundamental).not.toBeNull();
    expect(qual.fundamental?.symbol).toBe('ARM');
    expect(qual.fundamental?.as_of_date).toBe('2026-07-29');
    expect(qual.fundamental?.source_count).toBe(13);

    // Assert joined theme is present
    expect(qual.themes.length).toBeGreaterThanOrEqual(1);
    const semiTheme = qual.themes.find(t => t.theme_name.includes('SemiAnalysis'));
    expect(semiTheme).toBeDefined();
    expect(semiTheme?.industry_dynamics).toContain('custom silicon');
    expect(semiTheme?.supply_chain_bottlenecks).toContain('CoWoS');

    // 5. Format debate context
    const metricsStr = 'Price: $238 | P/E: 261 | Gross Margin: 97.5% | Revenue Growth: 25%';
    const context = formatDebateContext(metricsStr, qual.events as any, qual.articles as any, qual);

    // Assert 5 structured sections and rich grounding
    expect(context).toContain('### 1.'); // Financial Metrics
    expect(context).toContain('### 2.'); // Company Fundamental Brief
    expect(context).toContain('### 3.'); // Sector & Competitive Dynamics
    expect(context).toContain('P/E: 261');
    expect(context).toContain('$25B');
    expect(context).toContain('SemiAnalysis');
    expect(context).toContain('CoWoS');
    expect(context).toContain('Armv9');
    expect(context).toContain('RISC-V');
  });
});
