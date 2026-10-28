import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WatchlistCard } from './WatchlistCard';
import type { WatchlistItem } from './hooks/useWatchlist';
import type { FundamentalStatusItem } from '../sources/FundamentalIntelligenceTab';

describe('WatchlistCard Component', () => {
  const mockItem: WatchlistItem = {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    is_active: 1,
    in_portfolio: 1,
    type: 'stock',
    active_alerts_count: 2,
    sector_label: 'Semiconductors',
    sector_label_color: '#10b981',
  };

  const mockFundamental: FundamentalStatusItem = {
    symbol: 'NVDA',
    company_name: 'NVIDIA Corporation',
    as_of_date: '2026-08-15',
    status: 'active',
    source_count: 4,
    theme_tags: ['AI Infrastructure', 'Data Center'],
    updated_at: '2026-08-16T10:00:00Z',
  };

  it('renders symbol, badges, fundamental status, and copy prompt button', () => {
    const html = renderToString(
      <WatchlistCard
        item={mockItem}
        fundamental={mockFundamental}
        onEdit={vi.fn()}
        onAlertsClick={vi.fn()}
        onViewAnalysis={vi.fn()}
        onCopyPrompt={vi.fn()}
        onToggleActive={vi.fn()}
        onTogglePortfolio={vi.fn()}
      />
    );

    // Basic & Header Info
    expect(html).toContain('NVDA');
    expect(html).toContain('Semiconductors');

    // Fundamental Intelligence Section
    expect(html).toContain('Active');
    expect(html).toContain('2026-08-15');
    expect(html).toContain('4 srcs');
    expect(html).toContain('AI Infrastructure');
    expect(html).toContain('Data Center');

    // Action Buttons
    expect(html).toContain('Analysis');
    expect(html).toContain('Copy Prompt');
  });

  it('renders clean fallback state when fundamental data is missing', () => {
    const html = renderToString(
      <WatchlistCard
        item={mockItem}
        fundamental={null}
        onEdit={vi.fn()}
        onAlertsClick={vi.fn()}
        onViewAnalysis={vi.fn()}
        onCopyPrompt={vi.fn()}
        onToggleActive={vi.fn()}
        onTogglePortfolio={vi.fn()}
      />
    );

    expect(html).toContain('NVDA');
    expect(html).toContain('Missing');
    expect(html).toContain('No linked research themes');
    expect(html).toContain('Copy Prompt');
  });

  it('renders Margin of Safety section and formatted MoS chip', () => {
    const itemWithMos: WatchlistItem = {
      ...mockItem,
      mos_base: 25.5,
      mos_price: 100,
      dcf_bear: 80,
      dcf_base: 134.2,
      dcf_bull: 160,
    };

    const html = renderToString(
      <WatchlistCard
        item={itemWithMos}
        fundamental={null}
        onEdit={vi.fn()}
        onAlertsClick={vi.fn()}
        onViewAnalysis={vi.fn()}
        onCopyPrompt={vi.fn()}
        onToggleActive={vi.fn()}
        onTogglePortfolio={vi.fn()}
      />
    );

    expect(html).toContain('Margin of Safety');
    expect(html).toContain('+25.5%');
  });
  it('hides Margin of Safety section when hideMos is true', () => {
    const itemWithMos: WatchlistItem = {
      ...mockItem,
      mos_base: 25.5,
      mos_price: 100,
      dcf_bear: 80,
      dcf_base: 134.2,
      dcf_bull: 160,
    };

    const html = renderToString(
      <WatchlistCard
        item={itemWithMos}
        fundamental={null}
        hideMos={true}
      />
    );

    expect(html).not.toContain('Margin of Safety');
    expect(html).not.toContain('data-testid="mos-section"');
  });

  it('hides Copy Prompt button when hideCopyPrompt is true or onCopyPrompt is omitted', () => {
    const htmlWithHideProp = renderToString(
      <WatchlistCard
        item={mockItem}
        fundamental={null}
        onCopyPrompt={vi.fn()}
        hideCopyPrompt={true}
      />
    );
    expect(htmlWithHideProp).not.toContain('Copy Prompt');

    const htmlWithoutCallback = renderToString(
      <WatchlistCard
        item={mockItem}
        fundamental={null}
      />
    );
    expect(htmlWithoutCallback).not.toContain('Copy Prompt');
  });
});
