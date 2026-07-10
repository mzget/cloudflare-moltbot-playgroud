import { fetchHistoricalPrices } from './fmpClient';

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
		console.log(`[ATHSeeding] Seeding ATH/ATL for ${symbol}...`);
		const history = await fetchHistoricalPrices(fmpApiKey, symbol);
		if (!history || !history.historical || history.historical.length === 0) {
			console.log(`[ATHSeeding] No history found for ${symbol}`);
			return null;
		}

		let ath = -Infinity;
		let athDate = '';
		let atl = Infinity;
		let atlDate = '';

		for (const entry of history.historical) {
			// Find max of high
			if (entry.high && entry.high > ath) {
				ath = entry.high;
				athDate = entry.date;
			}
			// Find min of low
			if (entry.low && entry.low < atl) {
				atl = entry.low;
				atlDate = entry.date;
			}
		}

		if (ath === -Infinity || atl === Infinity) {
			console.log(`[ATHSeeding] Could not determine ATH/ATL for ${symbol}`);
			return null;
		}

		console.log(`[ATHSeeding] Symbol: ${symbol} | ATH: ${ath} on ${athDate} | ATL: ${atl} on ${atlDate}`);

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
		`).bind(symbol, ath, athDate, atl, atlDate).run();

		return {
			allTimeHigh: ath,
			allTimeHighDate: athDate,
			allTimeLow: atl,
			allTimeLowDate: atlDate
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

		const symbols = (watchlist.results || []).map((r: any) => r.symbol);
		console.log(`[ATHSeeding] Found ${symbols.length} active watchlist items to seed`);

		for (const symbol of symbols) {
			// Check if already seeded (has non-null ATH)
			const stats = await db.prepare(`
				SELECT all_time_high FROM market_stats WHERE symbol = ?1
			`).bind(symbol).first();

			if (stats && stats.all_time_high !== null) {
				console.log(`[ATHSeeding] Symbol ${symbol} already has ATH seeded. Skipping.`);
				continue;
			}

			await initializeAllTimeRecords(db, symbol, fmpApiKey);
			// Add a short delay to be nice to the API rate limits
			await new Promise(resolve => setTimeout(resolve, 200));
		}
	} catch (error) {
		console.error('[ATHSeeding] Error seeding watchlist:', error);
	}
}
