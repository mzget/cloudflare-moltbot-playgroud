import * as React from 'react';
import { API_BASE_URL } from '../config';
import type { AnalysisCoverage, AnalysisCoverageMap } from '../types/analysisCoverage';

export function useAnalysisCoverage(symbols: string[]): AnalysisCoverageMap {
  const [coverageMap, setCoverageMap] = React.useState<AnalysisCoverageMap>(new Map());

  // Key to detect symbol list changes
  const symbolsKey = React.useMemo(() => {
    return [...symbols].sort().join(',');
  }, [symbols]);

  React.useEffect(() => {
    if (!symbolsKey) {
      setCoverageMap(new Map());
      return;
    }

    let isMounted = true;

    const fetchCoverage = async () => {
      try {
        const query = encodeURIComponent(symbolsKey);
        const res = await fetch(`${API_BASE_URL}/api/analysis/coverage?symbols=${query}`);
        if (res.ok) {
          const data: Record<string, AnalysisCoverage> = await res.json();
          if (isMounted) {
            const map = new Map<string, AnalysisCoverage>();
            Object.entries(data).forEach(([sym, coverage]) => {
              map.set(sym, coverage);
            });
            setCoverageMap(map);
          }
        }
      } catch (err) {
        console.error('Failed to fetch analysis coverage:', err);
      }
    };

    fetchCoverage();

    return () => {
      isMounted = false;
    };
  }, [symbolsKey]);

  return coverageMap;
}
