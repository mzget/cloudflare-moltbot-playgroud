import { describe, it, expect } from 'vitest';
import {
  safeJsonParse,
  safeJsonStringify,
  deserializeStockFundamental,
  serializeStockFundamental,
  computeFreshnessStatus,
  StockFundamentalDbRow,
  SaveFundamentalBriefInput,
} from './fundamentals';

describe('fundamentals.ts', () => {
  describe('safeJsonParse', () => {
    it('parses valid JSON objects and arrays', () => {
      expect(safeJsonParse('{"rev": "100M"}', {})).toEqual({ rev: '100M' });
      expect(safeJsonParse('["x86", "ARM"]', [])).toEqual(['x86', 'ARM']);
    });

    it('returns fallback on null, undefined, or empty string', () => {
      expect(safeJsonParse(null, { default: true })).toEqual({ default: true });
      expect(safeJsonParse(undefined, ['fallback'])).toEqual(['fallback']);
      expect(safeJsonParse('', 'fallback')).toBe('fallback');
    });

    it('returns fallback on malformed JSON without throwing', () => {
      expect(safeJsonParse('{invalid-json}', { error: true })).toEqual({ error: true });
      expect(safeJsonParse('[broken', [])).toEqual([]);
    });

    it('returns value directly if value is already an object', () => {
      const obj = { key: 'val' };
      expect(safeJsonParse(obj, {})).toBe(obj);
      const arr = [1, 2, 3];
      expect(safeJsonParse(arr, [])).toBe(arr);
    });

    it('returns fallback if value is a non-string, non-object primitive', () => {
      expect(safeJsonParse(12345, 'fallback')).toBe('fallback');
      expect(safeJsonParse(true, 'fallback')).toBe('fallback');
    });
  });

  describe('safeJsonStringify', () => {
    it('stringifies objects and arrays to JSON string', () => {
      expect(safeJsonStringify({ a: 1 })).toBe('{"a":1}');
      expect(safeJsonStringify(['a', 'b'])).toBe('["a","b"]');
    });

    it('returns null on null or undefined or empty string', () => {
      expect(safeJsonStringify(null)).toBeNull();
      expect(safeJsonStringify(undefined)).toBeNull();
      expect(safeJsonStringify('')).toBeNull();
      expect(safeJsonStringify('   ')).toBeNull();
    });

    it('avoids double-stringifying already serialized JSON objects and arrays', () => {
      const jsonArr = '["RISC-V","x86"]';
      expect(safeJsonStringify(jsonArr)).toBe(jsonArr);

      const jsonObj = '{"target":"$4B"}';
      expect(safeJsonStringify(jsonObj)).toBe(jsonObj);
    });

    it('stringifies regular strings that look like braces but are invalid JSON', () => {
      const rawText = '{not valid json}';
      expect(safeJsonStringify(rawText)).toBe(JSON.stringify(rawText));
    });

    it('returns null on functions, symbols, and objects with undefined toJSON', () => {
      expect(safeJsonStringify(() => {})).toBeNull();
      expect(safeJsonStringify(Symbol('test'))).toBeNull();
      expect(safeJsonStringify({ toJSON: () => undefined })).toBeNull();
    });
  });

  describe('deserializeStockFundamental', () => {
    it('deserializes complete database row with JSON columns', () => {
      const row: StockFundamentalDbRow = {
        symbol: 'arm',
        business_model: 'Licensing IP and royalties',
        moat: 'High switching costs and ecosystem',
        competitors: '["x86", "RISC-V"]',
        guidance: '{"revenue_target": "$4.0B", "margin_target": "45%"}',
        key_risks: '["China JV risk", "Export restrictions"]',
        thesis_kpis: '["v9 adoption", "CSS penetration"]',
        as_of_date: '2026-07-29',
        notebook_id: 'nb-123',
        source_count: 5,
        updated_at: '2026-07-30T10:00:00Z',
      };

      const result = deserializeStockFundamental(row);

      expect(result.symbol).toBe('ARM');
      expect(result.business_model).toBe('Licensing IP and royalties');
      expect(result.moat).toBe('High switching costs and ecosystem');
      expect(result.competitors).toEqual(['x86', 'RISC-V']);
      expect(result.guidance).toEqual({ revenue_target: '$4.0B', margin_target: '45%' });
      expect(result.key_risks).toEqual(['China JV risk', 'Export restrictions']);
      expect(result.thesis_kpis).toEqual(['v9 adoption', 'CSS penetration']);
      expect(result.as_of_date).toBe('2026-07-29');
      expect(result.notebook_id).toBe('nb-123');
      expect(result.source_count).toBe(5);
      expect(result.updated_at).toBe('2026-07-30T10:00:00Z');
    });

    it('handles sparse and null fields defensively', () => {
      const row: StockFundamentalDbRow = {
        symbol: 'NVDA',
        business_model: null,
        moat: null,
        competitors: null,
        guidance: null,
        key_risks: null,
        thesis_kpis: null,
        as_of_date: '2026-06-01',
        notebook_id: null,
        source_count: null,
      };

      const result = deserializeStockFundamental(row);

      expect(result.symbol).toBe('NVDA');
      expect(result.business_model).toBe('');
      expect(result.moat).toBe('');
      expect(result.competitors).toEqual([]);
      expect(result.guidance).toBeNull();
      expect(result.key_risks).toEqual([]);
      expect(result.thesis_kpis).toEqual([]);
      expect(result.as_of_date).toBe('2026-06-01');
      expect(result.notebook_id).toBeNull();
      expect(result.source_count).toBe(1);
      expect(result.updated_at).toBeNull();
    });

    it('handles malformed JSON in D1 columns without crashing', () => {
      const row: StockFundamentalDbRow = {
        symbol: 'TSLA',
        business_model: 'EV and Energy',
        moat: 'Scale',
        competitors: '{corrupt',
        guidance: '[not-an-object',
        key_risks: 'unquoted-string',
        thesis_kpis: '',
        as_of_date: '2026-01-01',
        notebook_id: null,
        source_count: 0,
      };

      const result = deserializeStockFundamental(row);

      expect(result.symbol).toBe('TSLA');
      expect(result.competitors).toEqual([]);
      expect(result.guidance).toBeNull();
      expect(result.key_risks).toEqual([]);
      expect(result.thesis_kpis).toEqual([]);
      expect(result.source_count).toBe(0);
    });
  });

  describe('serializeStockFundamental', () => {
    it('serializes complete input into D1 parameters with valid JSON strings', () => {
      const input: SaveFundamentalBriefInput = {
        symbol: 'arm ',
        business_model: ' IP licensing ',
        moat: ' Switching costs ',
        competitors: ['x86', 'RISC-V'],
        guidance: { revenue_target: '$4.1B', timeframe: 'FY26' },
        key_risks: ['Risk A'],
        thesis_kpis: ['KPI 1'],
        as_of_date: ' 2026-07-29 ',
        notebook_id: ' nb-uuid ',
        source_count: 4,
      };

      const serialized = serializeStockFundamental(input);

      expect(serialized.symbol).toBe('ARM');
      expect(serialized.business_model).toBe('IP licensing');
      expect(serialized.moat).toBe('Switching costs');
      expect(serialized.competitors).toBe('["x86","RISC-V"]');
      expect(serialized.guidance).toBe('{"revenue_target":"$4.1B","timeframe":"FY26"}');
      expect(serialized.key_risks).toBe('["Risk A"]');
      expect(serialized.thesis_kpis).toBe('["KPI 1"]');
      expect(serialized.as_of_date).toBe('2026-07-29');
      expect(serialized.notebook_id).toBe('nb-uuid');
      expect(serialized.source_count).toBe(4);
    });

    it('handles empty and optional fields by converting to null and defaults', () => {
      const input: SaveFundamentalBriefInput = {
        symbol: 'AAPL',
        as_of_date: '2026-05-15',
        competitors: [],
        key_risks: [],
        thesis_kpis: [],
      };

      const serialized = serializeStockFundamental(input);

      expect(serialized.symbol).toBe('AAPL');
      expect(serialized.business_model).toBeNull();
      expect(serialized.moat).toBeNull();
      expect(serialized.competitors).toBeNull();
      expect(serialized.guidance).toBeNull();
      expect(serialized.key_risks).toBeNull();
      expect(serialized.thesis_kpis).toBeNull();
      expect(serialized.as_of_date).toBe('2026-05-15');
      expect(serialized.notebook_id).toBeNull();
      expect(serialized.source_count).toBe(1);
    });

    it('defaults source_count to 1 when NaN or omitted', () => {
      const input: SaveFundamentalBriefInput = {
        symbol: 'MSFT',
        as_of_date: '2026-01-01',
        source_count: NaN,
      };

      const serialized = serializeStockFundamental(input);
      expect(serialized.source_count).toBe(1);
    });
  });

  describe('computeFreshnessStatus', () => {
    const fixedNow = new Date('2026-10-15T00:00:00Z');

    it('returns "missing" for null, undefined, empty, or whitespace date', () => {
      expect(computeFreshnessStatus(null, fixedNow)).toBe('missing');
      expect(computeFreshnessStatus(undefined, fixedNow)).toBe('missing');
      expect(computeFreshnessStatus('', fixedNow)).toBe('missing');
      expect(computeFreshnessStatus('   ', fixedNow)).toBe('missing');
    });

    it('returns "missing" for unparseable date strings', () => {
      expect(computeFreshnessStatus('invalid-date-format', fixedNow)).toBe('missing');
      expect(computeFreshnessStatus('foo/bar/baz', fixedNow)).toBe('missing');
    });

    it('returns "active" for dates less than 90 days old', () => {
      // Exactly today: 0 days
      expect(computeFreshnessStatus('2026-10-15', fixedNow)).toBe('active');
      // 30 days ago: 2026-09-15
      expect(computeFreshnessStatus('2026-09-15', fixedNow)).toBe('active');
      // 89 days ago: 2026-07-18
      expect(computeFreshnessStatus('2026-07-18', fixedNow)).toBe('active');
    });

    it('returns "stale" for dates 90 days old or older', () => {
      // Exactly 90 days ago: 2026-07-17 (July has 31 days: 17 to 31 is 14 days, Aug 31 days, Sep 30 days, Oct 15 days = 90 days)
      const date90DaysAgo = new Date(fixedNow.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      expect(computeFreshnessStatus(date90DaysAgo, fixedNow)).toBe('stale');

      // 91 days ago
      const date91DaysAgo = new Date(fixedNow.getTime() - 91 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      expect(computeFreshnessStatus(date91DaysAgo, fixedNow)).toBe('stale');

      // 180 days ago
      const date180DaysAgo = new Date(fixedNow.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      expect(computeFreshnessStatus(date180DaysAgo, fixedNow)).toBe('stale');
    });

    it('returns "active" for future dates', () => {
      expect(computeFreshnessStatus('2026-10-16', fixedNow)).toBe('active');
      expect(computeFreshnessStatus('2026-12-31', fixedNow)).toBe('active');
    });
  });
});
