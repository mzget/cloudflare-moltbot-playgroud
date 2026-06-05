import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../../../../config';

export function useAlertRules(onAlertRulesChanged?: () => void) {
  const [symbolRules, setSymbolRules] = useState<any[]>([]);

  const fetchRulesForSymbol = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts?symbol=${symbol}`);
      if (res.ok) setSymbolRules(await res.json());
    } catch (e) {
      console.error("Failed to fetch alert rules", e);
    }
  }, []);

  const createRule = async (symbol: string, metric: string, condition: string, targetValue: number) => {
    const res = await fetch(`${API_BASE_URL}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        metric,
        condition_type: condition,
        target_value: targetValue
      })
    });
    if (res.ok) {
      await fetchRulesForSymbol(symbol);
      if (onAlertRulesChanged) onAlertRulesChanged();
    }
    return res;
  };

  const toggleRule = async (symbol: string, ruleId: number, currentStatus: number) => {
    const res = await fetch(`${API_BASE_URL}/api/alerts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ruleId,
        is_active: currentStatus === 1 ? 0 : 1
      })
    });
    if (res.ok) {
      await fetchRulesForSymbol(symbol);
      if (onAlertRulesChanged) onAlertRulesChanged();
    }
    return res;
  };

  const deleteRule = async (symbol: string, ruleId: number) => {
    const res = await fetch(`${API_BASE_URL}/api/alerts?id=${ruleId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      await fetchRulesForSymbol(symbol);
      if (onAlertRulesChanged) onAlertRulesChanged();
    }
    return res;
  };

  return {
    symbolRules,
    fetchRulesForSymbol,
    createRule,
    toggleRule,
    deleteRule
  };
}
