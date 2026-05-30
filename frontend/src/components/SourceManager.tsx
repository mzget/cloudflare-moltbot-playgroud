import React, { useState, useEffect } from 'react';
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
  DialogContent,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Alert
} from '@mui/joy';
import {
  Globe,
  Plus,
  Trash2,
  Edit,
  Mail,
  Link,
  Unlink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Play
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { glassStyle } from '../styles/glass';

interface NewsSource {
  id: number;
  name: string;
  url_pattern: string;
  selector: string;
  type: 'RSS' | 'WEB';
  enabled: boolean;
}

interface EmailSubscription {
  id?: number;
  name: string;
  sender?: string;
  subject_filter?: string;
  label_filter?: string;
  raw_query?: string;
  frequency: 'hourly' | 'daily' | 'weekly';
  is_active: boolean | number;
}

export default function SourceManager() {
  const [index, setIndex] = useState(0);

  // RSS/Web Sources State
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [editingSource, setEditingSource] = useState<NewsSource | null>(null);

  // Gmail / Subscriptions State
  const [gmailConnected, setGmailConnected] = useState(false);
  const [checkingGmail, setCheckingGmail] = useState(true);
  const [subscriptions, setSubscriptions] = useState<EmailSubscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [showSubForm, setShowSubForm] = useState(false);
  const [editingSub, setEditingSub] = useState<EmailSubscription | null>(null);
  const [syncingEmails, setSyncingEmails] = useState(false);

  // Fetch Web/RSS news sources
  const fetchSources = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sources`);
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (e) {
      console.error('Failed to fetch sources', e);
    } finally {
      setLoadingSources(false);
    }
  };

  // Fetch Gmail Connection Status
  const checkGmailStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google/status`);
      if (res.ok) {
        const data = await res.json();
        setGmailConnected(data.connected);
      }
    } catch (e) {
      console.error('Failed to check Gmail status', e);
    } finally {
      setCheckingGmail(false);
    }
  };

  // Fetch Email Subscriptions
  const fetchSubscriptions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/subscriptions`);
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      }
    } catch (e) {
      console.error('Failed to fetch subscriptions', e);
    } finally {
      setLoadingSubs(false);
    }
  };

  useEffect(() => {
    fetchSources();
    checkGmailStatus();
    fetchSubscriptions();

    const handleConnected = () => {
      checkGmailStatus();
    };

    window.addEventListener('gmail-connected', handleConnected);
    return () => {
      window.removeEventListener('gmail-connected', handleConnected);
    };
  }, []);

  // Web/RSS actions
  const handleSaveSource = async (source: any) => {
    try {
      const method = source.id ? 'PUT' : 'POST';
      await fetch(`${API_BASE_URL}/api/sources`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source)
      });
      setShowSourceForm(false);
      setEditingSource(null);
      fetchSources();
    } catch (e) {
      console.error('Failed to save source', e);
    }
  };

  const handleDeleteSource = async (id: number) => {
    if (!confirm('Delete this source?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/sources?id=${id}`, { method: 'DELETE' });
      fetchSources();
    } catch (e) {
      console.error('Failed to delete source', e);
    }
  };

  // Gmail OAuth / Subscriptions Actions
  const handleConnectGmail = async () => {
    try {
      const redirectUri = window.location.origin + '/';
      const res = await fetch(
        `${API_BASE_URL}/api/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`
      );
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      }
    } catch (e) {
      console.error('Failed to initiate Google OAuth', e);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Disconnect from Gmail? This will stop email subscription updates.')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google/disconnect`, { method: 'DELETE' });
      if (res.ok) {
        setGmailConnected(false);
      }
    } catch (e) {
      console.error('Failed to disconnect Gmail', e);
    }
  };

  const handleSaveSub = async (sub: any) => {
    try {
      const method = sub.id ? 'PUT' : 'POST';
      await fetch(`${API_BASE_URL}/api/subscriptions`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });
      setShowSubForm(false);
      setEditingSub(null);
      fetchSubscriptions();
    } catch (e) {
      console.error('Failed to save subscription', e);
    }
  };

  const handleDeleteSub = async (id: number) => {
    if (!confirm('Delete this email subscription?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/subscriptions?id=${id}`, { method: 'DELETE' });
      fetchSubscriptions();
    } catch (e) {
      console.error('Failed to delete subscription', e);
    }
  };

  const handleSyncEmails = async () => {
    setSyncingEmails(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/email-sync`, { method: 'POST' });
      if (res.ok) {
        alert('Gmail sync and AI summarization task started in background.');
      }
    } catch (e) {
      console.error('Failed to sync emails', e);
    } finally {
      setSyncingEmails(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography level="h2" sx={{ fontWeight: 800, mb: 1 }}>Command Center</Typography>
      <Typography sx={{ color: 'text.secondary', mb: 3 }}>
        Manage crawlers, web search definitions, and email newsletter configurations.
      </Typography>

      <Tabs value={index} onChange={(e, val) => setIndex(val as number)}>
        <TabList
          variant="soft"
          sx={{
            p: 0.5,
            gap: 1,
            borderRadius: '12px',
            bgcolor: 'background.level1',
            '--Tab-colorscheme': 'primary',
            '--Tab-indicatorRadius': '8px',
            mb: 3
          }}
        >
          <Tab disableIndicator sx={{ px: 3, borderRadius: '8px' }}>
            <Globe size={16} style={{ marginRight: 8 }} />
            Web & RSS Crawler
          </Tab>
          <Tab disableIndicator sx={{ px: 3, borderRadius: '8px' }}>
            <Mail size={16} style={{ marginRight: 8 }} />
            Gmail Newsletters
          </Tab>
        </TabList>

        <TabPanel value={0} sx={{ p: 0 }}>
          {/* Tab 1: Web & RSS Crawler */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Box>
              <Typography level="title-md">Active Web Targets</Typography>
              <Typography level="body-xs" sx={{ opacity: 0.6 }}>crawls Google News and Yahoo Finance hourly.</Typography>
            </Box>
            <Button
              variant="soft"
              color="primary"
              startDecorator={<Plus size={18} />}
              onClick={() => setShowSourceForm(true)}
              sx={{ borderRadius: '12px' }}
            >
              Add Source
            </Button>
          </Stack>

          <Sheet sx={{ ...glassStyle, overflow: 'hidden' }}>
            <Table sx={{ '& tr > *': { borderBottom: '1px solid var(--joy-palette-divider)' } }}>
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
        </TabPanel>

        <TabPanel value={1} sx={{ p: 0 }}>
          {/* Tab 2: Gmail Newsletters */}
          <Stack spacing={3}>
            {/* Connection Status Panel */}
            <Sheet
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: '16px',
                bgcolor: 'background.surface',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: '12px',
                      bgcolor: gmailConnected ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                      color: gmailConnected ? '#2ecc71' : '#e74c3c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Mail size={24} />
                  </Box>
                  <Box>
                    <Typography level="title-md">Gmail API Connection</Typography>
                    <Typography level="body-sm" sx={{ opacity: 0.6 }}>
                      {gmailConnected
                        ? 'Connected to your Gmail account. Ready to poll newsletter emails.'
                        : 'Connect your Gmail account to ingest newsletters and run AI summarization.'}
                    </Typography>
                  </Box>
                </Stack>

                {checkingGmail ? (
                  <Button variant="soft" disabled startDecorator={<RefreshCw size={16} className="animate-spin" />}>
                    Checking Status
                  </Button>
                ) : gmailConnected ? (
                  <Stack direction="row" spacing={1.5}>
                    <Button
                      variant="soft"
                      color="primary"
                      onClick={handleSyncEmails}
                      loading={syncingEmails}
                      startDecorator={<Play size={16} />}
                      sx={{ borderRadius: '12px' }}
                    >
                      Sync Now
                    </Button>
                    <Button
                      variant="soft"
                      color="danger"
                      onClick={handleDisconnectGmail}
                      startDecorator={<Unlink size={16} />}
                      sx={{ borderRadius: '12px' }}
                    >
                      Disconnect
                    </Button>
                  </Stack>
                ) : (
                  <Button
                    variant="solid"
                    color="primary"
                    onClick={handleConnectGmail}
                    startDecorator={<Link size={16} />}
                    sx={{ borderRadius: '12px' }}
                  >
                    Connect Gmail
                  </Button>
                )}
              </Stack>
            </Sheet>

            {/* Subscriptions Panel */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
              <Box>
                <Typography level="title-md">Newsletter Rules</Typography>
                <Typography level="body-xs" sx={{ opacity: 0.6 }}>
                  Define queries to match specific newsletters in your inbox.
                </Typography>
              </Box>
              <Button
                variant="soft"
                color="primary"
                disabled={!gmailConnected}
                startDecorator={<Plus size={18} />}
                onClick={() => setShowSubForm(true)}
                sx={{ borderRadius: '12px' }}
              >
                Add Newsletter Rule
              </Button>
            </Stack>

            <Sheet sx={{ ...glassStyle, overflow: 'hidden' }}>
              <Table sx={{ '& tr > *': { borderBottom: '1px solid var(--joy-palette-divider)' } }}>
                <thead>
                  <tr>
                    <th style={{ background: 'transparent' }}>Name / Query</th>
                    <th style={{ background: 'transparent' }}>Frequency</th>
                    <th style={{ background: 'transparent' }}>Status</th>
                    <th style={{ background: 'transparent', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSubs ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>
                        <Typography sx={{ opacity: 0.6 }}>Loading newsletter rules...</Typography>
                      </td>
                    </tr>
                  ) : subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>
                        <Typography sx={{ opacity: 0.6 }}>
                          No newsletter subscription rules configured yet.
                        </Typography>
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((sub: any) => (
                      <tr key={sub.id}>
                        <td>
                          <Typography level="title-sm">{sub.name}</Typography>
                          <Typography level="body-xs" sx={{ opacity: 0.5 }} noWrap>
                            {sub.raw_query ||
                              `from:${sub.sender || '*'} | subject:${sub.subject_filter || '*'} | label:${sub.label_filter || '*'}`}
                          </Typography>
                        </td>
                        <td>
                          <Chip size="sm" variant="soft" color="neutral" sx={{ textTransform: 'capitalize' }}>
                            {sub.frequency}
                          </Chip>
                        </td>
                        <td>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={sub.is_active ? 'success' : 'neutral'}
                          >
                            {sub.is_active ? 'Active' : 'Inactive'}
                          </Chip>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <IconButton
                            size="sm"
                            variant="plain"
                            color="neutral"
                            onClick={() => setEditingSub(sub)}
                          >
                            <Edit size={16} />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="plain"
                            color="danger"
                            onClick={() => handleDeleteSub(sub.id)}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Sheet>
          </Stack>
        </TabPanel>
      </Tabs>

      {/* Web Source Modal */}
      <SourceModal
        open={showSourceForm || !!editingSource}
        onClose={() => {
          setShowSourceForm(false);
          setEditingSource(null);
        }}
        source={editingSource}
        onSave={handleSaveSource}
      />

      {/* Email Subscription Modal */}
      <SubscriptionModal
        open={showSubForm || !!editingSub}
        onClose={() => {
          setShowSubForm(false);
          setEditingSub(null);
        }}
        subscription={editingSub}
        onSave={handleSaveSub}
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
    enabled: true
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

// Email Subscription Modal Component
function SubscriptionModal({ open, onClose, subscription, onSave }: any) {
  const [formData, setFormData] = useState<any>({
    name: '',
    sender: '',
    subject_filter: '',
    label_filter: '',
    raw_query: '',
    frequency: 'hourly',
    is_active: true
  });
  const [isAdvanced, setIsAdvanced] = useState(false);

  useEffect(() => {
    if (subscription) {
      setFormData({
        ...subscription,
        is_active: !!subscription.is_active
      });
      setIsAdvanced(!!subscription.raw_query);
    } else {
      setFormData({
        name: '',
        sender: '',
        subject_filter: '',
        label_filter: '',
        raw_query: '',
        frequency: 'hourly',
        is_active: true
      });
      setIsAdvanced(false);
    }
  }, [subscription, open]);

  // Compute live Gmail Query preview
  const computedQuery = () => {
    if (isAdvanced) return formData.raw_query;
    const parts = [];
    if (formData.sender) parts.push(`from:${formData.sender}`);
    if (formData.subject_filter) parts.push(`subject:(${formData.subject_filter})`);
    if (formData.label_filter) parts.push(`label:${formData.label_filter}`);
    return parts.join(' ');
  };

  const handleSave = () => {
    const finalData = { ...formData };
    if (!isAdvanced) {
      finalData.raw_query = ''; // clear advanced override
    } else {
      // clear discrete fields
      finalData.sender = '';
      finalData.subject_filter = '';
      finalData.label_filter = '';
    }
    onSave(finalData);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ ...glassStyle, minWidth: 480 }}>
        <DialogTitle>{subscription ? 'Edit Newsletter Rule' : 'Add Newsletter Rule'}</DialogTitle>
        <Stack spacing={2.5} sx={{ mt: 2 }}>
          <FormControl required>
            <FormLabel>Rule Name</FormLabel>
            <Input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Matt Levine's Money Stuff"
            />
          </FormControl>

          <FormControl>
            <FormLabel>Configuration Mode</FormLabel>
            <Stack direction="row" spacing={2}>
              <Button
                size="sm"
                variant={!isAdvanced ? 'solid' : 'soft'}
                onClick={() => setIsAdvanced(false)}
              >
                Simple Fields
              </Button>
              <Button
                size="sm"
                variant={isAdvanced ? 'solid' : 'soft'}
                onClick={() => setIsAdvanced(true)}
              >
                Advanced Raw Query
              </Button>
            </Stack>
          </FormControl>

          {!isAdvanced ? (
            <>
              <FormControl>
                <FormLabel>Sender Email / Domain</FormLabel>
                <Input
                  value={formData.sender}
                  onChange={e => setFormData({ ...formData, sender: e.target.value })}
                  placeholder="e.g. newsletters@bloomberg.net"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Subject Filter (Keywords)</FormLabel>
                <Input
                  value={formData.subject_filter}
                  onChange={e => setFormData({ ...formData, subject_filter: e.target.value })}
                  placeholder="e.g. Money Stuff"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Gmail Label</FormLabel>
                <Input
                  value={formData.label_filter}
                  onChange={e => setFormData({ ...formData, label_filter: e.target.value })}
                  placeholder="e.g. newsletters"
                />
              </FormControl>
            </>
          ) : (
            <FormControl required>
              <FormLabel>Raw Gmail Search Query</FormLabel>
              <Input
                value={formData.raw_query}
                onChange={e => setFormData({ ...formData, raw_query: e.target.value })}
                placeholder="e.g. from:newsletters@bloomberg.net subject:(Money Stuff) label:newsletters"
              />
            </FormControl>
          )}

          {/* Query Preview */}
          <Alert
            variant="soft"
            color="primary"
            size="sm"
            startDecorator={<Sliders size={16} />}
            sx={{ borderRadius: '10px' }}
          >
            <Box>
              <Typography level="title-sm" sx={{ fontWeight: 700 }}>Compiled Gmail API Query:</Typography>
              <Typography level="body-xs" sx={{ fontFamily: 'monospace', mt: 0.5, wordBreak: 'break-all' }}>
                {computedQuery() || 'None (matches everything)'}
              </Typography>
            </Box>
          </Alert>

          <FormControl required>
            <FormLabel>Summarization Frequency</FormLabel>
            <Stack direction="row" spacing={1.5}>
              {(['hourly', 'daily', 'weekly'] as const).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={formData.frequency === f ? 'solid' : 'soft'}
                  onClick={() => setFormData({ ...formData, frequency: f })}
                  sx={{ textTransform: 'capitalize' }}
                >
                  {f}
                </Button>
              ))}
            </Stack>
          </FormControl>

          <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <FormLabel>Rule Active</FormLabel>
            <Switch
              checked={formData.is_active}
              onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
            />
          </FormControl>

          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button variant="plain" color="neutral" onClick={onClose}>Cancel</Button>
            <Button variant="solid" color="success" onClick={handleSave}>Save Rule</Button>
          </Stack>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
