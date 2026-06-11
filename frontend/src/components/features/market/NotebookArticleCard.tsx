import * as React from 'react';
import { Box, Typography, Card, CardContent, Chip, Stack, Tooltip, IconButton, Link } from '@mui/joy';
import { Clock, AlertCircle, CheckCircle, ExternalLink, Quote, RefreshCw } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';

const FacebookIcon = ({ size = 24, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

interface NotebookArticleCardProps {
  article: {
    id: number;
    title: string;
    symbol: string | null;
    summary: string | null;
    key_takeaways: string;
    created_at: number; // timestamp in seconds
    facebook_status: 'pending' | 'processing' | 'posted' | 'failed' | null;
    facebook_post_id: string | null;
    facebook_error: string | null;
  };
}

export default function NotebookArticleCard({ article }: NotebookArticleCardProps) {
  const takeaways = React.useMemo(() => {
    try {
      return JSON.parse(article.key_takeaways || '[]');
    } catch (e) {
      return [];
    }
  }, [article.key_takeaways]);

  const renderStatus = () => {
    const status = article.facebook_status;
    if (!status) {
      return (
        <Chip
          variant="soft"
          color="neutral"
          size="sm"
          startDecorator={<Clock size={14} />}
        >
          Not Queued
        </Chip>
      );
    }

    switch (status) {
      case 'posted':
        return (
          <Tooltip title="View published post on Facebook" variant="soft">
            <Chip
              variant="soft"
              color="success"
              size="sm"
              startDecorator={<CheckCircle size={14} />}
              endDecorator={
                article.facebook_post_id ? (
                  <Link
                    href={`https://facebook.com/${article.facebook_post_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.5 }}
                  >
                    <ExternalLink size={12} />
                  </Link>
                ) : undefined
              }
            >
              Published
            </Chip>
          </Tooltip>
        );
      case 'processing':
        return (
          <Chip
            variant="soft"
            color="warning"
            size="sm"
            startDecorator={<RefreshCw size={14} className="animate-spin" />}
          >
            Publishing...
          </Chip>
        );
      case 'failed':
        return (
          <Tooltip title={article.facebook_error || 'Unknown error'} variant="solid" color="danger">
            <Chip
              variant="soft"
              color="danger"
              size="sm"
              startDecorator={<AlertCircle size={14} />}
              sx={{ cursor: 'help' }}
            >
              Failed
            </Chip>
          </Tooltip>
        );
      case 'pending':
      default:
        return (
          <Chip
            variant="soft"
            color="primary"
            size="sm"
            startDecorator={<Clock size={14} />}
          >
            Queued
          </Chip>
        );
    }
  };

  return (
    <Card sx={{ ...glassStyle, p: 1 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ gap: 1, mb: 1 }}>
              {article.symbol && (
                <Typography level="h3" sx={{ fontWeight: 800 }}>
                  {article.symbol}
                </Typography>
              )}
              <Typography level="title-md" sx={{ fontWeight: 700, opacity: 0.9 }} noWrap>
                {article.title}
              </Typography>
            </Stack>
            <Typography level="body-xs" sx={{ color: 'text.tertiary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Synced on {new Date(article.created_at * 1000).toLocaleDateString()} {new Date(article.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {renderStatus()}
            <Box sx={{ color: 'rgba(24, 119, 242, 0.2)' }}>
              <FacebookIcon size={24} />
            </Box>
          </Stack>
        </Stack>

        {article.summary && (
          <Typography
            level="body-lg"
            sx={{
              opacity: 0.9,
              fontStyle: 'italic',
              mb: 3,
              lineHeight: 1.7,
              borderLeft: '4px solid var(--joy-palette-primary-500)',
              pl: 3
            }}
          >
            {article.summary}
          </Typography>
        )}

        {takeaways.length > 0 && (
          <Box sx={{ bgcolor: 'background.level1', borderRadius: '16px', p: 3 }}>
            <Typography level="title-sm" sx={{ mb: 1.5, fontWeight: 700, opacity: 0.8 }}>Key Takeaways</Typography>
            <Stack spacing={1.2}>
              {takeaways.map((point: string, i: number) => (
                <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                  <Box sx={{ width: 6, height: 6, bgcolor: 'primary.500', borderRadius: '50%', mt: 1, boxShadow: '0 0 6px var(--joy-palette-primary-500)' }} />
                  <Typography level="body-sm" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                    {point}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
