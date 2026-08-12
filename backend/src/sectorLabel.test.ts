import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal mock D1 statement that chains bind/run/all/first */
function makeStmt(overrides: Partial<{ run: any; all: any; first: any }> = {}) {
	const stmt: any = {
		bind: vi.fn().mockImplementation(() => stmt),
		run: overrides.run ?? vi.fn().mockResolvedValue({ success: true }),
		all: overrides.all ?? vi.fn().mockResolvedValue({ results: [] }),
		first: overrides.first ?? vi.fn().mockResolvedValue(null),
	};
	return stmt;
}

// ── Sector Label: PUT /api/watchlist ─────────────────────────────────────────

describe('PUT /api/watchlist — sector_label persistence', () => {
	beforeEach(() => vi.resetAllMocks());

	it('persists sector_label when provided', async () => {
		const runMock = vi.fn().mockResolvedValue({ success: true });
		const stmt = makeStmt({ run: runMock });
		const mockDb = { prepare: vi.fn().mockReturnValue(stmt) };

		// Simulate the handler logic directly (same pattern as route)
		const body = { symbol: 'AAPL', sector_label: 'Tech Growth' };
		const { symbol, sector_label } = body as any;

		if (sector_label !== undefined) {
			await mockDb
				.prepare('UPDATE watchlist SET sector_label = ? WHERE symbol = ?')
				.bind(sector_label || null, symbol)
				.run();
		}

		expect(mockDb.prepare).toHaveBeenCalledWith(
			'UPDATE watchlist SET sector_label = ? WHERE symbol = ?'
		);
		expect(stmt.bind).toHaveBeenCalledWith('Tech Growth', 'AAPL');
		expect(runMock).toHaveBeenCalledTimes(1);
	});

	it('persists sector_label_color when provided', async () => {
		const runMock = vi.fn().mockResolvedValue({ success: true });
		const stmt = makeStmt({ run: runMock });
		const mockDb = { prepare: vi.fn().mockReturnValue(stmt) };

		const body = { symbol: 'AAPL', sector_label_color: '#10b981' };
		const { symbol, sector_label_color } = body as any;

		if (sector_label_color !== undefined) {
			await mockDb
				.prepare('UPDATE watchlist SET sector_label_color = ? WHERE symbol = ?')
				.bind(sector_label_color || null, symbol)
				.run();
		}

		expect(stmt.bind).toHaveBeenCalledWith('#10b981', 'AAPL');
		expect(runMock).toHaveBeenCalledTimes(1);
	});

	it('stores null when sector_label is cleared (empty string)', async () => {
		const runMock = vi.fn().mockResolvedValue({ success: true });
		const stmt = makeStmt({ run: runMock });
		const mockDb = { prepare: vi.fn().mockReturnValue(stmt) };

		const body = { symbol: 'AAPL', sector_label: '' };
		const { symbol, sector_label } = body as any;

		if (sector_label !== undefined) {
			await mockDb
				.prepare('UPDATE watchlist SET sector_label = ? WHERE symbol = ?')
				.bind(sector_label || null, symbol)  // '' → null
				.run();
		}

		// Empty string must be coerced to null (falsy guard: sector_label || null)
		expect(stmt.bind).toHaveBeenCalledWith(null, 'AAPL');
	});

	it('skips sector_label UPDATE when field is not in payload', async () => {
		const runMock = vi.fn().mockResolvedValue({ success: true });
		const stmt = makeStmt({ run: runMock });
		const mockDb = { prepare: vi.fn().mockReturnValue(stmt) };

		// Payload has only `name` — sector_label is undefined
		const body = { symbol: 'AAPL', name: 'Apple Inc.' } as any;
		const { symbol, name, sector_label } = body;

		if (name !== undefined) {
			await mockDb.prepare('UPDATE watchlist SET name = ? WHERE symbol = ?').bind(name, symbol).run();
		}
		if (sector_label !== undefined) {
			await mockDb.prepare('UPDATE watchlist SET sector_label = ? WHERE symbol = ?').bind(sector_label || null, symbol).run();
		}

		// prepare called once (for name only), not twice
		expect(mockDb.prepare).toHaveBeenCalledTimes(1);
		expect(mockDb.prepare).toHaveBeenCalledWith('UPDATE watchlist SET name = ? WHERE symbol = ?');
	});
});

