import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import StockOverview, { type CompanyOverviewPayload } from './StockOverview';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

describe('StockOverview Component', () => {
  const mockPayload: CompanyOverviewPayload = {
    symbol: 'META',
    name: 'Meta Platforms, Inc.',
    logo: 'https://example.com/meta.png',
    sector: 'Communication Services',
    industry: 'Media',
    exchange: 'NASDAQ',
    ipoDate: '2012-05-18',
    currency: 'USD',
    quarterly: [
      { period: "Q2 '24", asOfDate: '2024-06-30', totalRevenue: 47516, grossProfit: 38980, operatingProfit: 18775, operatingCashFlow: 25000, freeCashFlow: 14831 },
      { period: "Q3 '24", asOfDate: '2024-09-30', totalRevenue: 51000, grossProfit: 41000, operatingProfit: 20000, operatingCashFlow: 27000, freeCashFlow: 15500 },
      { period: "Q4 '24", asOfDate: '2024-12-31', totalRevenue: 56000, grossProfit: 45000, operatingProfit: 23000, operatingCashFlow: 30000, freeCashFlow: 17000 },
      { period: "Q1 '25", asOfDate: '2025-03-31', totalRevenue: 60000, grossProfit: 48000, operatingProfit: 24000, operatingCashFlow: 32000, freeCashFlow: 18000 },
      { period: "Q2 '25", asOfDate: '2025-06-30', totalRevenue: 64601, grossProfit: 52000, operatingProfit: 26000, operatingCashFlow: 34000, freeCashFlow: 19500 },
    ],
    annual: [
      { period: '2023', asOfDate: '2023-12-31', totalRevenue: 134902, grossProfit: 108943, operatingProfit: 46751, operatingCashFlow: 71113, freeCashFlow: 43010 },
      { period: '2024', asOfDate: '2024-12-31', totalRevenue: 164500, grossProfit: 133200, operatingProfit: 60000, operatingCashFlow: 82000, freeCashFlow: 51000 },
    ],
    companyStatistics: {
      profileMarginsReturns: [
        {
          category: 'Profile',
          items: [
            { label: 'Market Cap', value: '$1.78T' },
            { label: 'Enterprise Value', value: '$1.84T' },
            { label: 'Shares Out', value: '2.55B' },
            { label: 'Revenue (TTM)', value: '$228.4B' },
            { label: '52W High / Low', value: '$779.8 / $520.3' },
            { label: 'ATH / ATL', value: '$780.0 / $88.1' },
          ],
        },
        {
          category: 'Margins (TTM)',
          items: [
            { label: 'Gross', value: '81.8%' },
            { label: 'Operating', value: '42.5%' },
            { label: 'FCF', value: '26.3%' },
          ],
        },
      ],
      valuationHealth: [
        {
          category: 'Valuation (TTM)',
          items: [
            { label: 'P/E', value: '26.0x' },
            { label: 'P/B', value: '5.5x' },
            { label: 'P/S', value: '7.8x' },
          ],
        },
        {
          category: 'Valuation (Forward & Intrinsic)',
          items: [
            { label: 'DCF Base Value', value: '$650.00' },
            { label: 'Margin of Safety', value: '+10.8%', highlight: 'positive' },
          ],
        },
      ],
      growthDividends: [
        {
          category: 'Growth (CAGR / YoY)',
          items: [
            { label: 'Rev Growth (Q YoY)', value: '28.0%' },
            { label: 'Rev 1Yr (TTM)', value: '24.1%' },
            { label: 'Rev 3Yr CAGR', value: '19.9%' },
          ],
        },
        {
          category: 'Dividends & R&D Efficiency',
          items: [
            { label: 'Dividend Yield', value: '0.30%' },
            { label: 'R&D / Revenue', value: '26.2%' },
          ],
        },
      ],
    },
    updatedAt: '2026-10-22T10:00:00Z',
  };

  it('renders loading state when initialData is not provided', () => {
    const html = renderToString(<StockOverview symbol="META" />);
    expect(html).toContain('Loading financial overview for');
    expect(html).toContain('META');
  });

  it('renders top summary strip and company statistics with 3 columns when initialData is provided', () => {
    const html = renderToString(<StockOverview symbol="META" initialData={mockPayload} />);

    // Header strip
    expect(html).toContain('Meta Platforms, Inc.');
    expect(html).toContain('META');
    expect(html).toContain('Communication Services');
    expect(html).toContain('Media');
    expect(html).toContain('IPO 2012-05-18');

    // Company Statistics
    expect(html).toContain('Company Statistics');
    expect(html).toContain('$1.78T');
    expect(html).toContain('81.8%');
    expect(html).toContain('26.0x');
    expect(html).toContain('$650.00');
    expect(html).toContain('+10.8%');
    expect(html).toContain('28.0%');
  });

  it('renders SVG chart with period labels and interactive legend with CAGR calculations', () => {
    const html = renderToString(<StockOverview symbol="META" initialData={mockPayload} />);

    // Chart titles & controls
    expect(html).toContain('Financial Performance');
    expect(html).toContain('Quarterly');
    expect(html).toContain('Annual');

    // Legend
    expect(html).toContain('Total Revenues');
    expect(html).toContain('Gross Profit');
    expect(html).toContain('Operating Profit');
    expect(html).toContain('Cash from Operating Activities');
    expect(html).toContain('Free Cash Flow');

    // Legend stats: Total Change and CAGR for Total Revenues
    // 47,516 -> 64,601 = Total Change: +35.96%, CAGR: +27.9%
    expect(html).toContain('Total Change:');
    expect(html).toContain('35.96');
    expect(html).toContain('CAGR:');
    expect(html).toContain('27.9');
  });

  it('renders ScenarioRangeBar when dcfScenarios is provided', () => {
    const payloadWithDcf = {
      ...mockPayload,
      dcfScenarios: {
        bear: 450.0,
        base: 650.0,
        bull: 800.0,
        price: 580.0,
      },
    };
    const html = renderToString(<StockOverview symbol="META" initialData={payloadWithDcf} />);
    expect(html).toContain('Scenario Range');
  });
});
