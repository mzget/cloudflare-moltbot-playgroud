export interface ATHRecord {
	allTimeHigh: number;
	allTimeHighDate: string;
	allTimeLow: number;
	allTimeLowDate: string;
}

export async function initializeAllTimeRecords(
	db: any,
	symbol: string,
	fmpApiKey: string
): Promise<ATHRecord | null> {
	try {
		console.log(`[ATHSeeding] Seeding ATH/ATL for ${symbol} using TradingView...`);
		const tvUrl = 'https://scanner.tradingview.com/america/scan';
		const body = {
			columns: ['name', 'close', 'High.All', 'Low.All'],
			filter: [
				{ left: 'name', operation: 'equal', right: symbol.toUpperCase() }
			]
		};

		const res = await fetch(tvUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			},
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			throw new Error(`Failed to fetch TradingView quote for ${symbol}: ${res.statusText}`);
		}

		const json = (await res.json()) as { data: { s: string; d: any[] }[] };
		if (!json.data || json.data.length === 0) {
			console.log(`[ATHSeeding] No TradingView data found for ${symbol}`);
			return null;
		}

		const [name, price, ath, atl] = json.data[0].d;

		if (!ath || !atl) {
			console.log(`[ATHSeeding] Could not determine ATH/ATL for ${symbol}`);
			return null;
		}

		console.log(`[ATHSeeding] Symbol: ${symbol} | ATH: ${ath} | ATL: ${atl}`);

		await db.prepare(`
			INSERT INTO market_stats (
				symbol, all_time_high, all_time_high_date, all_time_low, all_time_low_date, updated_at
			) VALUES (?1, ?2, ?3, ?4, ?5, strftime('%s', 'now'))
			ON CONFLICT(symbol) DO UPDATE SET
				all_time_high = excluded.all_time_high,
				all_time_high_date = excluded.all_time_high_date,
				all_time_low = excluded.all_time_low,
				all_time_low_date = excluded.all_time_low_date,
				updated_at = strftime('%s', 'now')
		`).bind(symbol, ath, null, atl, null).run();

		return {
			allTimeHigh: ath,
			allTimeHighDate: '',
			allTimeLow: atl,
			allTimeLowDate: ''
		};
	} catch (error) {
		console.error(`[ATHSeeding] Error seeding ATH/ATL for ${symbol}:`, error);
		return null;
	}
}

export async function seedAllActiveWatchlist(db: any, fmpApiKey: string): Promise<void> {
	try {
		const watchlist = await db.prepare(`
			SELECT symbol FROM watchlist WHERE is_active = 1
		`).all();

		const symbols = (watchlist.results || []).map((r: any) => r.symbol.toUpperCase());
		console.log(`[ATHSeeding] Found ${symbols.length} active watchlist items to seed`);
		if (symbols.length === 0) return;

		console.log('[ATHSeeding] Fetching bulk market data from TradingView...');
		const tvUrl = 'https://scanner.tradingview.com/america/scan';
		const body = {
			columns: ['name', 'close', 'High.All', 'Low.All'],
			filter: [
				{
					left: 'type',
					operation: 'in_range',
					right: ['stock', 'dr']
				}
			],
			range: [0, 25000]
		};

		const res = await fetch(tvUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			},
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			throw new Error(`Failed to fetch TradingView quotes: ${res.statusText}`);
		}

		const json = (await res.json()) as { data: { s: string; d: any[] }[] };
		console.log(`[ATHSeeding] Received ${json.data.length} quotes from TradingView`);

		const tvDataMap = new Map<string, { ath: number; atl: number }>();
		for (const item of json.data) {
			const [name, price, ath, atl] = item.d;
			if (name && ath && atl) {
				tvDataMap.set(name.toUpperCase(), { ath, atl });
			}
		}

		for (const symbol of symbols) {
			const stats = await db.prepare(`
				SELECT all_time_high FROM market_stats WHERE symbol = ?1
			`).bind(symbol).first();

			if (stats && stats.all_time_high !== null) {
				console.log(`[ATHSeeding] Symbol ${symbol} already has ATH seeded. Skipping.`);
				continue;
			}

			const data = tvDataMap.get(symbol);
			if (data) {
				console.log(`[ATHSeeding] Seeding ${symbol} | ATH: ${data.ath} | ATL: ${data.atl}`);
				await db.prepare(`
					INSERT INTO market_stats (
						symbol, all_time_high, all_time_high_date, all_time_low, all_time_low_date, updated_at
					) VALUES (?1, ?2, ?3, ?4, ?5, strftime('%s', 'now'))
					ON CONFLICT(symbol) DO UPDATE SET
						all_time_high = excluded.all_time_high,
						all_time_high_date = excluded.all_time_high_date,
						all_time_low = excluded.all_time_low,
						all_time_low_date = excluded.all_time_low_date,
						updated_at = strftime('%s', 'now')
				`).bind(symbol, data.ath, null, data.atl, null).run();
			} else {
				console.log(`[ATHSeeding] Symbol ${symbol} not found in TradingView bulk response`);
			}
		}
	} catch (error) {
		console.error('[ATHSeeding] Error seeding watchlist:', error);
	}
}