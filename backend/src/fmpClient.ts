export interface FMPQuote {
	symbol: string;
	name?: string;
	price: number;
	changesPercentage?: number;
	yearHigh?: number;
	yearLow?: number;
	exchange?: string;
}

export interface FMPHistoricalEntry {
	date: string;
	high: number;
	low: number;
	close: number;
}

export interface FMPHistoricalResponse {
	symbol: string;
	historical: FMPHistoricalEntry[];
}

export async function fetchExchangeQuotes(apiKey: string, exchange: string): Promise<FMPQuote[]> {
	const url = `https://financialmodelingprep.com/api/v3/quotes/${exchange.toLowerCase()}?apikey=${apiKey}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch FMP quotes for exchange ${exchange}: ${res.statusText}`);
	}
	const data = await res.json();
	return data as FMPQuote[];
}

export async function fetchHistoricalPrices(apiKey: string, symbol: string): Promise<FMPHistoricalResponse> {
	const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?apikey=${apiKey}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch FMP historical prices for ${symbol}: ${res.statusText}`);
	}
	const data = await res.json();
	return data as FMPHistoricalResponse;
}
