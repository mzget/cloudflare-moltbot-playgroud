import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import SourceManager, { FacebookIcon } from './SourceManager';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('./hooks/useCrawlerSources', () => ({
  useCrawlerSources: () => ({
    sources: [],
    loading: false,
    fetchSources: vi.fn(),
    saveSource: vi.fn(),
    deleteSource: vi.fn(),
  }),
}));

vi.mock('./hooks/useGmailSubscriptions', () => ({
  useGmailSubscriptions: () => ({
    gmailConnected: false,
    checkingGmail: false,
    subscriptions: [],
    loadingSubs: false,
    actionsLoading: { syncing: false, testing: false },
    checkGmailStatus: vi.fn(),
    fetchSubscriptions: vi.fn(),
    connectGmail: vi.fn(),
    disconnectGmail: vi.fn(),
    saveSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    syncEmails: vi.fn(),
    testDigest: vi.fn(),
  }),
}));

describe('SourceManager Component', () => {
  it('renders all 4 tabs in tablist', () => {
    const html = renderToString(<SourceManager initialTab={0} />);

    expect(html).toContain('Command Center');
    expect(html).toContain('Web &amp; RSS Crawler');
    expect(html).toContain('Gmail Newsletters');
    expect(html).toContain('Facebook Page');
    expect(html).toContain('Fundamental Intelligence');
  });

  it('renders WebCrawlerTab at initialTab={0}', () => {
    const html = renderToString(<SourceManager initialTab={0} />);
    expect(html).toContain('Active Web Targets');
    expect(html).toContain('Crawler &amp; Report Controls');
  });

  it('renders GmailNewslettersTab at initialTab={1}', () => {
    const html = renderToString(<SourceManager initialTab={1} />);
    expect(html).toContain('Gmail API Connection');
    expect(html).toContain('Newsletter Rules');
  });

  it('renders FacebookQueueTab at initialTab={2}', () => {
    const html = renderToString(<SourceManager initialTab={2} />);
    expect(html).toContain('Facebook Auto-Posting Controls');
    expect(html).toContain('Custom Standalone Posts');
  });

  it('renders FundamentalIntelligenceTab at initialTab={3}', () => {
    const html = renderToString(<SourceManager initialTab={3} />);
    expect(html).toContain('Fundamental Intelligence');
    expect(html).toContain('Track qualitative research freshness');
    expect(html).toContain('Total Tickers');
  });

  it('exports FacebookIcon correctly', () => {
    expect(FacebookIcon).toBeDefined();
  });
});
