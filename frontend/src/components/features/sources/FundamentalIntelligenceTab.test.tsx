import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FundamentalIntelligenceTab, type FundamentalStatusItem } from './FundamentalIntelligenceTab';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

describe('FundamentalIntelligenceTab Component', () => {
  const mockItems: FundamentalStatusItem[] = [
    {
      symbol: 'ARM',
      company_name: 'Arm Holdings plc',
      as_of_date: '2026-07-29',
      status: 'active',
      source_count: 3,
      theme_tags: ['SemiAnalysis AI & Compute Dynamics'],
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
      company_name: 'Taiwan Semiconductor',
      as_of_date: null,
      status: 'missing',
      source_count: 0,
      theme_tags: [],
      updated_at: null,
    },
  ];

  it('renders tab header, summary cards, and table with mock items', () => {
    const html = renderToString(
      <FundamentalIntelligenceTab initialItems={mockItems} autoFetch={false} />
    );

    // Title and description
    expect(html).toContain('Fundamental Intelligence');
    expect(html).toContain('Track qualitative research freshness');

    // Summary cards
    expect(html).toContain('Total Tickers');
    expect(html).toContain('Active (&lt;90d)');
    expect(html).toContain('Stale (≥90d)');
    expect(html).toContain('Missing');

    // Counts in summary cards
    expect(html).toContain('3'); // Total count
    expect(html).toContain('1'); // Active, stale, missing each have 1

    // Filter controls
    expect(html).toContain('Search by symbol, company, or theme...');
    expect(html).toContain('All (3)');
    expect(html).toContain('Active (1)');
    expect(html).toContain('Stale (1)');
    expect(html).toContain('Missing (1)');

    // Table headers
    expect(html).toContain('Symbol');
    expect(html).toContain('Company Name');
    expect(html).toContain('As-Of Date');
    expect(html).toContain('Freshness');
    expect(html).toContain('Sources');
    expect(html).toContain('Linked Themes');
    expect(html).toContain('Actions');

    // Row contents
    expect(html).toContain('ARM');
    expect(html).toContain('Arm Holdings plc');
    expect(html).toContain('2026-07-29');
    expect(html).toContain('SemiAnalysis AI &amp; Compute Dynamics');

    expect(html).toContain('INTC');
    expect(html).toContain('Intel Corporation');
    expect(html).toContain('2026-04-01');
    expect(html).toContain('Foundry Ecosystem');

    expect(html).toContain('TSM');
    expect(html).toContain('Taiwan Semiconductor');

    // Action buttons
    expect(html).toContain('Copy Prompt');
    expect(html).not.toContain('>Analysis<');

    // Symbol analysis links
    expect(html).toContain('/analysis?symbol=ARM&amp;tab=report');
    expect(html).toContain('/analysis?symbol=INTC&amp;tab=report');
    expect(html).toContain('/analysis?symbol=TSM&amp;tab=report');
  });

  it('renders clean empty state when no items exist', () => {
    const html = renderToString(
      <FundamentalIntelligenceTab initialItems={[]} autoFetch={false} />
    );

    expect(html).toContain('Total Tickers');
    expect(html).toContain('0');
    expect(html).toContain('No stocks found in watchlist.');
  });

  it('applies density mode padding styles properly', () => {
    const compactHtml = renderToString(
      <FundamentalIntelligenceTab initialItems={mockItems} autoFetch={false} density="compact" />
    );
    expect(compactHtml).toMatch(/--TableCell-paddingX:\s*8px/);
    expect(compactHtml).toMatch(/--TableCell-paddingY:\s*5px/);

    const comfortHtml = renderToString(
      <FundamentalIntelligenceTab initialItems={mockItems} autoFetch={false} density="comfort" />
    );
    expect(comfortHtml).toMatch(/--TableCell-paddingX:\s*18px/);
    expect(comfortHtml).toMatch(/--TableCell-paddingY:\s*14px/);
  });
});
