import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import WebCrawlerTab from './WebCrawlerTab';
import * as crawlerHook from './hooks/useCrawlerSources';

vi.mock('./hooks/useCrawlerSources', () => ({
  useCrawlerSources: vi.fn(),
}));

describe('WebCrawlerTab Component', () => {
  const mockSources: crawlerHook.NewsSource[] = [
    {
      id: 1,
      name: 'Google News AI & Tech',
      url_pattern: 'https://news.google.com/rss/search?q={symbol}+AI',
      selector: '',
      type: 'RSS',
      enabled: true,
    },
    {
      id: 2,
      name: 'Yahoo Finance Scraper',
      url_pattern: 'https://finance.yahoo.com/quote/{symbol}/news',
      selector: 'section a',
      type: 'WEB',
      enabled: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(crawlerHook.useCrawlerSources).mockReturnValue({
      sources: mockSources,
      loading: false,
      fetchSources: vi.fn(),
      saveSource: vi.fn(),
      deleteSource: vi.fn(),
    });
  });

  it('renders crawler controls, action headers, and sources table', () => {
    const html = renderToString(<WebCrawlerTab />);

    // Header controls
    expect(html).toContain('Crawler &amp; Report Controls');
    expect(html).toContain('Active Web Targets');
    expect(html).toContain('Add Source');

    // Sources rows
    expect(html).toContain('Google News AI &amp; Tech');
    expect(html).toContain('https://news.google.com/rss/search?q={symbol}+AI');
    expect(html).toContain('RSS');
    expect(html).toContain('Enabled');

    expect(html).toContain('Yahoo Finance Scraper');
    expect(html).toContain('https://finance.yahoo.com/quote/{symbol}/news');
    expect(html).toContain('WEB');
    expect(html).toContain('Disabled');
  });

  it('renders loading state when loading is true', () => {
    vi.mocked(crawlerHook.useCrawlerSources).mockReturnValue({
      sources: [],
      loading: true,
      fetchSources: vi.fn(),
      saveSource: vi.fn(),
      deleteSource: vi.fn(),
    });

    const html = renderToString(<WebCrawlerTab />);
    expect(html).toContain('Loading crawler sources...');
  });

  it('renders empty state when sources array is empty', () => {
    vi.mocked(crawlerHook.useCrawlerSources).mockReturnValue({
      sources: [],
      loading: false,
      fetchSources: vi.fn(),
      saveSource: vi.fn(),
      deleteSource: vi.fn(),
    });

    const html = renderToString(<WebCrawlerTab />);
    expect(html).toContain('No sources configured.');
  });

  it('applies density styles properly', () => {
    const compactHtml = renderToString(<WebCrawlerTab density="compact" />);
    expect(compactHtml).toMatch(/--TableCell-paddingX:\s*8px/);
    expect(compactHtml).toMatch(/--TableCell-paddingY:\s*5px/);

    const comfortHtml = renderToString(<WebCrawlerTab density="comfort" />);
    expect(comfortHtml).toMatch(/--TableCell-paddingX:\s*18px/);
    expect(comfortHtml).toMatch(/--TableCell-paddingY:\s*14px/);
  });
});
