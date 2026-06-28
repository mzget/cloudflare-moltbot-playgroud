import { useCallback } from 'react';
import { API_BASE_URL } from '../../../../config';
import { useQuery } from '../../../../utils/useQuery';
import { useMutation } from '../../../../utils/useMutation';
import { invalidateQueries } from '../../../../utils/invalidateQueries';
import { useQueryCache } from '../../../../store/queryCache';

export interface NewsSource {
  id: number;
  name: string;
  url_pattern: string;
  selector: string;
  type: 'RSS' | 'WEB';
  enabled: boolean;
}

const SOURCES_KEY = 'sources';

export function useCrawlerSources() {

  const { data: sources = [], isLoading: loading, refetch: fetchSources } = useQuery<NewsSource[]>(
    SOURCES_KEY,
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/sources`);
      if (!res.ok) throw new Error('Failed to fetch sources');
      return res.json();
    }
  );

  // --- saveSource (create or update) ---
  const { mutateAsync: saveSource } = useMutation(
    async (source: any) => {
      const method = source.id ? 'PUT' : 'POST';
      const res = await fetch(`${API_BASE_URL}/api/sources`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: (source) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<NewsSource[]>(SOURCES_KEY).data ?? [];
        if (source.id) {
          setEntry(SOURCES_KEY, {
            data: prev.map(s => s.id === source.id ? { ...s, ...source } : s) as unknown[],
          });
        } else {
          setEntry(SOURCES_KEY, {
            data: [...prev, { ...source, id: -Date.now() }] as unknown[],
          });
        }
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(SOURCES_KEY, { data: snapshot as unknown[] });
      },
      onSuccess: () => invalidateQueries(SOURCES_KEY),
    }
  );

  // --- deleteSource ---
  const { mutateAsync: _deleteSource } = useMutation(
    async (id: number) => {
      const res = await fetch(`${API_BASE_URL}/api/sources?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: (id) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<NewsSource[]>(SOURCES_KEY).data ?? [];
        setEntry(SOURCES_KEY, { data: prev.filter(s => s.id !== id) as unknown[] });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(SOURCES_KEY, { data: snapshot as unknown[] });
      },
      onSuccess: () => invalidateQueries(SOURCES_KEY),
    }
  );

  const deleteSource = useCallback((id: number) => {
    return _deleteSource(id);
  }, [_deleteSource]);

  return {
    sources,
    loading,
    fetchSources,
    saveSource,
    deleteSource,
  };
}
