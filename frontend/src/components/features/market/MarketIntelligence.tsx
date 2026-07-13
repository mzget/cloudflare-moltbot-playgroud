import * as React from 'react';
import IntelligenceFeed from './IntelligenceFeed';
import { useIntelligenceStore } from '../../../store/intelligenceStore';

export default function MarketIntelligence() {
  const {
    reports,
    digests,
    notebookArticles,
    loading,
    onDigestRead,
    onDigestQueueFacebook,
    onReportRead,
  } = useIntelligenceStore();

  return (
    <IntelligenceFeed
      reports={reports}
      digests={digests}
      notebookArticles={notebookArticles}
      loading={loading}
      onDigestRead={onDigestRead}
      onDigestQueueFacebook={onDigestQueueFacebook}
      onReportRead={onReportRead}
    />
  );
}