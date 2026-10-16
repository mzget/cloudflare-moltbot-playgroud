import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import FacebookQueueTab, { FacebookIcon } from './FacebookQueueTab';

describe('FacebookQueueTab Component', () => {
  it('renders auto-posting toggles, custom posts section, and create button', () => {
    const html = renderToString(<FacebookQueueTab active={false} />);

    // Facebook Auto-Posting Controls
    expect(html).toContain('Facebook Auto-Posting Controls');
    expect(html).toContain('Pause Daily Reports Posting');
    expect(html).toContain('Pause Email Digests Posting');
    expect(html).toContain('Pause Articles &amp; Analyses');
    expect(html).toContain('Pause Custom Posts Posting');

    // Standalone posts
    expect(html).toContain('Custom Standalone Posts');
    expect(html).toContain('Create Custom Post');
    expect(html).toContain('No custom posts configured.');
  });

  it('renders FacebookIcon svg with valid path', () => {
    const html = renderToString(<FacebookIcon size={16} />);
    expect(html).toContain('<svg');
    expect(html).toContain('width="16"');
    expect(html).toContain('M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z');
  });

  it('applies density styles properly', () => {
    const compactHtml = renderToString(<FacebookQueueTab density="compact" active={false} />);
    expect(compactHtml).toMatch(/--TableCell-paddingX:\s*8px/);
    expect(compactHtml).toMatch(/--TableCell-paddingY:\s*5px/);

    const comfortHtml = renderToString(<FacebookQueueTab density="comfort" active={false} />);
    expect(comfortHtml).toMatch(/--TableCell-paddingX:\s*18px/);
    expect(comfortHtml).toMatch(/--TableCell-paddingY:\s*14px/);
  });
});
