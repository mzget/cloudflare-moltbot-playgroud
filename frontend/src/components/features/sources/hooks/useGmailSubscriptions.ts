import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../../../../config';
import { useQuery } from '../../../../utils/useQuery';
import { useMutation } from '../../../../utils/useMutation';
import { invalidateQueries } from '../../../../utils/invalidateQueries';
import { useQueryCache } from '../../../../store/queryCache';

export interface EmailSubscription {
  id?: number;
  name: string;
  sender?: string;
  subject_filter?: string;
  label_filter?: string;
  raw_query?: string;
  frequency: 'hourly' | 'daily' | 'weekly';
  is_active: boolean | number;
}

const SUBS_KEY = 'subscriptions';
const GMAIL_STATUS_KEY = 'gmail-status';

export function useGmailSubscriptions() {

  // Gmail connection status — not mutated locally, so plain useQuery is fine.
  const { data: gmailStatus, isLoading: checkingGmail } = useQuery<{ connected: boolean }>(
    GMAIL_STATUS_KEY,
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/auth/google/status`);
      if (!res.ok) throw new Error('Failed to check Gmail status');
      return res.json();
    }
  );

  const gmailConnected = gmailStatus?.connected ?? false;

  const { data: subscriptions = [], isLoading: loadingSubs, refetch: fetchSubscriptions } = useQuery<EmailSubscription[]>(
    SUBS_KEY,
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/subscriptions`);
      if (!res.ok) throw new Error('Failed to fetch subscriptions');
      return res.json();
    }
  );

  // Action loading state (fire-and-forget actions, not part of query cache).
  const [actionsLoading, setActionsLoading] = useState({ syncing: false, testing: false });


  // --- saveSubscription ---
  const { mutateAsync: saveSubscription } = useMutation(
    async (sub: any) => {
      const method = sub.id ? 'PUT' : 'POST';
      const res = await fetch(`${API_BASE_URL}/api/subscriptions`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: (sub) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<EmailSubscription[]>(SUBS_KEY).data ?? [];
        if (sub.id) {
          setEntry(SUBS_KEY, {
            data: prev.map(s => s.id === sub.id ? { ...s, ...sub } : s) as unknown[],
          });
        } else {
          setEntry(SUBS_KEY, {
            data: [...prev, { ...sub, id: -Date.now() }] as unknown[],
          });
        }
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(SUBS_KEY, { data: snapshot as unknown[] });
      },
      onSuccess: () => invalidateQueries(SUBS_KEY),
    }
  );

  // --- deleteSubscription ---
  const { mutateAsync: _deleteSubscription } = useMutation(
    async (id: number) => {
      const res = await fetch(`${API_BASE_URL}/api/subscriptions?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: (id) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<EmailSubscription[]>(SUBS_KEY).data ?? [];
        setEntry(SUBS_KEY, { data: prev.filter(s => s.id !== id) as unknown[] });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(SUBS_KEY, { data: snapshot as unknown[] });
      },
      onSuccess: () => invalidateQueries(SUBS_KEY),
    }
  );

  const checkGmailStatus = useCallback(() => {
    invalidateQueries(GMAIL_STATUS_KEY);
  }, []);

  const connectGmail = useCallback(async () => {
    const redirectUri = window.location.origin + '/';
    const res = await fetch(
      `${API_BASE_URL}/api/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`
    );
    if (res.ok) {
      const data = await res.json();
      window.location.href = data.url;
    }
  }, []);

  const disconnectGmail = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/auth/google/disconnect`, { method: 'DELETE' });
    if (res.ok) {
      // Optimistically mark as disconnected in the cache.
      useQueryCache.getState().setEntry(GMAIL_STATUS_KEY, { data: { connected: false } as unknown });
    }
    return res;
  }, []);

  const deleteSubscription = useCallback((id: number) => {
    return _deleteSubscription(id);
  }, [_deleteSubscription]);

  const syncEmails = useCallback(async () => {
    setActionsLoading(prev => ({ ...prev, syncing: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-sync`, { method: 'POST' });
      return res;
    } finally {
      setActionsLoading(prev => ({ ...prev, syncing: false }));
    }
  }, []);

  const testDigest = useCallback(async () => {
    setActionsLoading(prev => ({ ...prev, testing: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/test-email-digest`);
      return res;
    } finally {
      setActionsLoading(prev => ({ ...prev, testing: false }));
    }
  }, []);

  return {
    gmailConnected,
    checkingGmail,
    subscriptions,
    loadingSubs,
    actionsLoading,
    checkGmailStatus,
    fetchSubscriptions,
    connectGmail,
    disconnectGmail,
    saveSubscription,
    deleteSubscription,
    syncEmails,
    testDigest,
  };
}
