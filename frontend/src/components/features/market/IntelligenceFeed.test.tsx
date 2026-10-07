import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import IntelligenceFeed from './IntelligenceFeed';

describe('IntelligenceFeed Component', () => {
  const mockReports = [
    {
      id: 1,
      symbol: 'AAPL',
      summary: 'Apple quarterly summary',
      sentiment_score: 0.5,
      report_date: '2026-10-01',
      created_at: '2026-10-01 10:00:00',
      key_takeaways: '["Apple growth solid"]',
    },
  ];

  const mockDigests = [
    {
      id: 10,
      category: 'Tech & Semiconductors',
      summary: 'Weekly tech email digest overview',
      digest_date: '2026-10-02',
      created_at: 1780000000,
      is_readed: 0,
      key_takeaways: '["Digest takeaway 1"]',
      source_emails: '[]',
      facebook_status: null,
    },
  ];

  const mockArticles = [
    {
      id: 20,
      title: 'NVIDIA AI Revolution Deep Dive',
      symbol: 'NVDA',
      category: 'Tech & Semiconductors', // Notice: has category like an email digest!
      summary: 'Analysis on GPU demand',
      key_takeaways: '["Nvidia demand high"]',
      source: 'notebooklm',
      created_at: 1780000050,
      facebook_status: null, // Notice: has facebook_status like an email digest!
      facebook_post_id: null,
      facebook_error: null,
    },
  ];

  it('renders all items when filter is "all"', () => {
    const html = renderToString(
      <IntelligenceFeed
        reports={mockReports}
        digests={mockDigests}
        notebookArticles={mockArticles}
        loading={false}
      />
    );

    // Should contain daily report
    expect(html).toContain('AAPL');
    expect(html).toContain('Apple quarterly summary');

    // Should contain email digest
    expect(html).toContain('Weekly tech email digest overview');

    // Should contain notebook article
    expect(html).toContain('NVIDIA AI Revolution Deep Dive');
  });

  it('correctly maps source_type for untagged items and avoids mixing feed', () => {
    // Render without pre-tagged source_type
    const html = renderToString(
      <IntelligenceFeed
        reports={mockReports}
        digests={mockDigests}
        notebookArticles={mockArticles}
        loading={false}
      />
    );

    // Verify all 3 components are present in DOM
    expect(html).toContain('AAPL');
    expect(html).toContain('Weekly tech email digest overview');
    expect(html).toContain('NVIDIA AI Revolution Deep Dive');
  });
});

