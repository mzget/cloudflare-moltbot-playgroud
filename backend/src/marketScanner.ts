export interface BreakoutResult {
	symbol: string;
	name: string;
	price: number;
	percentChange: number;
	yearHigh: number;
	yearLow: number;
	allTimeHigh?: number | null;
	allTimeLow?: number | null;
	breakoutType: 'ath' | '52w_high' | '52w_low' | 'atl';
}

export type BreakoutStatus =
	| 'ath'
	| '52w_high'
	| '52w_low'
	| 'atl'
	| 'near_ath'
	| 'near_52w_high'
	| 'near_52w_low'
	| 'near_atl'
	| 'normal';

export interface WatchlistProximityItem {
	symbol: string;
	name: string;
	sectorLabel?: string | null;
	sectorLabelColor?: string | null;
	price: number;
	percentChange: number;
	yearHigh: number | null;
	yearLow: number | null;
	allTimeHigh: number | null;
	allTimeLow: number | null;
	distance52wHigh: number | null;
	distanceAth: number | null;
	distance52wLow: number | null;
	distanceAtl: number | null;
	status: BreakoutStatus;
	updatedAt?: string | null;
}

export interface WatchlistBreakoutSummary {
	totalWatchlist: number;
	athCount: number;
	high52wCount: number;
	low52wCount: number;
	atlCount: number;
	nearAthCount: number;
	nearHigh52wCount: number;
	nearLow52wCount: number;
	nearAtlCount: number;
	totalBreakouts: number;
	highsRatio: number;
	lowsRatio: number;
}

/**
 * Calculates percentage distance between current price and target extreme.
 * Distance to High: ((price - target) / target) * 100  (Negative when below high, 0 or positive at/above high)
 * Distance to Low:  ((price - target) / target) * 100  (Positive when above low, 0 or negative at/below low)
 */
export function calculateDistance(price: number, target: number | null | undefined): number | null {
	if (target === null || target === undefined || target <= 0 || price <= 0) return null;
	const dist = ((price - target) / target) * 100;
	return Math.round(dist * 100) / 100;
}

/**
 * Classifies breakout status based on Precedence Rules:
 * 1. Strict Exclusive Precedence:
 *    - ATH > 52W High (price >= ath triggers 'ath', NOT '52w_high')
 *    - ATL > 52W Low (price <= atl triggers 'atl', NOT '52w_low')
 * 2. Imminent Near-Breakout Threshold (default 3.0% buffer):
 *    - Near ATH: -3.0% <= distAth < 0%
 *    - Near 52W High: -3.0% <= dist52wHigh < 0%
 *    - Near ATL: 0% < distAtl <= +3.0%
 *    - Near 52W Low: 0% < dist52wLow <= +3.0%
 */
export function classifyBreakoutStatus(
	price: number,
	yearHigh: number | null | undefined,
	yearLow: number | null | undefined,
	ath: number | null | undefined,
	atl: number | null | undefined,
	bufferPercent: number = 3.0
): BreakoutStatus {
	if (!price || price <= 0) return 'normal';

	// 1. Confirmed Breakouts (Strict Exclusive Hierarchy)
	if (ath && ath > 0 && price >= ath) {
		return 'ath';
	}
	if (atl && atl > 0 && price <= atl) {
		return 'atl';
	}
	if (yearHigh && yearHigh > 0 && price >= yearHigh) {
		return '52w_high';
	}
	if (yearLow && yearLow > 0 && price <= yearLow) {
		return '52w_low';
	}

	// 2. Near-Breakouts / Imminent Thresholds (3% Buffer)
	if (ath && ath > 0) {
		const distAth = ((price - ath) / ath) * 100;
		if (distAth >= -bufferPercent && distAth < 0) {
			return 'near_ath';
		}
	}

	if (yearHigh && yearHigh > 0) {
		const dist52wHigh = ((price - yearHigh) / yearHigh) * 100;
		if (dist52wHigh >= -bufferPercent && dist52wHigh < 0) {
			return 'near_52w_high';
		}
	}

	if (atl && atl > 0) {
		const distAtl = ((price - atl) / atl) * 100;
		if (distAtl <= bufferPercent && distAtl > 0) {
			return 'near_atl';
		}
	}

	if (yearLow && yearLow > 0) {
		const dist52wLow = ((price - yearLow) / yearLow) * 100;
		if (dist52wLow <= bufferPercent && dist52wLow > 0) {
			return 'near_52w_low';
		}
	}

	return 'normal';
}