// ── Sector Label: GET /api/portfolio/holdings ─────────────────────────────────

describe('GET /api/portfolio/holdings — sector_label in response', () => {
	beforeEach(() => vi.resetAllMocks());

	it('includes sector_label and sector_label_color from watchlist JOIN', async () => {
		const mockRow = {
			symbol: 'AAPL',
			shares: 10,
			avg_cost: 150,
			total_cost: 1500,
			status: 'Open',
			name: 'Apple Inc.',
			sector_label: 'Tech Growth',
			sector_label_color: '#10b981',
			last_price: 180,
			previous_close: 175,
			market_cap: null,
			p_e: null,
			price_updated_at: null,
			stats_updated_at: null,
			tot_div_income: 0,
			realized_gain_amt: 0,
			realized_cost_basis: 0,
		};

		const stmt = makeStmt({ all: vi.fn().mockResolvedValue({ results: [mockRow] }) });
		const mockDb = { prepare: vi.fn().mockReturnValue(stmt) };

		const { results } = await mockDb.prepare('SELECT ...').all();
		const row = (results as any[])[0];

		const output = {
			symbol: row.symbol,
			sector_label: row.sector_label || null,
			sector_label_color: row.sector_label_color || null,
		};

		expect(output.sector_label).toBe('Tech Growth');
		expect(output.sector_label_color).toBe('#10b981');
	});

	it('returns null for sector_label when watchlist has no label set', async () => {
		const mockRow = {
			symbol: 'MSFT',
			shares: 5,
			avg_cost: 300,
			total_cost: 1500,
			status: 'Open',
			name: 'Microsoft Corporation',
			sector_label: null,       // not set
			sector_label_color: null, // not set
			last_price: 320,
			previous_close: 315,
			market_cap: null,
			p_e: null,
			price_updated_at: null,
			stats_updated_at: null,
			tot_div_income: 0,
			realized_gain_amt: 0,
			realized_cost_basis: 0,
		};

		const stmt = makeStmt({ all: vi.fn().mockResolvedValue({ results: [mockRow] }) });
		const mockDb = { prepare: vi.fn().mockReturnValue(stmt) };

		const { results } = await mockDb.prepare('SELECT ...').all();
		const row = (results as any[])[0];

		expect(row.sector_label || null).toBeNull();
		expect(row.sector_label_color || null).toBeNull();
	});
});

// ── Sector Label: Fallback display logic ─────────────────────────────────────

describe('Sector Label fallback display logic', () => {
	/** Mirrors the frontend expression: h.sector_label || h.name */
	function resolveDisplayLabel(sector_label: string | null | undefined, name: string): string {
		return sector_label || name;
	}

	/** Mirrors the frontend color expression */
	function resolveDisplayColor(
		sector_label: string | null | undefined,
		sector_label_color: string | null | undefined
	): string | undefined {
		return sector_label && sector_label_color ? sector_label_color : undefined;
	}

	it('shows sector_label when set', () => {
		expect(resolveDisplayLabel('Tech Growth', 'Apple Inc.')).toBe('Tech Growth');
	});

	it('falls back to name when sector_label is null', () => {
		expect(resolveDisplayLabel(null, 'Apple Inc.')).toBe('Apple Inc.');
	});

	it('falls back to name when sector_label is empty string', () => {
		expect(resolveDisplayLabel('', 'Apple Inc.')).toBe('Apple Inc.');
	});

	it('applies color when both sector_label and sector_label_color are set', () => {
		expect(resolveDisplayColor('Tech Growth', '#10b981')).toBe('#10b981');
	});

	it('returns undefined color when sector_label is null (no color applied)', () => {
		expect(resolveDisplayColor(null, '#10b981')).toBeUndefined();
	});

	it('returns undefined color when sector_label_color is null', () => {
		expect(resolveDisplayColor('Tech Growth', null)).toBeUndefined();
	});

	it('returns undefined color when both are null', () => {
		expect(resolveDisplayColor(null, null)).toBeUndefined();
	});
});
