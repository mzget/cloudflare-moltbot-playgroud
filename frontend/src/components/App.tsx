import * as React from 'react';
import {
  HostAppShell,
  analysisSearchSchema,
  financeSearchSchema,
  generalSearchSchema,
  type FinanceSearch,
  type FinanceTab,
} from '@oaktree/host';
import { useIntelligenceStore } from '../store/intelligenceStore';

// Re-export schemas and types for backwards compatibility with tests and consumers
export {
  analysisSearchSchema,
  financeSearchSchema,
  generalSearchSchema,
  type FinanceSearch,
  type FinanceTab,
};

// Lazy loaded Oaktree domain views
const YahooPortfolio = React.lazy(() => import('./features/portfolio/YahooPortfolio'));
const MarketIntelligence = React.lazy(() => import('./features/market/MarketIntelligence'));
const MarketEventsTimeline = React.lazy(() => import('./features/market/MarketEventsTimeline'));
const Watchlist = React.lazy(() => import('./features/watchlist/Watchlist'));
const KnowledgeChat = React.lazy(() => import('./features/agent/KnowledgeChat'));
const AnalysisReport = React.lazy(() => import('./features/agent/AnalysisReport'));
const DatabaseChat = React.lazy(() => import('./features/agent/DatabaseChat'));
const SourceManager = React.lazy(() => import('./features/sources/SourceManager'));

const oaktreeViews = {
  dashboard: YahooPortfolio,
  market: MarketIntelligence,
  marketSidebar: MarketEventsTimeline,
  watchlist: Watchlist,
  agent: KnowledgeChat,
  analysis: AnalysisReport,
  dbAgent: DatabaseChat,
  commandCenter: SourceManager,
};

export default function App() {
  const { reports, digests, fetchReports } = useIntelligenceStore();

  React.useEffect(() => {
    fetchReports();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchReports();
      }
    }, 180000); // Poll every 3 minutes

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchReports();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [fetchReports]);

  const reportsCount = (reports?.length || 0) + (digests?.length || 0);

  return (
    <HostAppShell
      views={oaktreeViews}
      reportsCount={reportsCount}
    />
  );
}
