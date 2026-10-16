import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  FundamentalIntelligenceTab,
  type FundamentalStatusItem,
} from './FundamentalIntelligenceTab';
import SourceManager from './SourceManager';

/**
 * Filter Oracle mirroring the exact implementation in FundamentalIntelligenceTab.tsx (lines 118-135).
 * Used for rigorous empirical stress-testing of all edge cases, combinatorics, and property-based invariants.
 */
export function filterFundamentalItems(
  items: FundamentalStatusItem[],
  searchQuery: string,
  statusFilter: 'all' | 'active' | 'stale' | 'missing'
): FundamentalStatusItem[] {
  const q = searchQuery.trim().toLowerCase();
  return items.filter((item) => {
    // Status filter
    if (statusFilter !== 'all') {
      const itemStatus = String(item.status).toLowerCase();
      if (itemStatus !== statusFilter) return false;
    }
    // Search filter
    if (q) {
      const matchesSymbol = item.symbol.toLowerCase().includes(q);
      const matchesName = (item.company_name || '').toLowerCase().includes(q);
      const matchesThemes = (item.theme_tags || []).some((t) => t.toLowerCase().includes(q));
      if (!matchesSymbol && !matchesName && !matchesThemes) return false;
    }
    return true;
  });
}

/**
 * Summary Calculation Oracle mirroring FundamentalIntelligenceTab.tsx (lines 97-115).
 */
export function calculateFundamentalSummary(items: FundamentalStatusItem[]) {
  let active = 0;
  let stale = 0;
  let missing = 0;

  items.forEach((item) => {
    const s = String(item.status).toLowerCase();
    if (s === 'active') active++;
    else if (s === 'stale') stale++;
    else missing++;
  });

  return {
    total: items.length,
    active,
    stale,
    missing,
  };
}