export async function scanMarketBreakouts(
	db: any,
	fmpApiKey: string,
	scope: 'watchlist' | 'market' = 'watchlist'
): Promise<BreakoutResult[]> {
	console.log(`[MarketScanner] Starting ${scope} breakout scan using TradingView API...`);
	const allBreakouts: BreakoutResult[] = [];
	const todayDate = new Date().toISOString().split('T')[0];

	try {
		const pauseScanRow = await db.prepare("SELECT value FROM system_settings WHERE key = 'pause_market_breakout_scan'").first() as { value: string } | null;
		if (pauseScanRow && pauseScanRow.value === '1') {
			console.log('[MarketScanner] Market breakout scanning is paused via system_settings. Skipping scan.');
			return [];
		}
	} catch (e) {
		console.warn('[MarketScanner] Failed to check pause_market_breakout_scan:', e);
	}

	// For watchlist scope, fetch watchlist symbols first
	let watchlistSymbols: Set<string> | null = null;
	if (scope === 'watchlist') {
		try {
			const watchlistRes = await db.prepare('SELECT symbol FROM watchlist WHERE is_active = 1').all();
			const symbols = (watchlistRes.results || []).map((r: any) => r.symbol.toUpperCase());
			if (symbols.length === 0) {
				console.log('[MarketScanner] No active watchlist symbols. Skipping scan.');
				return [];
			}
			watchlistSymbols = new Set(symbols);
			console.log(`[MarketScanner] Scanning ${symbols.length} watchlist symbols: ${symbols.join(', ')}`);
		} catch (error) {
			console.error('[MarketScanner] Failed to fetch watchlist:', error);
			return [];
		}
	}

	// Pre-fetch existing market_stats to cross-reference known ATH/ATL
	const existingStatsMap = new Map<string, { allTimeHigh: number | null; allTimeLow: number | null; yearHigh: number | null; yearLow: number | null }>();
	try {
		const statsRes = await db.prepare('SELECT symbol, all_time_high, all_time_low, fifty_two_week_high, fifty_two_week_low FROM market_stats').all();
		for (const row of (statsRes.results || [])) {
			existingStatsMap.set(String(row.symbol).toUpperCase(), {
				allTimeHigh: row.all_time_high ?? null,
				allTimeLow: row.all_time_low ?? null,
				yearHigh: row.fifty_two_week_high ?? null,
				yearLow: row.fifty_two_week_low ?? null,
			});
		}
	} catch (e) {
		console.warn('[MarketScanner] Failed to pre-fetch market_stats:', e);
	}

	try {
		const tvUrl = 'https://scanner.tradingview.com/america/scan';
		const body: any = {
			columns: ['name', 'description', 'close', 'change', 'price_52_week_high', 'price_52_week_low', 'High.All', 'Low.All'],
			filter: [] as any[],
		};

		if (scope === 'watchlist') {
			body.filter.push({
				left: 'name',
				operation: 'in_range',
				right: Array.from(watchlistSymbols!)
			});
		} else {
			body.filter.push({
				left: 'type',
				operation: 'in_range',
				right: ['stock', 'dr']
			});
			body.range = [0, 25000];
		}

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
		console.log(`[MarketScanner] Received ${json.data ? json.data.length : 0} quotes from TradingView`);

		const statsUpdates: any[] = [];

		for (const item of (json.data || [])) {
			const symbolWithExchange = item.s;
			const parts = symbolWithExchange.split(':');
			if (parts.length < 2) continue;
			const exchange = parts[0];
			const symbol = parts[1].toUpperCase();

			if (exchange !== 'NASDAQ' && exchange !== 'NYSE' && exchange !== 'AMEX') continue;
			if (scope === 'market' && (symbol.includes('.') || symbol.includes('-') || symbol.length > 5)) continue;

			const [name, description, price, percentChange, yearHigh, yearLow, tvAth, tvAtl] = item.d;
			if (!symbol || !price || price <= 0) continue;

			const existing = existingStatsMap.get(symbol);
			const effectiveAth = (typeof tvAth === 'number' && tvAth > 0) ? tvAth : (existing?.allTimeHigh ?? null);
			const effectiveAtl = (typeof tvAtl === 'number' && tvAtl > 0) ? tvAtl : (existing?.allTimeLow ?? null);
			const effectiveYearHigh = (typeof yearHigh === 'number' && yearHigh > 0) ? yearHigh : (existing?.yearHigh ?? null);
			const effectiveYearLow = (typeof yearLow === 'number' && yearLow > 0) ? yearLow : (existing?.yearLow ?? null);

			// Classify status with Exclusive Hierarchy
			const status = classifyBreakoutStatus(price, effectiveYearHigh, effectiveYearLow, effectiveAth, effectiveAtl, 3.0);

			if (status === 'ath' || status === '52w_high' || status === '52w_low' || status === 'atl') {
				allBreakouts.push({
					symbol,
					name: description || name || symbol,
					price,
					percentChange: percentChange || 0,
					yearHigh: effectiveYearHigh || 0,
					yearLow: effectiveYearLow || 0,
					allTimeHigh: effectiveAth,
					allTimeLow: effectiveAtl,
					breakoutType: status
				});
			}

			// Stage stats sync to ensure market_stats reflects fresh bounds
			if (scope === 'watchlist') {
				statsUpdates.push(
					db.prepare(`
						INSERT INTO market_stats (
							symbol, price, change, fifty_two_week_high, fifty_two_week_low, all_time_high, all_time_low, updated_at
						) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, strftime('%s', 'now'))
						ON CONFLICT(symbol) DO UPDATE SET
							price = excluded.price,
							change = excluded.change,
							fifty_two_week_high = COALESCE(excluded.fifty_two_week_high, market_stats.fifty_two_week_high),
							fifty_two_week_low = COALESCE(excluded.fifty_two_week_low, market_stats.fifty_two_week_low),
							all_time_high = CASE 
								WHEN excluded.all_time_high IS NOT NULL THEN MAX(COALESCE(market_stats.all_time_high, 0), excluded.all_time_high, excluded.price)
								ELSE market_stats.all_time_high 
							END,
							all_time_low = CASE 
								WHEN excluded.all_time_low IS NOT NULL THEN MIN(COALESCE(market_stats.all_time_low, 999999), excluded.all_time_low, excluded.price)
								ELSE market_stats.all_time_low 
							END,
							updated_at = strftime('%s', 'now')
					`).bind(symbol, price, percentChange || 0, effectiveYearHigh, effectiveYearLow, effectiveAth, effectiveAtl)
				);
			}
		}

		if (statsUpdates.length > 0) {
			const chunkSize = 50;
			for (let i = 0; i < statsUpdates.length; i += chunkSize) {
				try {
					await db.batch(statsUpdates.slice(i, i + chunkSize));
				} catch (e) {
					console.warn('[MarketScanner] Failed to batch update market_stats:', e);
				}
			}
		}
	} catch (error) {
		console.error('[MarketScanner] Error during TradingView scan:', error);
	}

	console.log(`[MarketScanner] Scan completed. Found ${allBreakouts.length} total breakouts/breakdowns.`);

	// 2. Clear today's previous scans to avoid duplicates on rerun
	try {
		await db.prepare('DELETE FROM market_breakouts WHERE scan_date = ?1').bind(todayDate).run();
	} catch (e) {
		console.error('[MarketScanner] Error cleaning old breakouts:', e);
	}

	if (allBreakouts.length === 0) {
		return [];
	}

	// 3. Batch insert breakouts into D1
	const chunkSize = 100;
	for (let i = 0; i < allBreakouts.length; i += chunkSize) {
		const chunk = allBreakouts.slice(i, i + chunkSize);
		const statements = chunk.map(b => {
			return db.prepare(`
				INSERT INTO market_breakouts (
					symbol, name, price, percent_change, year_high, year_low, breakout_type, scan_date, all_time_high, all_time_low
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
			`).bind(
				b.symbol,
				b.name,
				b.price,
				b.percentChange,
				b.yearHigh,
				b.yearLow,
				b.breakoutType,
				todayDate,
				b.allTimeHigh ?? null,
				b.allTimeLow ?? null
			);
		});

		try {
			await db.batch(statements);
		} catch (error) {
			console.error('[MarketScanner] Batch insert failed:', error);
		}
	}

	// 4. Create in-app notifications for watchlisted breakouts (Adhere to Deduplication Rule)
	try {
		const pauseRow = await db.prepare("SELECT value FROM system_settings WHERE key = 'pause_market_breakout_notifications'").first() as { value: string } | null;
		if (pauseRow && pauseRow.value === '1') {
			console.log('[MarketScanner] Market breakout notifications are paused via system_settings. Skipping notification creation.');
			return allBreakouts;
		}

		// Pre-fetch today's already notified events to prevent database queries in loops
		const loggedEvents = new Set<string>();
		try {
			const dbEvents = await db.prepare(`
				SELECT symbol, event_type FROM record_breaker_events WHERE event_date = ?1
			`).bind(todayDate).all();
			for (const row of (dbEvents.results || [])) {
				loggedEvents.add(`${String(row.symbol).toUpperCase()}:${String(row.event_type)}`);
			}
		} catch (e) {
			console.warn('[MarketScanner] Failed to pre-fetch record_breaker_events:', e);
		}

		const breakoutsToNotify: BreakoutResult[] = [];
		if (scope === 'watchlist') {
			breakoutsToNotify.push(...allBreakouts);
		} else {
			const watchlistRes = await db.prepare('SELECT symbol FROM watchlist WHERE is_active = 1').all();
			const watchlist = new Set((watchlistRes.results || []).map((r: any) => r.symbol.toUpperCase()));
			for (const breakout of allBreakouts) {
				if (watchlist.has(breakout.symbol)) {
					breakoutsToNotify.push(breakout);
				}
			}
		}

		const notificationStatements: any[] = [];
		for (const breakout of breakoutsToNotify) {
			const eventKey = `${breakout.symbol}:${breakout.breakoutType}`;
			if (loggedEvents.has(eventKey)) {
				continue;
			}

			console.log(`[MarketScanner] ALERT: Watchlisted stock ${breakout.symbol} triggered ${breakout.breakoutType}`);
			loggedEvents.add(eventKey);

			let message = '';
			let conditionType = 'breakout';
			let targetRecord = breakout.yearHigh;

			if (breakout.breakoutType === 'ath') {
				conditionType = 'breakout';
				targetRecord = breakout.allTimeHigh ?? breakout.price;
				message = `${breakout.symbol} broke out to a new All-Time High of $${breakout.price} (${breakout.percentChange >= 0 ? '+' : ''}${breakout.percentChange.toFixed(2)}%)!`;
			} else if (breakout.breakoutType === '52w_high') {
				conditionType = 'breakout';
				targetRecord = breakout.yearHigh;
				message = `${breakout.symbol} broke out to a new 52-week high of $${breakout.price} (${breakout.percentChange >= 0 ? '+' : ''}${breakout.percentChange.toFixed(2)}%)!`;
			} else if (breakout.breakoutType === 'atl') {
				conditionType = 'breakdown';
				targetRecord = breakout.allTimeLow ?? breakout.price;
				message = `${breakout.symbol} broke down to a new All-Time Low of $${breakout.price} (${breakout.percentChange >= 0 ? '+' : ''}${breakout.percentChange.toFixed(2)}%)!`;
			} else {
				// 52w_low
				conditionType = 'breakdown';
				targetRecord = breakout.yearLow;
				message = `${breakout.symbol} broke down to a new 52-week low of $${breakout.price} (${breakout.percentChange >= 0 ? '+' : ''}${breakout.percentChange.toFixed(2)}%)!`;
			}

			notificationStatements.push(
				db.prepare(`
					INSERT INTO in_app_notifications (
						symbol, metric, condition_type, target_value, trigger_value, message, is_read, created_at
					) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, strftime('%s', 'now'))
				`).bind(breakout.symbol, breakout.breakoutType, conditionType, targetRecord, breakout.price, message),
				db.prepare(`
					INSERT INTO record_breaker_events (
						symbol, event_type, price, previous_record, event_date, is_notified, created_at
					) VALUES (?1, ?2, ?3, ?4, ?5, 1, strftime('%s', 'now'))
				`).bind(breakout.symbol, breakout.breakoutType, breakout.price, targetRecord, todayDate)
			);
		}

		if (notificationStatements.length > 0) {
			const notifChunkSize = 50;
			for (let i = 0; i < notificationStatements.length; i += notifChunkSize) {
				try {
					await db.batch(notificationStatements.slice(i, i + notifChunkSize));
				} catch (err) {
					console.error('[MarketScanner] Batch insert notifications failed:', err);
				}
			}
		}
	} catch (err) {
		console.error('[MarketScanner] Watchlist notification error:', err);
	}

	return allBreakouts;
}

