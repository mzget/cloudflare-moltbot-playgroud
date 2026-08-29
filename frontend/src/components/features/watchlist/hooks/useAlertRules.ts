import { useCallback } from 'react';
import { API_BASE_URL } from '../../../../config';
import { useQuery } from '../../../../utils/useQuery';
import { useMutation } from '../../../../utils/useMutation';
import { invalidateQueries } from '../../../../utils/invalidateQueries';
import { useQueryCache } from '../../../../store/queryCache';

export interface AlertRule {
  id: number;
  symbol: string;
  metric: string;
  condition_type: string;
  target_value: number;
  is_active: number;
  last_checked_value?: number | null;
  note?: string | null;
}

export function useAlertRules(activeSymbol: string | null, onAlertRulesChanged?: () => void) {
  const alertsKey = activeSymbol ? `alerts:${activeSymbol}` : null;

  const { data: rawSymbolRules = [], isLoading, refetch } = useQuery<AlertRule[]>(
    alertsKey ?? '__alerts_disabled__',
    async () => {
      if (!activeSymbol) return [];
      const res = await fetch(`${API_BASE_URL}/api/alerts?symbol=${activeSymbol}`);
      if (!res.ok) throw new Error('Failed to fetch alert rules');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    {
      enabled: !!alertsKey,
      staleTime: 0, // Always fresh when modal is opened for a symbol
    }
  );

  const symbolRules = Array.isArray(rawSymbolRules) ? rawSymbolRules : [];

  // --- createRule ---
  const { mutateAsync: createRule } = useMutation(
    async ({ symbol, metric, condition, targetValue, note }: { symbol: string; metric: string; condition: string; targetValue: number; note?: string }) => {
      const res = await fetch(`${API_BASE_URL}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, metric, condition_type: condition, target_value: targetValue, note }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ symbol, metric, condition, targetValue, note }) => {
        const key = `alerts:${symbol}`;
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<any[]>(key).data ?? [];
        setEntry(key, {
          data: [...prev, { symbol, metric, condition_type: condition, target_value: targetValue, is_active: 1, note: note || null, last_checked_value: null }] as unknown[],
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

  // --- updateRuleNote ---
  const { mutateAsync: _updateRuleNote } = useMutation(
    async ({ ruleId, note }: { symbol: string; ruleId: number; note: string }) => {
      const res = await fetch(`${API_BASE_URL}/api/alerts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId, note }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ symbol, ruleId, note }) => {
        const key = `alerts:${symbol}`;
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<any[]>(key).data ?? [];
        setEntry(key, {
          data: prev.map(r => r.id === ruleId ? { ...r, note } : r) as unknown[],
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

  // --- updateRuleTarget ---
  const { mutateAsync: _updateRuleTarget } = useMutation(
    async ({ ruleId, targetValue }: { symbol: string; ruleId: number; targetValue: number }) => {
      const res = await fetch(`${API_BASE_URL}/api/alerts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId, target_value: targetValue }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ symbol, ruleId, targetValue }) => {
        const key = `alerts:${symbol}`;
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<any[]>(key).data ?? [];
        setEntry(key, {
          data: prev.map(r => r.id === ruleId ? { ...r, target_value: targetValue } : r) as unknown[],
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

  const createRuleFn = useCallback((symbol: string, metric: string, condition: string, targetValue: number, note?: string) => {
    return createRule({ symbol, metric, condition, targetValue, note });
  }, [createRule]);

  const toggleRuleFn = useCallback((symbol: string, ruleId: number, currentStatus: number) => {
    return _toggleRule({ symbol, ruleId, currentStatus });
  }, [_toggleRule]);

  const updateRuleTargetFn = useCallback((symbol: string, ruleId: number, targetValue: number) => {
    return _updateRuleTarget({ symbol, ruleId, targetValue });
  }, [_updateRuleTarget]);

  const updateRuleNoteFn = useCallback((symbol: string, ruleId: number, note: string) => {
    return _updateRuleNote({ symbol, ruleId, note });
  }, [_updateRuleNote]);

  const deleteRuleFn = useCallback((symbol: string, ruleId: number) => {
    return _deleteRule({ symbol, ruleId });
  }, [_deleteRule]);

  return {
    symbolRules: activeSymbol ? symbolRules : [],
    isLoading: !!activeSymbol && isLoading,
    refetch,
    createRule: createRuleFn,
    toggleRule: toggleRuleFn,
    updateRuleTarget: updateRuleTargetFn,
    updateRuleNote: updateRuleNoteFn,
    deleteRule: deleteRuleFn,
  };
}
