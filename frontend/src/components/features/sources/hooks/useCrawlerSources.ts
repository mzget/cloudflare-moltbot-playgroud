import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../../../../config';

export interface NewsSource {
  id: number;
  name: string;
  url_pattern: string;
  selector: string;
  type: 'RSS' | 'WEB';
  enabled: boolean;
}

export function useCrawlerSources() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sources`);
      if (res.ok) setSources(await res.json());
    } catch (e) {
      console.error('Failed to fetch sources', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSource = async (source: any) => {
    const method = source.id ? 'PUT' : 'POST';
    const res = await fetch(`${API_BASE_URL}/api/sources`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source)
    });
    if (res.ok) {
      await fetchSources();
    }
    return res;
  };

  const deleteSource = async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/api/sources?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchSources();
    }
    return res;
  };

  return {
    sources,
    loading,
    fetchSources,
    saveSource,
    deleteSource
  };
}
