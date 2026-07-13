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
  fetchReports: () => Promise<void>;
  onDigestRead: (id: number) => Promise<void>;
  onDigestQueueFacebook: (id: number) => Promise<void>;
  onReportRead: (id: number) => Promise<void>;
}

export const useIntelligenceStore = create<IntelligenceStore>((set, get) => ({
  reports: [],
  digests: [],
  notebookArticles: [],
  loading: false,

  fetchReports: async () => {
    set({ loading: true });
    try {
      const [reportsRes, digestsRes, articlesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/reports`),
        fetch(`${API_BASE_URL}/api/email-digests`),
        fetch(`${API_BASE_URL}/api/notebook-articles`),
      ]);

      const reports = reportsRes.ok ? (await reportsRes.json()) as any[] : [];
      const digests = digestsRes.ok ? (await digestsRes.json()) as EmailDigest[] : [];
      const notebookArticles = articlesRes.ok ? (await articlesRes.json()) as any[] : [];

      set({ reports, digests, notebookArticles, loading: false });
    } catch (e) {
      console.error("Failed to fetch reports, digests or articles", e);
      set({ loading: false });
    }
  },

  onDigestRead: async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-digests/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      set(state => ({
        digests: state.digests.filter(d => d.id !== id)
      }));
      await get().fetchReports();
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