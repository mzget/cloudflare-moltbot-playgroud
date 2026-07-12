import * as React from 'react';
import { Box, Typography, Card, CardContent, Chip, Stack, Button, Tooltip, Link } from '@mui/joy';
import { Mail, Calendar, Sparkles, Check, ExternalLink, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';

const Facebook = ({ size = 24, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) => (
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


interface EmailSource {
  id: string;
  subject: string;
  sender: string;
  received_at?: number | string;
}

interface EmailDigest {
  id: number;
  category: string;
  summary: string;
  key_takeaways: string; // JSON string of array
  source_emails: string; // JSON string of array of EmailSource
  digest_date: string;
  created_at: number; // timestamp
  is_readed?: number;
  facebook_status?: 'pending' | 'processing' | 'posted' | 'failed' | null;
  facebook_post_id?: string | null;
  facebook_error?: string | null;
}

export function EmailDigestCard({ 
  digest,
  onMarkAsRead,
  onQueueFacebook
}: { 
  digest: EmailDigest;
  onMarkAsRead?: (id: number) => void;
  onQueueFacebook?: (id: number) => void;
}) {
  const takeaways = React.useMemo(() => {
    try {
      return JSON.parse(digest.key_takeaways || '[]');
    } catch {
      return [];
    }
  }, [digest.key_takeaways]);

  const sources = React.useMemo<EmailSource[]>(() => {
    try {
      return JSON.parse(digest.source_emails || '[]');
    } catch {
      return [];
    }
  }, [digest.source_emails]);

  return (
    <Card sx={{ ...glassStyle, p: 1 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          justifyContent="space-between" 
          alignItems={{ xs: 'flex-start', sm: 'flex-start' }} 
          spacing={2} 
          sx={{ mb: 3 }}
        >
          <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 1 }}>
              <Typography level="h3" sx={{ fontWeight: 800, color: 'text.primary' }}>
                {digest.category}
              </Typography>
              <Chip
                variant="soft"
                color="primary"
                size="md"
                startDecorator={<Mail size={16} />}
              >
                Email Digest
              </Chip>
            </Stack>
            <Typography level="body-xs" sx={{ color: 'text.tertiary', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Calendar size={12} />
              Compiled on {new Date(digest.digest_date).toLocaleDateString()}
            </Typography>
          </Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
            {onMarkAsRead && (
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                startDecorator={<Check size={14} />}
                onClick={() => onMarkAsRead(digest.id)}
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
            {onQueueFacebook && (
              (() => {
                const status = digest.facebook_status;
                if (!status) {
                  return (
                    <Button
                      variant="outlined"
                      color="neutral"
                      size="sm"
                      startDecorator={<Facebook size={14} />}
                      onClick={() => onQueueFacebook(digest.id)}
                      sx={{
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        borderColor: 'rgba(24, 119, 242, 0.2)',
                        bgcolor: 'rgba(24, 119, 242, 0.02)',
                        color: 'rgba(45, 136, 255, 0.9)',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'rgba(24, 119, 242, 0.08)',
                          borderColor: 'rgba(24, 119, 242, 0.4)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 12px rgba(24, 119, 242, 0.15)',
                        },
                        '&:active': {
                          transform: 'translateY(0)',
                        }
                      }}
                    >
                      Post to FB
                    </Button>
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
                          startDecorator={<Facebook size={14} />}
                          endDecorator={
                            digest.facebook_post_id ? (
                              <Link
                                href={`https://facebook.com/${digest.facebook_post_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.5 }}
                              >
                                <ExternalLink size={12} />
                              </Link>
                            ) : undefined
                          }
                          sx={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.8rem', height: 32 }}
                        >
                          Posted
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
                        sx={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.8rem', height: 32 }}
                      >
                        Posting...
                      </Chip>
                    );
                  case 'failed':
                    return (
                      <Tooltip title={digest.facebook_error || 'Unknown error'} variant="solid" color="danger">
                        <Button
                          variant="outlined"
                          color="danger"
                          size="sm"
                          startDecorator={<AlertCircle size={14} />}
                          onClick={() => onQueueFacebook(digest.id)}
                          sx={{
                            borderRadius: '10px',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            borderColor: 'rgba(211, 47, 47, 0.2)',
                            bgcolor: 'rgba(211, 47, 47, 0.02)',
                            transition: 'all 0.2s',
                            '&:hover': {
                              bgcolor: 'rgba(211, 47, 47, 0.08)',
                              borderColor: 'rgba(211, 47, 47, 0.4)',
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(211, 47, 47, 0.15)',
                            },
                            '&:active': {
                              transform: 'translateY(0)',
                            }
                          }}
                        >
                          Failed - Retry
                        </Button>
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
                        sx={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.8rem', height: 32 }}
                      >
                        Queued
                      </Chip>
                    );
                }
              })()
            )}
            <Sparkles size={28} color="var(--joy-palette-primary-plainColor)" style={{ opacity: 0.15 }} />
          </Stack>
        </Stack>

        <Typography level="body-lg" sx={{ opacity: 0.9, fontStyle: 'italic', mb: 4, lineHeight: 1.7, borderLeft: '4px solid var(--joy-palette-primary-500)', pl: 3 }}>
          {digest.summary}
        </Typography>

        <Box sx={{ bgcolor: 'background.level1', borderRadius: '16px', p: 3, mb: 3 }}>
          <Typography level="title-md" sx={{ mb: 2, fontWeight: 700 }}>Key Insights & Takeaways</Typography>
          <Stack spacing={1.5}>
            {takeaways.map((point: string, i: number) => (
              <Stack key={i} direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ width: 6, height: 6, bgcolor: 'primary.500', borderRadius: '50%', mt: 1, boxShadow: '0 0 6px var(--joy-palette-primary-500)' }} />
                <Typography level="body-md" sx={{ color: 'text.secondary' }}>{point}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {sources.length > 0 && (
          <Box sx={{ maxWidth: '100%' }}>
            <Typography level="body-xs" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.tertiary', mb: 1.5 }}>
              Source Newsletters ({sources.length})
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ maxWidth: '100%' }}>
              {sources.map((src, i) => (
                <Chip
                  key={i}
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    borderColor: 'rgba(255, 255, 255, 0.05)',
                    py: 0.75,
                    px: 1.5,
                    maxWidth: '100%',
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }
                  }}
                  title={`From: ${src.sender}`}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Typography 
                      level="body-xs" 
                      noWrap 
                      sx={{ 
                        fontWeight: 600, 
                        color: 'text.secondary',
                      }}
                    >
                      {src.subject}
                    </Typography>
                    <Typography
                      level="body-xs"
                      noWrap
                      sx={{
                        color: 'text.tertiary',
                        fontSize: '0.65rem',
                      }}
                    >
                      {src.sender}
                    </Typography>
                  </Box>
                </Chip>
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default EmailDigestCard;
