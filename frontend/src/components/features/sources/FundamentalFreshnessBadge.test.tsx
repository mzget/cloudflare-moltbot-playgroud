import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FundamentalFreshnessBadge } from './FundamentalFreshnessBadge';

describe('FundamentalFreshnessBadge Component', () => {
  it('renders Active badge for "active" status in verbose format', () => {
    const html = renderToString(
      <FundamentalFreshnessBadge status="active" asOfDate="2026-07-29" format="verbose" />
    );
    expect(html).toContain('🟢 Active (&lt;90d)');
    expect(html).toContain('data-status="active"');
    expect(html).toContain('2026-07-29');
  });

  it('renders Active badge for "active" status in short format', () => {
    const html = renderToString(
      <FundamentalFreshnessBadge status="active" asOfDate="2026-07-29" format="short" />
    );
    expect(html).toContain('🟢 Active');
    expect(html).not.toContain('&lt;90d');
  });

  it('renders Stale badge for "stale" status in verbose format', () => {
    const html = renderToString(
      <FundamentalFreshnessBadge status="stale" asOfDate="2026-04-15" format="verbose" />
    );
    expect(html).toContain('🟡 Stale (≥90d)');
    expect(html).toContain('data-status="stale"');
    expect(html).toContain('2026-04-15');
  });

  it('renders Stale badge for "stale" status in short format', () => {
    const html = renderToString(
      <FundamentalFreshnessBadge status="stale" asOfDate="2026-04-15" format="short" />
    );
    expect(html).toContain('🟡 Stale');
    expect(html).not.toContain('≥90d');
  });

  it('renders Missing badge for "missing" status', () => {
    const html = renderToString(
      <FundamentalFreshnessBadge status="missing" />
    );
    expect(html).toContain('🔴 Missing');
    expect(html).toContain('data-status="missing"');
  });

  it('handles unknown or unexpected status by falling back to missing', () => {
    const html = renderToString(
      <FundamentalFreshnessBadge status="unknown_status" />
    );
    expect(html).toContain('🔴 Missing');
    expect(html).toContain('data-status="unknown_status"');
  });

  it('includes filing timestamp in title attribute when asOfDate is provided', () => {
    const html = renderToString(
      <FundamentalFreshnessBadge status="active" asOfDate="2026-07-29" />
    );
    expect(html).toContain('title="Active: Filing updated within 90 days (As-of: 2026-07-29)"');
  });
});