/**
 * Retrieves the complete Watchlist Breakouts payload for the live "Today" scope:
 * 1. Today's confirmed breakout events
 * 2. Full Watchlist Proximity Matrix for all active watchlist symbols
 * 3. Aggregated Summary & Breadth Ratios
 */
export async function getWatchlistBreakoutsData(db: any): Promise<{
	summary: WatchlistBreakoutSummary;
	todayBreakouts: BreakoutResult[];
	matrix: WatchlistProximityItem[];
}> {
	const todayDate = new Date().toISOString().split('T')[0];

	// 1. Fetch all active watchlist stocks joined with latest market stats
	let watchlistRows: any[] = [];
	try {
		const res = await db.prepare(`
			SELECT 
				w.symbol, w.name, w.sector_label, w.sector_label_color,
				s.price, s.change as percent_change,
				s.fifty_two_week_high, s.fifty_two_week_low,
				s.all_time_high, s.all_time_low,
				s.updated_at
			FROM watchlist w
			LEFT JOIN market_stats s ON w.symbol = s.symbol
			WHERE w.is_active = 1
			ORDER BY w.symbol ASC
		`).all();
		watchlistRows = res.results || [];
	} catch (error) {
		console.error('[MarketScanner] Failed to fetch watchlist items for matrix:', error);
	}

	// 2. Fetch today's confirmed breakouts from market_breakouts table
	let todayBreakouts: BreakoutResult[] = [];
	try {
		const res = await db.prepare(`
			SELECT 
				symbol, name, price, percent_change as percentChange, 
				year_high as yearHigh, year_low as yearLow, 
				breakout_type as breakoutType, all_time_high as allTimeHigh, all_time_low as allTimeLow
			FROM market_breakouts
			WHERE scan_date = ?1
			ORDER BY percent_change DESC
		`).bind(todayDate).all();
		todayBreakouts = (res.results || []) as BreakoutResult[];
	} catch (error) {
		console.error('[MarketScanner] Failed to fetch today breakouts:', error);
	}

	const confirmedMap = new Map<string, 'ath' | '52w_high' | '52w_low' | 'atl'>();
	for (const b of todayBreakouts) {
		confirmedMap.set(b.symbol.toUpperCase(), b.breakoutType);
	}

	// 3. Build Watchlist Proximity Matrix
	const matrix: WatchlistProximityItem[] = [];
	let athCount = 0;
	let high52wCount = 0;
	let low52wCount = 0;
	let atlCount = 0;
	let nearAthCount = 0;
	let nearHigh52wCount = 0;
	let nearLow52wCount = 0;
	let nearAtlCount = 0;

	for (const row of watchlistRows) {
		const symbol = String(row.symbol).toUpperCase();
		const price = typeof row.price === 'number' ? row.price : 0;
		const percentChange = typeof row.percent_change === 'number' ? row.percent_change : 0;
		const yearHigh = typeof row.fifty_two_week_high === 'number' ? row.fifty_two_week_high : null;
		const yearLow = typeof row.fifty_two_week_low === 'number' ? row.fifty_two_week_low : null;
		const ath = typeof row.all_time_high === 'number' ? row.all_time_high : null;
		const atl = typeof row.all_time_low === 'number' ? row.all_time_low : null;

		const distance52wHigh = calculateDistance(price, yearHigh);
		const distanceAth = calculateDistance(price, ath);
		const distance52wLow = calculateDistance(price, yearLow);
		const distanceAtl = calculateDistance(price, atl);

		// Determine status: if confirmed in today's breakouts, prioritize confirmed status; otherwise compute
		let status: BreakoutStatus = 'normal';
		if (confirmedMap.has(symbol)) {
			status = confirmedMap.get(symbol)!;
		} else if (price > 0) {
			status = classifyBreakoutStatus(price, yearHigh, yearLow, ath, atl, 3.0);
		}

		if (status === 'ath') athCount++;
		else if (status === '52w_high') high52wCount++;
		else if (status === '52w_low') low52wCount++;
		else if (status === 'atl') atlCount++;
		else if (status === 'near_ath') nearAthCount++;
		else if (status === 'near_52w_high') nearHigh52wCount++;
		else if (status === 'near_52w_low') nearLow52wCount++;
		else if (status === 'near_atl') nearAtlCount++;

		matrix.push({
			symbol,
			name: row.name || symbol,
			sectorLabel: row.sector_label || null,
			sectorLabelColor: row.sector_label_color || null,
			price,
			percentChange,
			yearHigh,
			yearLow,
			allTimeHigh: ath,
			allTimeLow: atl,
			distance52wHigh,
			distanceAth,
			distance52wLow,
			distanceAtl,
			status,
			updatedAt: row.updated_at ? String(row.updated_at) : null
		});
	}

	const totalBreakouts = athCount + high52wCount + low52wCount + atlCount;
	const highsCount = athCount + high52wCount;
	const lowsCount = atlCount + low52wCount;
	const highsRatio = totalBreakouts > 0 ? (highsCount / totalBreakouts) * 100 : 50;
	const lowsRatio = totalBreakouts > 0 ? (lowsCount / totalBreakouts) * 100 : 50;

	return {
		summary: {
			totalWatchlist: watchlistRows.length,
			athCount,
			high52wCount,
			low52wCount,
			atlCount,
			nearAthCount,
			nearHigh52wCount,
			nearLow52wCount,
			nearAtlCount,
			totalBreakouts,
			highsRatio: Math.round(highsRatio * 10) / 10,
			lowsRatio: Math.round(lowsRatio * 10) / 10
		},
		todayBreakouts,
		matrix
	};
}
