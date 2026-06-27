import { API_BASE_URL } from '../../../../config';
import { useQuery } from '../../../../utils/useQuery';
import { useMutation } from '../../../../utils/useMutation';
import { invalidateQueries } from '../../../../utils/invalidateQueries';
import { useQueryCache } from '../../../../store/queryCache';

export function useAlertRules(onAlertRulesChanged?: () => void) {

  // symbolRules are loaded on-demand (enabled=false initially; callers call refetch).
  // We expose fetchRulesForSymbol which sets the active key and triggers a load.
  // To keep the same external API we use a simple approach: store the current symbol
  // in a ref-like query key and expose a manual refetch.
  const [activeSymbol, setActiveSymbol] = useActiveSymbol();

  const alertsKey = activeSymbol ? `alerts:${activeSymbol}` : null;

  const { data: symbolRules = [], refetch: _refetch } = useQuery<any[]>(
    alertsKey ?? '__alerts_disabled__',
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/alerts?symbol=${activeSymbol}`);
      if (!res.ok) throw new Error('Failed to fetch alert rules');
      return res.json();
    },
    { enabled: !!alertsKey }
  );

  const fetchRulesForSymbol = async (symbol: string) => {
    setActiveSymbol(symbol);
    // If the symbol changed the query will auto-fetch; if same symbol force-refetch.
    if (symbol === activeSymbol) await _refetch();
  };

  // --- createRule ---
  const { mutateAsync: createRule } = useMutation(
    async ({ symbol, metric, condition, targetValue }: { symbol: string; metric: string; condition: string; targetValue: number }) => {
      const res = await fetch(`${API_BASE_URL}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, metric, condition_type: condition, target_value: targetValue }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ symbol, metric, condition, targetValue }) => {
        const key = `alerts:${symbol}`;
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<any[]>(key).data ?? [];
        setEntry(key, {
          data: [...prev, { symbol, metric, condition_type: condition, target_value: targetValue, is_active: 1 }] as unknown[],
        });
        return prev;
      },
      onError: (_err, vars, snapshot) => {
        useQueryCache.getState().setEntry(`alerts:${vars.symbol}`, { data: snapshot as unknown[] });
      },
      onSuccess: (_data, vars) => {
        invalidateQueries(`alerts:${vars.symbol}`);
        onAlertRulesChanged?.();
      },
    }
  );

  // --- toggleRule ---
  const { mutateAsync: _toggleRule } = useMutation(
    async ({ ruleId, currentStatus }: { symbol: string; ruleId: number; currentStatus: number }) => {
      const res = await fetch(`${API_BASE_URL}/api/alerts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId, is_active: currentStatus === 1 ? 0 : 1 }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ symbol, ruleId, currentStatus }) => {
        const key = `alerts:${symbol}`;
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<any[]>(key).data ?? [];
        setEntry(key, {
          data: prev.map(r => r.id === ruleId ? { ...r, is_active: currentStatus === 1 ? 0 : 1 } : r) as unknown[],
        });
        return prev;
      },
      onError: (_err, vars, snapshot) => {
        useQueryCache.getState().setEntry(`alerts:${vars.symbol}`, { data: snapshot as unknown[] });
      },
      onSuccess: (_data, vars) => {
        invalidateQueries(`alerts:${vars.symbol}`);
        onAlertRulesChanged?.();
      },
    }
  );

  // --- deleteRule ---
  const { mutateAsync: _deleteRule } = useMutation(
    async ({ ruleId }: { symbol: string; ruleId: number }) => {
      const res = await fetch(`${API_BASE_URL}/api/alerts?id=${ruleId}`, { method: 'DELETE' });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ symbol, ruleId }) => {
        const key = `alerts:${symbol}`;
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<any[]>(key).data ?? [];
        setEntry(key, { data: prev.filter(r => r.id !== ruleId) as unknown[] });
        return prev;
      },
      onError: (_err, vars, snapshot) => {
        useQueryCache.getState().setEntry(`alerts:${vars.symbol}`, { data: snapshot as unknown[] });
      },
      onSuccess: (_data, vars) => {
        invalidateQueries(`alerts:${vars.symbol}`);
        onAlertRulesChanged?.();
      },
    }
  );

  const createRuleFn = useCallback((symbol: string, metric: string, condition: string, targetValue: number) => {
    return createRule({ symbol, metric, condition, targetValue });
  }, [createRule]);

  const toggleRuleFn = useCallback((symbol: string, ruleId: number, currentStatus: number) => {
    return _toggleRule({ symbol, ruleId, currentStatus });
  }, [_toggleRule]);

  const deleteRuleFn = useCallback((symbol: string, ruleId: number) => {
    return _deleteRule({ symbol, ruleId });
  }, [_deleteRule]);

  return {
    symbolRules,
    fetchRulesForSymbol,
    createRule: createRuleFn,
    toggleRule: toggleRuleFn,
    deleteRule: deleteRuleFn,
  };
}

// Tiny local hook to track which symbol is currently active.
import { useState, useCallback } from 'react';
function useActiveSymbol(): [string | null, (s: string) => void] {
  const [sym, setSym] = useState<string | null>(null);
  return [sym, setSym];
}
