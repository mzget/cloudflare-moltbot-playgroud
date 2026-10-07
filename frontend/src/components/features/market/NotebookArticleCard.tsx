import * as React from 'react';
import { Box, Typography, Card, CardContent, Chip, Stack, Tooltip, Link, Button, IconButton, Modal, ModalDialog, DialogTitle, DialogContent } from '@mui/joy';
import { Clock, AlertCircle, CheckCircle, ExternalLink, RefreshCw, Sparkles, BookOpen, Send, Trash2, Check } from 'lucide-react';
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

export interface NotebookArticleCardProps {
  article: {
    id: number;
    title: string;
    symbol: string | null;
    summary: string | null;
    key_takeaways: string;
    source?: string | null;
    category?: string | null;
    url?: string | null;
    auto_publish?: number | null;
    created_at: number; // timestamp in seconds
    is_readed?: number;
    facebook_status: 'pending' | 'processing' | 'posted' | 'failed' | null;
    facebook_post_id: string | null;
    facebook_error: string | null;
  };
  onQueueFacebook?: (id: number) => Promise<void>;
  onPublishNow?: (id: number) => Promise<{ success: boolean; error?: string }>;
  onDelete?: (id: number) => Promise<void> | void;
  onMarkAsRead?: (id: number) => Promise<void> | void;
}

