import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../../../../config';

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

export function useGmailSubscriptions() {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [checkingGmail, setCheckingGmail] = useState(true);
  const [subscriptions, setSubscriptions] = useState<EmailSubscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  
  // Group actions loading state
  const [actionsLoading, setActionsLoading] = useState({ syncing: false, testing: false });

  const checkGmailStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google/status`);
      if (res.ok) {
        const data = await res.json();
        setGmailConnected(data.connected);
      }
    } catch (e) {
      console.error('Failed to check Gmail status', e);
    } finally {
      setCheckingGmail(false);
    }
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/subscriptions`);
      if (res.ok) setSubscriptions(await res.json());
    } catch (e) {
      console.error('Failed to fetch subscriptions', e);
    } finally {
      setLoadingSubs(false);
    }
  }, []);

  const connectGmail = async () => {
    const redirectUri = window.location.origin + '/';
    const res = await fetch(
      `${API_BASE_URL}/api/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`
    );
    if (res.ok) {
      const data = await res.json();
      window.location.href = data.url;
    }
  };

  const disconnectGmail = async () => {
    const res = await fetch(`${API_BASE_URL}/api/auth/google/disconnect`, { method: 'DELETE' });
    if (res.ok) {
      setGmailConnected(false);
    }
    return res;
  };

  const saveSubscription = async (sub: any) => {
    const method = sub.id ? 'PUT' : 'POST';
    const res = await fetch(`${API_BASE_URL}/api/subscriptions`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
    if (res.ok) {
      await fetchSubscriptions();
    }
    return res;
  };

  const deleteSubscription = async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/api/subscriptions?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchSubscriptions();
    }
    return res;
  };

  const syncEmails = async () => {
    setActionsLoading(prev => ({ ...prev, syncing: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-sync`, { method: 'POST' });
      return res;
    } finally {
      setActionsLoading(prev => ({ ...prev, syncing: false }));
    }
  };

  const testDigest = async () => {
    setActionsLoading(prev => ({ ...prev, testing: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/test-email-digest`);
      return res;
    } finally {
      setActionsLoading(prev => ({ ...prev, testing: false }));
    }
  };

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
    testDigest
  };
}
