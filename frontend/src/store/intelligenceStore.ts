import { create } from 'zustand';
import { API_BASE_URL } from '../config';

export interface EmailSource {
  id: string;
  subject: string;
  sender: string;
  received_at?: number | string;
}

export interface EmailDigest {
  id: number;
  category: string;
  summary: string;
  key_takeaways: string; // JSON string of array
  source_emails: string; // JSON string of array of EmailSource
  digest_date: string;
  created_at: number; // timestamp
  is_readed?: number;
  facebook_status?: 'pending' | 'processing' | 'posted' | 'failed' | null;
  facebook_post_id?: string | null;
  facebook_error?: string | null;
}

interface IntelligenceStore {
  reports: any[];
  digests: EmailDigest[];
  notebookArticles: any[];
  loading: boolean;
  initialized: boolean;
  fetchReports: () => Promise<void>;
  onDigestRead: (id: number) => Promise<void>;
  onDigestQueueFacebook: (id: number) => Promise<void>;
  onArticleQueueFacebook: (id: number) => Promise<void>;
  onArticlePublishNow: (id: number) => Promise<{ success: boolean; error?: string }>;
  onReportRead: (id: number) => Promise<void>;
}

export const useIntelligenceStore = create<IntelligenceStore>((set, get) => ({
  reports: [],
  digests: [],
  notebookArticles: [],
  loading: false,
  initialized: false,

  fetchReports: async () => {
    if (!get().initialized) {
      set({ loading: true });
    }
    try {
      const [reportsRes, digestsRes, articlesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/reports`),
        fetch(`${API_BASE_URL}/api/email-digests`),
        fetch(`${API_BASE_URL}/api/notebook-articles`),
      ]);

      const reports = reportsRes.ok ? (await reportsRes.json()) as any[] : [];
      const digests = digestsRes.ok ? (await digestsRes.json()) as EmailDigest[] : [];
      const notebookArticles = articlesRes.ok ? (await articlesRes.json()) as any[] : [];

      set({ reports, digests, notebookArticles, loading: false, initialized: true });
    } catch (e) {
      console.error("Failed to fetch reports, digests or articles", e);
      set({ loading: false, initialized: true });
    }
  },

  onDigestRead: async (id: number) => {
    // Optimistic UI update: remove digest immediately
    set(state => ({
      digests: state.digests.filter(d => d.id !== id)
    }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-digests/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
    } catch (e) {
      console.error("Failed to mark digest as read:", e);
      await get().fetchReports();
    }
  },

  onDigestQueueFacebook: async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/facebook/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: 'email_digest', source_id: id })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      set(state => ({
        digests: state.digests.map(d => d.id === id ? { ...d, facebook_status: 'pending' } : d)
      }));
      await get().fetchReports();
    } catch (e) {
      console.error("Failed to queue Facebook post:", e);
      await get().fetchReports();
    }
  },

  onArticleQueueFacebook: async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/facebook/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: 'notebook_article', source_id: id })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      set(state => ({
        notebookArticles: state.notebookArticles.map(a => a.id === id ? { ...a, facebook_status: 'pending' } : a)
      }));
      await get().fetchReports();
    } catch (e) {
      console.error("Failed to queue Facebook post for article:", e);
      await get().fetchReports();
    }
  },

  onArticlePublishNow: async (id: number) => {
    try {
      set(state => ({
        notebookArticles: state.notebookArticles.map(a => a.id === id ? { ...a, facebook_status: 'processing' } : a)
      }));
      const res = await fetch(`${API_BASE_URL}/api/facebook/publish-article-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: id })
      });
      const data = (await res.json()) as any;
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to publish to Facebook');
      }
      set(state => ({
        notebookArticles: state.notebookArticles.map(a => a.id === id ? { ...a, facebook_status: 'posted', facebook_post_id: data.facebookPostId } : a)
      }));
      await get().fetchReports();
      return { success: true };
    } catch (e: any) {
      console.error("Failed to publish article now:", e);
      set(state => ({
        notebookArticles: state.notebookArticles.map(a => a.id === id ? { ...a, facebook_status: 'failed', facebook_error: e.message } : a)
      }));
      await get().fetchReports();
      return { success: false, error: e.message };
    }
  },

  onReportRead: async (id: number) => {
    set(state => ({
      reports: state.reports.map(r => r.id === id ? { ...r, is_readed: 1 } : r)
    }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
    } catch (e) {
      console.error("Failed to mark report as read:", e);
      await get().fetchReports();
    }
  }
}));