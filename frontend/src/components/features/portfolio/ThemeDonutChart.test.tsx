import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ThemeDonutChart, {
  type ThemeExposureItem,
  type HoldingSizingItem,
} from './ThemeDonutChart';

describe('ThemeDonutChart Component', () => {
  const mockThemes: ThemeExposureItem[] = [
    {
      themeName: 'Enterprise & Cloud Infra',
      marketValueUsd: 30000,
      weightPct: 40.0,
      status: 'breach',
      symbols: ['MSFT', 'SHOP'],
      roomToCapUsd: 0,
      isUnassigned: false,
    },
    {
      themeName: 'Digital Media & Ad Platforms',
      marketValueUsd: 30000,
      weightPct: 40.0,
      status: 'breach',
      symbols: ['META', 'GOOGL'],
      roomToCapUsd: 0,
      isUnassigned: false,
    },
    {
      themeName: 'Fintech & Web3 Infra',
      marketValueUsd: 15000,
      weightPct: 20.0,
      status: 'ok',
      symbols: ['COIN'],
      roomToCapUsd: 7500,
      isUnassigned: false,
    },
  ];

  const mockHoldings: HoldingSizingItem[] = [
    {
      symbol: 'MSFT',
      name: 'Microsoft Corp',
      marketValueUsd: 16000,
      weightPct: 21.3,
      lastPrice: 400,
      shares: 40,
      themes: ['Enterprise & Cloud Infra'],
    },
    {
      symbol: 'SHOP',
      name: 'Shopify Inc',
      marketValueUsd: 14000,
      weightPct: 18.7,
      lastPrice: 70,
      shares: 200,
      themes: ['Enterprise & Cloud Infra'],
    },
    {
      symbol: 'COIN',
      name: 'Coinbase Global',
      marketValueUsd: 15000,
      weightPct: 20.0,
      lastPrice: 150,
      shares: 100,
      themes: ['Fintech & Web3 Infra'],
    },
  ];

  it('renders clean empty state when themeExposures is empty', () => {
    const html = renderToString(
      <ThemeDonutChart
        themeExposures={[]}
        holdings={[]}
        totalPortfolioUsd={0}
      />
    );
    expect(html).toContain('No theme exposures available to visualize.');
  });

  it('renders SVG Donut chart, legend items, and overview totals', () => {
    const html = renderToString(
      <ThemeDonutChart
        themeExposures={mockThemes}
        holdings={mockHoldings}
        totalPortfolioUsd={75000}
        showMoneyValues={true}
      />
    );
    const cleanHtml = html.replace(/<!--.*?-->/g, '');

    // Overview total value and subtitle in SVG hub
    expect(cleanHtml).toContain('Total Value');
    expect(cleanHtml).toContain('3 Themes');

    // Legend items
    expect(cleanHtml).toContain('Enterprise &amp; Cloud Infra (40.0%)');
    expect(cleanHtml).toContain('Digital Media &amp; Ad Platforms (40.0%)');
    expect(cleanHtml).toContain('Fintech &amp; Web3 Infra (20.0%)');

    // SVG elements
    expect(cleanHtml).toContain('<svg');
    expect(cleanHtml).toContain('<path');
  });

  it('uses Joy UI theme CSS variables for slice labels, center text, and legend labels to ensure Light/Dark theme legibility', () => {
    const html = renderToString(
      <ThemeDonutChart
        themeExposures={mockThemes}
        holdings={mockHoldings}
        totalPortfolioUsd={75000}
        showMoneyValues={true}
      />
    );

    expect(html).toContain('fill: var(--joy-palette-text-primary');
    expect(html).toContain('fill: var(--joy-palette-text-secondary');
    expect(html).toContain('color: var(--joy-palette-text-primary');
    expect(html).not.toContain('fill: #ffffff;');
  });

  it('masks values when showMoneyValues is false', () => {
    const html = renderToString(
      <ThemeDonutChart
        themeExposures={mockThemes}
        holdings={mockHoldings}
        totalPortfolioUsd={75000}
        showMoneyValues={false}
      />
    );
    expect(html).toContain('••••••••');
    expect(html).not.toContain('$75,000');
  });

  it('handles Unassigned theme correctly', () => {
    const unassignedThemes: ThemeExposureItem[] = [
      {
        themeName: 'Unassigned',
        marketValueUsd: 10000,
        weightPct: 100.0,
        status: 'ok',
        symbols: ['AAPL'],
        roomToCapUsd: 0,
        isUnassigned: true,
      },
    ];

    const html = renderToString(
      <ThemeDonutChart
        themeExposures={unassignedThemes}
        holdings={[
          {
            symbol: 'AAPL',
            name: 'Apple Inc',
            marketValueUsd: 10000,
            weightPct: 100.0,
          },
        ]}
        totalPortfolioUsd={10000}
      />
    );
    const cleanHtml = html.replace(/<!--.*?-->/g, '');

    expect(cleanHtml).toContain('Unassigned (100.0%)');
    expect(cleanHtml).toContain('1 Theme');
  });
});
