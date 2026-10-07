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
    onArticleQueueFacebook,
    onArticlePublishNow,
    onArticleDelete,
    onArticleRead,
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
      onArticleQueueFacebook={onArticleQueueFacebook}
      onArticlePublishNow={onArticlePublishNow}
      onArticleDelete={onArticleDelete}
      onArticleRead={onArticleRead}
      onReportRead={onReportRead}
    />
  );
}