describe('Challenger M4-2: Empirical Stress-Test Suite', () => {
  const sampleItems: FundamentalStatusItem[] = [
    {
      symbol: 'ARM',
      company_name: 'Arm Holdings plc',
      as_of_date: '2026-07-29',
      status: 'active',
      source_count: 3,
      theme_tags: ['SemiAnalysis AI & Compute Dynamics', 'High Performance RISC-V'],
      updated_at: '2026-10-15 12:00:00',
    },
    {
      symbol: 'INTC',
      company_name: 'Intel Corporation',
      as_of_date: '2026-04-01',
      status: 'stale',
      source_count: 1,
      theme_tags: ['Foundry Ecosystem'],
      updated_at: '2026-04-02 09:00:00',
    },
    {
      symbol: 'TSM',
      company_name: 'Taiwan Semiconductor Manufacturing Co',
      as_of_date: null,
      status: 'missing',
      source_count: 0,
      theme_tags: [],
      updated_at: null,
    },
    {
      symbol: 'NVDA',
      company_name: 'NVIDIA Corporation',
      as_of_date: '2026-08-15',
      status: 'active',
      source_count: 7,
      theme_tags: ['GPU Compute', 'Data Center Networking'],
      updated_at: '2026-08-16 10:00:00',
    },
  ];

  // ==========================================================================
  // Dimension 1: Data Rendering Stress Testing
  // ==========================================================================
  describe('Dimension 1: Data Rendering Boundaries & Shapes', () => {
    it('1.1: Empty items list renders clean empty state with 0 summary counts', () => {
      const html = renderToString(
        <FundamentalIntelligenceTab initialItems={[]} autoFetch={false} />
      );

      // Summary counts all 0
      expect(html).toContain('Total Tickers');
      expect(html).toContain('0');
      expect(html).toContain('All (0)');
      expect(html).toContain('Active (0)');
      expect(html).toContain('Stale (0)');
      expect(html).toContain('Missing (0)');

      // Table message
      expect(html).toContain('No stocks found in watchlist.');
      expect(html).not.toContain('Loading fundamental status...');
    });

    it('1.2: Single item renders complete details and action controls', () => {
      const singleItem: FundamentalStatusItem = {
        symbol: 'PLTR',
        company_name: 'Palantir Technologies',
        as_of_date: '2026-09-01',
        status: 'active',
        source_count: 4,
        theme_tags: ['Enterprise AI Platforms'],
        updated_at: '2026-09-02 08:00:00',
      };

      const html = renderToString(
        <FundamentalIntelligenceTab initialItems={[singleItem]} autoFetch={false} />
      );

      expect(html).toContain('PLTR');
      expect(html).toContain('Palantir Technologies');
      expect(html).toContain('2026-09-01');
      expect(html).toContain('🟢 Active (&lt;90d)');
      expect(html).toContain('Enterprise AI Platforms');
      expect(html).toContain('Copy Prompt');
      expect(html).toContain('All (1)');
      expect(html).toContain('Active (1)');
      expect(html).toContain('Stale (0)');
      expect(html).toContain('Missing (0)');
    });

    it('1.3: Large items list (150 items) maintains count integrity under stress', () => {
      const largeList: FundamentalStatusItem[] = Array.from({ length: 150 }, (_, i) => {
        const statusType = i % 3 === 0 ? 'active' : i % 3 === 1 ? 'stale' : 'missing';
        return {
          symbol: `TICK${i.toString().padStart(3, '0')}`,
          company_name: `Corporation ${i}`,
          as_of_date: statusType === 'missing' ? null : `2026-0${(i % 8) + 1}-15`,
          status: statusType,
          source_count: i % 5,
          theme_tags: i % 2 === 0 ? [`Theme ${i % 10}`] : [],
          updated_at: '2026-10-01 00:00:00',
        };
      });

      const startTime = performance.now();
      const html = renderToString(
        <FundamentalIntelligenceTab initialItems={largeList} autoFetch={false} />
      );
      const elapsedMs = performance.now() - startTime;

      // Empirical observation: MUI Emotion server-side styling incurs ~5-8s overhead for 150 unvirtualized rows
      expect(elapsedMs).toBeLessThan(15000);

      // Verify exact counts: 150 total, 50 active, 50 stale, 50 missing
      expect(html).toContain('All (150)');
      expect(html).toContain('Active (50)');
      expect(html).toContain('Stale (50)');
      expect(html).toContain('Missing (50)');

      // Verify boundary items appear in the HTML
      expect(html).toContain('TICK000');
      expect(html).toContain('TICK075');
      expect(html).toContain('TICK149');
    }, 15000);

    it('1.4: Item with 0 theme tags renders placeholder dash ("—")', () => {
      const itemNoThemes: FundamentalStatusItem = {
        symbol: 'NOTHEME',
        company_name: 'No Themes Corp',
        as_of_date: '2026-06-01',
        status: 'stale',
        source_count: 1,
        theme_tags: [],
        updated_at: '2026-06-02 00:00:00',
      };

      const html = renderToString(
        <FundamentalIntelligenceTab initialItems={[itemNoThemes]} autoFetch={false} />
      );

      expect(html).toContain('NOTHEME');
      expect(html).toContain('—'); // Em dash for empty themes
    });

    it('1.5: Item with 10 theme tags renders all 10 theme chips', () => {
      const tenThemes = [
        'Cloud Hyperscalers',
        'AI Accelerators',
        'High Bandwidth Memory',
        'Advanced Packaging',
        'EUV Lithography',
        'Edge Silicon',
        'Server CPUs',
        'Automotive ADAS',
        'EDA Tooling',
        'Foundry Ecosystem',
      ];

      const itemTenThemes: FundamentalStatusItem = {
        symbol: 'MEGA',
        company_name: 'Mega Semiconductor Inc',
        as_of_date: '2026-08-01',
        status: 'active',
        source_count: 10,
        theme_tags: tenThemes,
        updated_at: '2026-08-02 00:00:00',
      };

      const html = renderToString(
        <FundamentalIntelligenceTab initialItems={[itemTenThemes]} autoFetch={false} />
      );

      expect(html).toContain('MEGA');
      for (const theme of tenThemes) {
        expect(html).toContain(theme);
      }
    });

    it('1.6: Item with null as_of_date renders placeholder dash and missing badge', () => {
      const itemNullDate: FundamentalStatusItem = {
        symbol: 'NULLDATE',
        company_name: 'Null Date Inc',
        as_of_date: null,
        status: 'missing',
        source_count: 0,
        theme_tags: [],
        updated_at: null,
      };

      const html = renderToString(
        <FundamentalIntelligenceTab initialItems={[itemNullDate]} autoFetch={false} />
      );

      expect(html).toContain('NULLDATE');
      expect(html).toContain('🔴 Missing');
    });
  });

  // ==========================================================================
  // Dimension 2: Summary Counts Calculation & Invariants
  // ==========================================================================
  describe('Dimension 2: Summary Counts Calculation & Mathematical Invariants', () => {
    it('2.1: Correctly calculates summary totals matching table data', () => {
      const html = renderToString(
        <FundamentalIntelligenceTab initialItems={sampleItems} autoFetch={false} />
      );

      // sampleItems has 4 total: 2 active (ARM, NVDA), 1 stale (INTC), 1 missing (TSM)
      expect(html).toContain('All (4)');
      expect(html).toContain('Active (2)');
      expect(html).toContain('Stale (1)');
      expect(html).toContain('Missing (1)');
    });

    it('2.2: Preserves mathematical invariant total = active + stale + missing', () => {
      const items: FundamentalStatusItem[] = [
        { symbol: 'A1', company_name: 'C1', as_of_date: '2026-08-01', status: 'active', source_count: 1, theme_tags: [], updated_at: null },
        { symbol: 'A2', company_name: 'C2', as_of_date: '2026-08-01', status: 'active', source_count: 1, theme_tags: [], updated_at: null },
        { symbol: 'A3', company_name: 'C3', as_of_date: '2026-08-01', status: 'active', source_count: 1, theme_tags: [], updated_at: null },
        { symbol: 'S1', company_name: 'C4', as_of_date: '2026-01-01', status: 'stale', source_count: 1, theme_tags: [], updated_at: null },
        { symbol: 'S2', company_name: 'C5', as_of_date: '2026-01-01', status: 'stale', source_count: 1, theme_tags: [], updated_at: null },
        { symbol: 'M1', company_name: 'C6', as_of_date: null, status: 'missing', source_count: 0, theme_tags: [], updated_at: null },
      ];

      const html = renderToString(
        <FundamentalIntelligenceTab initialItems={items} autoFetch={false} />
      );

      expect(html).toContain('All (6)');
      expect(html).toContain('Active (3)');
      expect(html).toContain('Stale (2)');
      expect(html).toContain('Missing (1)');
      // Invariant: 3 + 2 + 1 = 6
    });

    it('2.3: Handles uppercase and mixed-case status values gracefully', () => {
      const mixedCasingItems: FundamentalStatusItem[] = [
        { symbol: 'UP1', company_name: 'Upper 1', as_of_date: '2026-08-01', status: 'ACTIVE', source_count: 1, theme_tags: [], updated_at: null },
        { symbol: 'UP2', company_name: 'Upper 2', as_of_date: '2026-01-01', status: 'STALE', source_count: 1, theme_tags: [], updated_at: null },
        { symbol: 'UP3', company_name: 'Upper 3', as_of_date: null, status: 'MISSING', source_count: 0, theme_tags: [], updated_at: null },
        { symbol: 'MIX', company_name: 'Mixed 4', as_of_date: '2026-08-01', status: 'Active', source_count: 1, theme_tags: [], updated_at: null },
      ];

      const html = renderToString(
        <FundamentalIntelligenceTab initialItems={mixedCasingItems} autoFetch={false} />
      );

      // ACTIVE (1) + Active (1) = 2 active
      // STALE (1) = 1 stale
      // MISSING (1) = 1 missing
      expect(html).toContain('All (4)');
      expect(html).toContain('Active (2)');
      expect(html).toContain('Stale (1)');
      expect(html).toContain('Missing (1)');
    });

    it('2.4: Counts non-standard or missing status as "missing" in summary counts', () => {
      const unclassifiedItems: FundamentalStatusItem[] = [
        { symbol: 'UNK', company_name: 'Unknown Status', as_of_date: null, status: 'unknown_value', source_count: 0, theme_tags: [], updated_at: null },
        { symbol: 'NULLS', company_name: 'Null Status', as_of_date: null, status: null as any, source_count: 0, theme_tags: [], updated_at: null },
      ];

      const html = renderToString(
        <FundamentalIntelligenceTab initialItems={unclassifiedItems} autoFetch={false} />
      );

      expect(html).toContain('All (2)');
      expect(html).toContain('Active (0)');
      expect(html).toContain('Stale (0)');
      expect(html).toContain('Missing (2)');
    });
  });

  // ==========================================================================
  // Dimension 3: Filter and Search Operations
  // ==========================================================================
  describe('Dimension 3: Filter and Search Operations', () => {
    it('3.1: Case-insensitive search on symbol matches correctly', () => {
      // Lowercase search 'arm'
      const lowerResults = filterFundamentalItems(sampleItems, 'arm', 'all');
      expect(lowerResults.map((r) => r.symbol)).toEqual(['ARM']);

      // Uppercase search 'NVDA'
      const upperResults = filterFundamentalItems(sampleItems, 'NVDA', 'all');
      expect(upperResults.map((r) => r.symbol)).toEqual(['NVDA']);

      // Partial symbol search 'TC' (matches INTC symbol, does not appear in other company names/themes)
      const partialResults = filterFundamentalItems(sampleItems, 'tc', 'all');
      expect(partialResults.map((r) => r.symbol)).toEqual(['INTC']);
    });

    it('3.2: Case-insensitive search on company name matches correctly', () => {
      // Search 'taiwan'
      const taiwanResults = filterFundamentalItems(sampleItems, 'taiwan', 'all');
      expect(taiwanResults.map((r) => r.symbol)).toEqual(['TSM']);

      // Search 'CORPORATION' (uppercase)
      const corpResults = filterFundamentalItems(sampleItems, 'CORPORATION', 'all');
      expect(corpResults.map((r) => r.symbol)).toEqual(['INTC', 'NVDA']);
      expect(corpResults.some((r) => r.symbol === 'ARM')).toBe(false);
    });

    it('3.3: Case-insensitive search on theme tags matches correctly', () => {
      // Search 'semianalysis'
      const themeResults = filterFundamentalItems(sampleItems, 'semianalysis', 'all');
      expect(themeResults.map((r) => r.symbol)).toEqual(['ARM']);

      // Search 'foundry'
      const foundryResults = filterFundamentalItems(sampleItems, 'foundry', 'all');
      expect(foundryResults.map((r) => r.symbol)).toEqual(['INTC']);

      // Search 'networking'
      const networkResults = filterFundamentalItems(sampleItems, 'networking', 'all');
      expect(networkResults.map((r) => r.symbol)).toEqual(['NVDA']);
    });

    it('3.4: Filter by status="active" returns only active securities', () => {
      const activeResults = filterFundamentalItems(sampleItems, '', 'active');
      expect(activeResults.map((r) => r.symbol)).toEqual(['ARM', 'NVDA']);
    });

    it('3.5: Filter by status="stale" returns only stale securities', () => {
      const staleResults = filterFundamentalItems(sampleItems, '', 'stale');
      expect(staleResults.map((r) => r.symbol)).toEqual(['INTC']);
    });

    it('3.6: Filter by status="missing" returns only missing securities', () => {
      const missingResults = filterFundamentalItems(sampleItems, '', 'missing');
      expect(missingResults.map((r) => r.symbol)).toEqual(['TSM']);
    });

    it('3.7: Combined search and status filter conjunction (AND logic)', () => {
      // Both ARM and NVDA are active, but searching 'arm' should only return ARM
      const combinedResults = filterFundamentalItems(sampleItems, 'arm', 'active');
      expect(combinedResults.map((r) => r.symbol)).toEqual(['ARM']);

      // INTC is stale, so searching 'intel' under active filter should yield 0 matches
      const noMatchResults = filterFundamentalItems(sampleItems, 'intel', 'active');
      expect(noMatchResults).toHaveLength(0);
    });

    it('3.8: Search query with leading and trailing whitespace is trimmed', () => {
      const trimmedResults = filterFundamentalItems(sampleItems, '   arm   ', 'all');
      expect(trimmedResults.map((r) => r.symbol)).toEqual(['ARM']);
    });

    it('3.9: Search query matching no stocks yields empty array', () => {
      const results = filterFundamentalItems(sampleItems, 'nonexistent_ticker', 'all');
      expect(results).toHaveLength(0);
    });

    it('3.10: EDGE CASE DISCREPANCY ANALYSIS: non-standard status values', () => {
      const edgeItems: FundamentalStatusItem[] = [
        { symbol: 'UNK', company_name: 'Unknown Co', as_of_date: null, status: 'unclassified', source_count: 0, theme_tags: [], updated_at: null },
      ];

      // In summary calculation: 'unclassified' is counted as missing
      const summary = calculateFundamentalSummary(edgeItems);
      expect(summary.missing).toBe(1);

      // But in status filtering: status !== 'missing' because 'unclassified' !== 'missing'
      const filteredByMissing = filterFundamentalItems(edgeItems, '', 'missing');
      // Documenting exact behavior:
      expect(filteredByMissing).toHaveLength(0);
      // This confirms: unclassified status is counted in missing stat card, but excluded when clicking the Missing filter chip!
    });
  });

  // ==========================================================================
  // Dimension 4: Tab Composition in SourceManager
  // ==========================================================================
  describe('Dimension 4: Tab Composition in SourceManager', () => {
    it('4.1: SourceManager renders 4th tab with BookOpen icon and "Fundamental Intelligence" label', () => {
      const html = renderToString(<SourceManager initialTab={0} />);

      // Verify all 4 tabs in tab list
      expect(html).toContain('Web &amp; RSS Crawler');
      expect(html).toContain('Gmail Newsletters');
      expect(html).toContain('Facebook Page');
      expect(html).toContain('Fundamental Intelligence');
    });

    it('4.2: SourceManager with initialTab={3} mounts and renders FundamentalIntelligenceTab', () => {
      const html = renderToString(<SourceManager initialTab={3} />);

      // When tab 3 is mounted:
      expect(html).toContain('Fundamental Intelligence');
      expect(html).toContain('Track qualitative research freshness, filing dates, and linked themes for watchlist equities.');
      expect(html).toContain('Total Tickers');
      expect(html).toContain('Active (&lt;90d)');
      expect(html).toContain('Stale (≥90d)');
      expect(html).toContain('Missing');
      expect(html).toContain('Refresh Status');
      expect(html).toContain('Search by symbol, company, or theme...');
    });

    it('4.3: Switching tab parameter mounts FundamentalIntelligenceTab at TabPanel value 3', () => {
      // In SourceManager:
      // TabPanel value 0: Web targets & crawler controls
      // TabPanel value 3: FundamentalIntelligenceTab
      const html0 = renderToString(<SourceManager initialTab={0} />);
      expect(html0).toContain('Active Web Targets');

      const html3 = renderToString(<SourceManager initialTab={3} />);
      expect(html3).toContain('Search by symbol, company, or theme...');
    });
  });
});
