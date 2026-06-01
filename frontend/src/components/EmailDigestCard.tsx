import * as React from 'react';
import { Box, Typography, Card, CardContent, Chip, Stack, Button } from '@mui/joy';
import { Mail, Calendar, Sparkles, Check } from 'lucide-react';
import { glassStyle } from '../styles/glass';

interface EmailSource {
  id: string;
  subject: string;
  sender: string;
  received_at?: number;
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
}

export function EmailDigestCard({ 
  digest,
  onMarkAsRead
}: { 
  digest: EmailDigest;
  onMarkAsRead?: (id: number) => void;
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
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
          <Box>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
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
          <Box>
            <Typography level="body-xs" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.tertiary', mb: 1.5 }}>
              Source Newsletters ({sources.length})
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
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
                    px: 1.5
                  }}
                  title={`From: ${src.sender}`}
                >
                  <Typography level="body-xs" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    {src.subject}
                  </Typography>
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