export default function NotebookArticleCard({
  article,
  onQueueFacebook,
  onPublishNow,
  onDelete,
  onMarkAsRead
}: NotebookArticleCardProps) {
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [isQueueing, setIsQueueing] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isMarkingRead, setIsMarkingRead] = React.useState(false);

  const isRead = article.is_readed === 1;

  const takeaways = React.useMemo(() => {
    try {
      return JSON.parse(article.key_takeaways || '[]');
    } catch (e) {
      return [];
    }
  }, [article.key_takeaways]);

  const isGeminiSpark = article.source === 'gemini_spark';

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

  const handlePublishNow = async () => {
    if (!onPublishNow) return;
    try {
      setIsPublishing(true);
      await onPublishNow(article.id);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleQueueFacebook = async () => {
    if (!onQueueFacebook) return;
    try {
      setIsQueueing(true);
      await onQueueFacebook(article.id);
    } finally {
      setIsQueueing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    try {
      setIsDeleting(true);
      await onDelete(article.id);
      setIsDeleteConfirmOpen(false);
    } catch (e) {
      console.error('Failed to delete notebook article:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (!onMarkAsRead) return;
    try {
      setIsMarkingRead(true);
      await onMarkAsRead(article.id);
    } catch (e) {
      console.error('Failed to mark article as read:', e);
    } finally {
      setIsMarkingRead(false);
    }
  };

  return (
    <Card sx={{ ...glassStyle, p: 1, opacity: isRead ? 0.6 : 1, transition: 'opacity 0.3s ease' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 1, mb: 1.5 }}>
              {isGeminiSpark ? (
                <Chip
                  variant="soft"
                  color="primary"
                  size="sm"
                  startDecorator={<Sparkles size={13} />}
                  sx={{
                    bgcolor: 'rgba(147, 51, 234, 0.14)',
                    color: '#c084fc',
                    border: '1px solid rgba(147, 51, 234, 0.3)',
                    fontWeight: 700
                  }}
                >
                  Gemini Spark
                </Chip>
              ) : (
                <Chip
                  variant="soft"
                  color="neutral"
                  size="sm"
                  startDecorator={<BookOpen size={13} />}
                  sx={{ fontWeight: 600 }}
                >
                  NotebookLM
                </Chip>
              )}

              {article.category && (
                <Chip variant="outlined" color="neutral" size="sm" sx={{ fontSize: 'xs' }}>
                  {article.category}
                </Chip>
              )}

              {isRead && (
                <Chip variant="soft" color="neutral" size="sm" startDecorator={<Check size={12} />}>
                  Read
                </Chip>
              )}

              {article.symbol && (
                <Typography level="h3" sx={{ fontWeight: 800 }}>
                  {article.symbol}
                </Typography>
              )}
              <Typography level="title-md" sx={{ fontWeight: 700, opacity: 0.9 }} noWrap>
                {article.title}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={2} alignItems="center">
              <Typography level="body-xs" sx={{ color: 'text.tertiary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Synced on {new Date(article.created_at * 1000).toLocaleDateString()} {new Date(article.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
              {article.url && (
                <Link
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  level="body-xs"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'primary.400' }}
                >
                  Source Link <ExternalLink size={11} />
                </Link>
              )}
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            {onMarkAsRead && !isRead && (
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                startDecorator={<Check size={14} />}
                onClick={handleMarkAsRead}
                loading={isMarkingRead}
                sx={{
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'primary.softBg',
                    color: 'primary.softColor',
                    borderColor: 'primary.softBorder',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  }
                }}
              >
                Mark as Read
              </Button>
            )}
            {renderStatus()}
            <Box sx={{ color: 'rgba(24, 119, 242, 0.2)' }}>
              <FacebookIcon size={24} />
            </Box>
            {onDelete && (
              <Tooltip title="Delete article" variant="soft">
                <IconButton
                  size="sm"
                  variant="plain"
                  color="danger"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  sx={{
                    borderRadius: '8px',
                    opacity: 0.7,
                    transition: 'all 0.2s',
                    '&:hover': { opacity: 1, bgcolor: 'danger.softBg' }
                  }}
                >
                  <Trash2 size={16} />
                </IconButton>
              </Tooltip>
            )}
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
            "{article.summary}"
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

        {/* Action Buttons */}
        {article.facebook_status !== 'posted' && (
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ mt: 3 }}
            alignItems="center"
            flexWrap="wrap"
          >
            {article.facebook_status === 'failed' ? (
              <>
                <Button
                  size="sm"
                  variant="solid"
                  color="danger"
                  startDecorator={<RefreshCw size={14} />}
                  loading={isPublishing}
                  onClick={handlePublishNow}
                  sx={{ fontWeight: 600 }}
                >
                  Retry Publish Now
                </Button>
                <Button
                  size="sm"
                  variant="soft"
                  color="neutral"
                  loading={isQueueing}
                  onClick={handleQueueFacebook}
                  sx={{ fontWeight: 600 }}
                >
                  Re-queue to FB
                </Button>
              </>
            ) : article.facebook_status === 'pending' || article.facebook_status === 'processing' ? null : (
              <>
                <Button
                  size="sm"
                  variant="solid"
                  color="primary"
                  startDecorator={<Send size={14} />}
                  loading={isPublishing}
                  onClick={handlePublishNow}
                  sx={{ fontWeight: 600 }}
                >
                  Publish Now
                </Button>
                <Button
                  size="sm"
                  variant="soft"
                  color="neutral"
                  loading={isQueueing}
                  onClick={handleQueueFacebook}
                  sx={{ fontWeight: 600 }}
                >
                  Post to FB (Queue)
                </Button>
              </>
            )}
          </Stack>
        )}

        {/* Delete Confirmation Modal */}
        {onDelete && (
          <Modal
            open={isDeleteConfirmOpen}
            onClose={() => !isDeleting && setIsDeleteConfirmOpen(false)}
          >
            <ModalDialog
              role="alertdialog"
              variant="outlined"
              sx={{
                ...glassStyle,
                maxWidth: 460,
                borderRadius: '16px',
                p: 3,
              }}
            >
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Trash2 size={20} color="var(--joy-palette-danger-500, #f43f5e)" />
                Delete Article
              </DialogTitle>
              <DialogContent sx={{ color: 'text.secondary', mt: 1 }}>
                Are you sure you want to delete <strong>"{article.title}"</strong>? This will permanently remove the article and any associated Facebook queue record.
              </DialogContent>
              <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
                <Button
                  variant="plain"
                  color="neutral"
                  disabled={isDeleting}
                  onClick={() => setIsDeleteConfirmOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="solid"
                  color="danger"
                  startDecorator={<Trash2 size={14} />}
                  loading={isDeleting}
                  onClick={handleConfirmDelete}
                >
                  Delete Article
                </Button>
              </Stack>
            </ModalDialog>
          </Modal>
        )}
      </CardContent>
    </Card>
  );
}
