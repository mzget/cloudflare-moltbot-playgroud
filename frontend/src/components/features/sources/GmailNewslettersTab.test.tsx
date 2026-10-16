import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import GmailNewslettersTab from './GmailNewslettersTab';
import * as gmailHook from './hooks/useGmailSubscriptions';

vi.mock('./hooks/useGmailSubscriptions', () => ({
  useGmailSubscriptions: vi.fn(),
}));

describe('GmailNewslettersTab Component', () => {
  const mockSubscriptions: gmailHook.EmailSubscription[] = [
    {
      id: 1,
      name: 'Morning Brew',
      sender: 'crew@morningbrew.com',
      frequency: 'daily',
      is_active: true,
    },
    {
      id: 2,
      name: 'Howard Marks Memos',
      raw_query: 'from:memo@oaktree.com',
      frequency: 'weekly',
      is_active: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gmailHook.useGmailSubscriptions).mockReturnValue({
      gmailConnected: true,
      checkingGmail: false,
      subscriptions: mockSubscriptions,
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
    });
  });

  it('renders connected Gmail panel, action buttons, and newsletter rules table', () => {
    const html = renderToString(<GmailNewslettersTab />);

    // Connection panel
    expect(html).toContain('Gmail API Connection');
    expect(html).toContain('Connected to your Gmail account');
    expect(html).toContain('Sync Now');
    expect(html).toContain('Test Digest');
    expect(html).toContain('Disconnect');

    // Rules table
    expect(html).toContain('Newsletter Rules');
    expect(html).toContain('Add Newsletter Rule');
    expect(html).toContain('Morning Brew');
    expect(html).toContain('Howard Marks Memos');
    expect(html).toContain('Active');
    expect(html).toContain('Inactive');
  });

  it('renders disconnected state when gmailConnected is false', () => {
    vi.mocked(gmailHook.useGmailSubscriptions).mockReturnValue({
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
    });

    const html = renderToString(<GmailNewslettersTab />);
    expect(html).toContain('Connect your Gmail account');
    expect(html).toContain('Connect Gmail');
    expect(html).not.toContain('Sync Now');
  });

  it('renders empty subscriptions state cleanly', () => {
    vi.mocked(gmailHook.useGmailSubscriptions).mockReturnValue({
      gmailConnected: true,
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
    });

    const html = renderToString(<GmailNewslettersTab />);
    expect(html).toContain('No newsletter subscription rules configured yet.');
  });

  it('applies density styles properly', () => {
    const compactHtml = renderToString(<GmailNewslettersTab density="compact" />);
    expect(compactHtml).toMatch(/--TableCell-paddingX:\s*8px/);
    expect(compactHtml).toMatch(/--TableCell-paddingY:\s*5px/);

    const comfortHtml = renderToString(<GmailNewslettersTab density="comfort" />);
    expect(comfortHtml).toMatch(/--TableCell-paddingX:\s*18px/);
    expect(comfortHtml).toMatch(/--TableCell-paddingY:\s*14px/);
  });
});
