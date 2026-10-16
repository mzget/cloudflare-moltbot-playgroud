import React, { useState, useEffect } from 'react';
import { useCrawlerSources, type NewsSource } from './hooks/useCrawlerSources';
import {
  Box,
  Typography,
  Sheet,
  Table,
  IconButton,
  Button,
  Input,
  Chip,
  Stack,
  Switch,
  FormControl,
  FormLabel,
  Modal,
  ModalDialog,
  DialogTitle,
} from '@mui/joy';
import {
  Globe,
  Plus,
  Trash2,
  Edit,
} from 'lucide-react';
import { glassStyle } from '../../../styles/glass';
import { useSettingsStore, type DensityMode } from '../../../store/settingsStore';
import ManualTrigger from './ManualTrigger';

export interface WebCrawlerTabProps {
  density?: DensityMode;
}

export default function WebCrawlerTab({ density: propDensity }: WebCrawlerTabProps) {
  let storeDensity: DensityMode = 'cozy';
  try {
    storeDensity = useSettingsStore((state) => state.density);
  } catch {
    storeDensity = 'cozy';
  }
  const density = propDensity || storeDensity || 'cozy';

  const densityStyles = React.useMemo(() => {
    const config = {
      compact: {
        paddingX: '8px',
        paddingY: '5px',
        fontSize: '0.75rem',
      },
      cozy: {
        paddingX: '12px',
        paddingY: '9px',
        fontSize: '0.8rem',
      },
      comfort: {
        paddingX: '18px',
        paddingY: '14px',
        fontSize: '0.88rem',
      },
    };
    return config[density] || config.cozy;
  }, [density]);

  const {
    sources,
    loading: loadingSources,
    fetchSources,
    saveSource,
    deleteSource,
  } = useCrawlerSources();

  const [editingSource, setEditingSource] = useState<NewsSource | 'new' | null>(null);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleSaveSource = async (source: any) => {
    try {
      await saveSource(source);
      setEditingSource(null);
    } catch (e) {
      console.error('Failed to save source', e);
    }
  };

  const handleDeleteSource = async (id: number) => {
    if (!confirm('Delete this source?')) return;
    try {
      await deleteSource(id);
    } catch (e) {
      console.error('Failed to delete source', e);
    }
  };

  return (
    <Box>
      {/* Crawler & Report Generation Control Panel */}
      <Sheet
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: '16px',
          bgcolor: 'background.surface',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          mb: 4,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                p: 1.5,
                borderRadius: '12px',
                bgcolor: 'rgba(52, 152, 219, 0.15)',
                color: '#3498db',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Globe size={24} />
            </Box>
            <Box>
              <Typography level="title-md">Crawler & Report Controls</Typography>
              <Typography level="body-sm" sx={{ opacity: 0.6 }}>
                Manually trigger a news crawl across active sources or regenerate AI summaries for watchlist.
              </Typography>
            </Box>
          </Stack>
          <ManualTrigger />
        </Stack>
      </Sheet>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography level="title-md">Active Web Targets</Typography>
          <Typography level="body-xs" sx={{ opacity: 0.6 }}>crawls Google News and Yahoo Finance hourly.</Typography>
        </Box>
        <Button
          variant="soft"
          color="primary"
          startDecorator={<Plus size={18} />}
          onClick={() => setEditingSource('new')}
          sx={{ borderRadius: '12px' }}
        >
          Add Source
        </Button>
      </Stack>

      <Sheet sx={{ ...glassStyle, overflow: 'hidden' }}>
        <Table
          borderAxis="xBetween"
          hoverRow
          stripe="odd"
          sx={{
            '& tr > *': { borderBottom: '1px solid var(--joy-palette-divider)' },
            '--TableCell-paddingX': densityStyles.paddingX,
            '--TableCell-paddingY': densityStyles.paddingY,
            fontSize: densityStyles.fontSize,
          }}
        >
          <thead>
            <tr>
              <th style={{ background: 'transparent' }}>Name</th>
              <th style={{ background: 'transparent' }}>Type</th>
              <th style={{ background: 'transparent' }}>Status</th>
              <th style={{ background: 'transparent', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingSources ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>
                  <Typography sx={{ opacity: 0.6 }}>Loading crawler sources...</Typography>
                </td>
              </tr>
            ) : sources.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>
                  <Typography sx={{ opacity: 0.6 }}>No sources configured.</Typography>
                </td>
              </tr>
            ) : (
              sources.map((source) => (
                <tr key={source.id}>
                  <td>
                    <Typography level="title-sm">{source.name}</Typography>
                    <Typography level="body-xs" sx={{ opacity: 0.5 }} noWrap>{source.url_pattern}</Typography>
                  </td>
                  <td>
                    <Chip size="sm" variant="soft" color={source.type === 'RSS' ? 'primary' : 'warning'}>
                      {source.type}
                    </Chip>
                  </td>
                  <td>
                    <Chip size="sm" variant="soft" color={source.enabled ? 'success' : 'neutral'}>
                      {source.enabled ? 'Enabled' : 'Disabled'}
                    </Chip>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <IconButton size="sm" variant="plain" color="neutral" onClick={() => setEditingSource(source)}>
                      <Edit size={16} />
                    </IconButton>
                    <IconButton size="sm" variant="plain" color="danger" onClick={() => handleDeleteSource(source.id)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Sheet>

      {/* Web Source Modal */}
      <SourceModal
        open={!!editingSource}
        onClose={() => setEditingSource(null)}
        source={editingSource === 'new' ? null : editingSource}
        onSave={handleSaveSource}
      />
    </Box>
  );
}

// Web Source Modal Component
function SourceModal({ open, onClose, source, onSave }: any) {
  const [formData, setFormData] = useState<any>({
    name: '',
    url_pattern: '',
    selector: '',
    type: 'RSS',
    enabled: true,
  });

  useEffect(() => {
    if (source) setFormData(source);
    else setFormData({ name: '', url_pattern: '', selector: '', type: 'RSS', enabled: true });
  }, [source, open]);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ ...glassStyle, minWidth: 450 }}>
        <DialogTitle>{source ? 'Edit Source' : 'Add Source'}</DialogTitle>
        <Stack spacing={2.5} sx={{ mt: 2 }}>
          <FormControl required>
            <FormLabel>Name</FormLabel>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Yahoo News Tech" />
          </FormControl>
          <FormControl>
            <FormLabel>Type</FormLabel>
            <Stack direction="row" spacing={2}>
              <Button
                size="sm"
                variant={formData.type === 'RSS' ? 'solid' : 'soft'}
                onClick={() => setFormData({ ...formData, type: 'RSS' })}
              >
                RSS Feed
              </Button>
              <Button
                size="sm"
                variant={formData.type === 'WEB' ? 'solid' : 'soft'}
                onClick={() => setFormData({ ...formData, type: 'WEB' })}
              >
                Web Scraper (Puppeteer)
              </Button>
            </Stack>
          </FormControl>
          <FormControl required>
            <FormLabel>URL Pattern (use {'{symbol}'})</FormLabel>
            <Input
              value={formData.url_pattern}
              onChange={e => setFormData({ ...formData, url_pattern: e.target.value })}
              placeholder="e.g. https://finance.yahoo.com/quote/{symbol}/news"
            />
          </FormControl>
          {formData.type === 'WEB' && (
            <FormControl required>
              <FormLabel>CSS Selector</FormLabel>
              <Input
                value={formData.selector}
                onChange={e => setFormData({ ...formData, selector: e.target.value })}
                placeholder="e.g. section[data-test='qsp-news'] a"
              />
            </FormControl>
          )}
          <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <FormLabel>Enabled</FormLabel>
            <Switch
              checked={formData.enabled}
              onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
            />
          </FormControl>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button variant="plain" color="neutral" onClick={onClose}>Cancel</Button>
            <Button variant="solid" color="success" onClick={() => onSave(formData)}>Save Source</Button>
          </Stack>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
