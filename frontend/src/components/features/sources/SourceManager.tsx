import React, { useState, useEffect } from 'react';
import { useCrawlerSources } from './hooks/useCrawlerSources';
import type { NewsSource } from './hooks/useCrawlerSources';
import { useGmailSubscriptions } from './hooks/useGmailSubscriptions';
import type { EmailSubscription } from './hooks/useGmailSubscriptions';
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
  Alert,
  Divider,
  Grid,
  Select,
  Option
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
  Play,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import OaktreeIcon from '../../common/OaktreeIcon';
import ManualTrigger from './ManualTrigger';

// Custom Facebook Icon component using standard Lucide SVG path
const Facebook = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
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

export default function SourceManager() {
  const [index, setIndex] = useState(0);

  const {
    sources,
    loading: loadingSources,
    fetchSources,
    saveSource,
    deleteSource
  } = useCrawlerSources();

  const {
    gmailConnected,
    checkingGmail,
    subscriptions,
    loadingSubs,
    actionsLoading,
    checkGmailStatus,
    fetchSubscriptions,
    connectGmail,
    disconnectGmail,
    saveSubscription,
    deleteSubscription,
    syncEmails,
    testDigest
  } = useGmailSubscriptions();

  // Consolidated active form states
  // 'new' represents creating, NewsSource/EmailSubscription represents editing, null represents closed modal
  const [editingSource, setEditingSource] = useState<NewsSource | 'new' | null>(null);
  const [editingSub, setEditingSub] = useState<EmailSubscription | 'new' | null>(null);

  // Facebook Posting settings
  const [facebookSettings, setFacebookSettings] = useState({
    pauseDailyReportFacebook: false,
    pauseEmailDigestFacebook: false,
    pauseCustomFacebook: false,
  });
  const [updatingSettings, setUpdatingSettings] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`);
      if (res.ok) {
        const settings = await res.json();
        setFacebookSettings({
          pauseDailyReportFacebook: settings.pause_daily_report_facebook === '1',
          pauseEmailDigestFacebook: settings.pause_email_digest_facebook === '1',
          pauseCustomFacebook: settings.pause_custom_facebook === '1',
        });
      }
    } catch (e) {
      console.error('Failed to fetch system settings', e);
    }
  };

  const handleSettingToggle = async (key: 'pause_daily_report_facebook' | 'pause_email_digest_facebook' | 'pause_custom_facebook', currentValue: boolean) => {
    const newValue = !currentValue;
    const stateKey = key === 'pause_daily_report_facebook' 
      ? 'pauseDailyReportFacebook' 
      : key === 'pause_email_digest_facebook' 
      ? 'pauseEmailDigestFacebook' 
      : 'pauseCustomFacebook';

    setFacebookSettings(prev => ({ ...prev, [stateKey]: newValue }));

    try {
      setUpdatingSettings(true);
      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue ? '1' : '0' }),
      });
      if (!res.ok) {
        // Revert on failure
        setFacebookSettings(prev => ({ ...prev, [stateKey]: currentValue }));
        alert('Failed to update system setting');
      }
    } catch (e) {
      // Revert on failure
      setFacebookSettings(prev => ({ ...prev, [stateKey]: currentValue }));
      console.error(e);
      alert('Failed to update system setting');
    } finally {
      setUpdatingSettings(false);
    }
  };

  useEffect(() => {
    fetchSources();
    checkGmailStatus();
    fetchSubscriptions();
    fetchSettings();

    const handleConnected = () => {
      checkGmailStatus();
    };

    window.addEventListener('gmail-connected', handleConnected);
    return () => {
      window.removeEventListener('gmail-connected', handleConnected);
    };
  }, [fetchSources, checkGmailStatus, fetchSubscriptions]);

  // Facebook Custom Posts Management States
  const [customPosts, setCustomPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    post: any | null;
    title: string;
    content: string;
  }>({
    isOpen: false,
    post: null,
    title: '',
    content: ''
  });
  const [submittingPost, setSubmittingPost] = useState(false);

  // AI Custom Post Styling States
  const [stylingTone, setStylingTone] = useState<'howard_marks' | 'engaging' | 'analytical' | 'concise'>('engaging');
  const [stylingInstructions, setStylingInstructions] = useState('');
  const [stylingLoading, setStylingLoading] = useState(false);
  const [originalContent, setOriginalContent] = useState('');

  const handleStyleContent = async () => {
    if (!editorState.content.trim()) return;
    try {
      setStylingLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/facebook/posts/style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editorState.content,
          tone: stylingTone,
          instructions: stylingInstructions
        }),
      });
      const data = await res.json();
      if (data.success && data.styledContent) {
        setOriginalContent(editorState.content);
        setEditorState(prev => ({
          ...prev,
          content: data.styledContent
        }));
      } else {
        alert(`Failed to style content: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Failed to style custom post content', e);
      alert('Error styling custom post content');
    } finally {
      setStylingLoading(false);
    }
  };

  const handleUndoStyling = () => {
    if (originalContent) {
      setEditorState(prev => ({
        ...prev,
        content: originalContent
      }));
      setOriginalContent('');
    }
  };

  const fetchCustomPosts = async () => {
    try {
      setLoadingPosts(true);
      const res = await fetch(`${API_BASE_URL}/api/facebook/posts`);
      if (res.ok) {
        const data = await res.json();
        setCustomPosts(data);
      }
    } catch (e) {
      console.error('Failed to fetch custom posts', e);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleOpenCreatePost = () => {
    setEditorState({
      isOpen: true,
      post: null,
      title: '',
      content: ''
    });
    setOriginalContent('');
    setStylingInstructions('');
    setStylingTone('engaging');
  };

  const handleOpenEditPost = (post: any) => {
    setEditorState({
      isOpen: true,
      post,
      title: post.thai_title || '',
      content: post.thai_content || ''
    });
    setOriginalContent('');
    setStylingInstructions('');
    setStylingTone('engaging');
  };

  const handleSavePost = async (status: 'draft' | 'pending') => {
    if (!editorState.content.trim()) {
      alert('Post content cannot be empty');
      return;
    }
    try {
      setSubmittingPost(true);
      const payload = {
        title: editorState.title,
        content: editorState.content,
        status
      };
      
      let url = `${API_BASE_URL}/api/facebook/posts`;
      let method = 'POST';
      
      if (editorState.post) {
        url = `${API_BASE_URL}/api/facebook/posts/${editorState.post.id}`;
        method = 'PUT';
      }
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        setEditorState(prev => ({ ...prev, isOpen: false }));
        fetchCustomPosts();
      } else {
        alert('Failed to save custom post');
      }
    } catch (e) {
      console.error('Failed to save custom post', e);
      alert('Error saving custom post');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleDeletePost = async (id: number) => {
    if (!confirm('Are you sure you want to delete this custom post?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/facebook/posts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchCustomPosts();
      } else {
        alert('Failed to delete custom post');
      }
    } catch (e) {
      console.error('Failed to delete custom post', e);
    }
  };

  const handlePostNow = async (id: number, contentOverride?: string) => {
    if (!confirm('Post this immediately to Facebook?')) return;
    try {
      setSubmittingPost(true);
      const res = await fetch(`${API_BASE_URL}/api/facebook/posts/${id}/post-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contentOverride || editorState.content }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Successfully posted to Facebook Page!');
        setEditorState(prev => ({ ...prev, isOpen: false }));
        fetchCustomPosts();
      } else {
        alert(`Failed to post to Facebook: ${data.error}`);
      }
    } catch (e) {
      console.error('Failed to post custom post immediately', e);
      alert('Error posting to Facebook');
    } finally {
      setSubmittingPost(false);
    }
  };

  useEffect(() => {
    if (index === 2) {
      fetchCustomPosts();
    }
  }, [index]);

  // Web/RSS actions
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

  // Gmail OAuth / Subscriptions Actions
  const handleConnectGmail = async () => {
    try {
      await connectGmail();
    } catch (e) {
      console.error('Failed to initiate Google OAuth', e);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Disconnect from Gmail? This will stop email subscription updates.')) return;
    try {
      await disconnectGmail();
    } catch (e) {
      console.error('Failed to disconnect Gmail', e);
    }
  };

  const handleSaveSub = async (sub: any) => {
    try {
      await saveSubscription(sub);
      setEditingSub(null);
    } catch (e) {
      console.error('Failed to save subscription', e);
    }
  };

  const handleDeleteSub = async (id: number) => {
    if (!confirm('Delete this email subscription?')) return;
    try {
      await deleteSubscription(id);
    } catch (e) {
      console.error('Failed to delete subscription', e);
    }
  };

  const handleSyncEmails = async () => {
    try {
      const res = await syncEmails();
      if (res.ok) {
        alert('Gmail sync and AI summarization task started in background.');
      }
    } catch (e) {
      console.error('Failed to sync emails', e);
    }
  };

  const handleTestDigest = async () => {
    try {
      const res = await testDigest();
      if (res.ok) {
        alert('Email digest generated successfully!');
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Failed to generate digest: ${errorData.error}`);
      }
    } catch (e) {
      console.error('Failed to run test email digest', e);
      alert('Network or server error during digest generation.');
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
          <Tab disableIndicator sx={{ px: 3, borderRadius: '8px' }}>
            <Facebook size={16} style={{ marginRight: 8 }} />
            Facebook Page
          </Tab>
        </TabList>

        <TabPanel value={0} sx={{ p: 0 }}>
          {/* Tab 1: Web & RSS Crawler */}
          {/* Crawler & Report Generation Control Panel */}
          <Sheet
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: '16px',
              bgcolor: 'background.surface',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              mb: 4
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
                    justifyContent: 'center'
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
                      loading={actionsLoading.syncing}
                      startDecorator={<Play size={16} />}
                      sx={{ borderRadius: '12px' }}
                    >
                      Sync Now
                    </Button>
                    <Button
                      variant="soft"
                      color="warning"
                      onClick={handleTestDigest}
                      loading={actionsLoading.testing}
                      startDecorator={<Sparkles size={16} />}
                      sx={{ borderRadius: '12px' }}
                    >
                      Test Digest
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
                onClick={() => setEditingSub('new')}
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

        <TabPanel value={2} sx={{ p: 0 }}>
          {/* Tab 3: Facebook Page Settings & Custom Content Queue */}
          <Stack spacing={4}>
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
              <Stack spacing={3}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: '12px',
                      bgcolor: 'rgba(24, 119, 242, 0.15)',
                      color: '#1877f2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Facebook size={24} />
                  </Box>
                  <Box>
                    <Typography level="title-md">Facebook Auto-Posting Controls</Typography>
                    <Typography level="body-sm" sx={{ opacity: 0.6 }}>
                      Manage auto-publishing of summaries, digests, and custom posts to the Facebook page.
                    </Typography>
                  </Box>
                </Stack>

                <Divider sx={{ opacity: 0.1 }} />

                <Grid container spacing={3}>
                  <Grid xs={12} md={4}>
                    <Sheet
                      variant="soft"
                      sx={{
                        p: 2.5,
                        borderRadius: '12px',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                        gap: 2
                      }}
                    >
                      <Box>
                        <FormLabel sx={{ fontWeight: 700, mb: 0.5 }}>Pause Daily Reports Posting</FormLabel>
                        <Typography level="body-xs" sx={{ opacity: 0.5 }}>
                          When enabled, daily stock reports will not be queued or published to Facebook.
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto' }}>
                        <Switch
                          checked={facebookSettings.pauseDailyReportFacebook}
                          onChange={() => handleSettingToggle('pause_daily_report_facebook', facebookSettings.pauseDailyReportFacebook)}
                          disabled={updatingSettings}
                          color={facebookSettings.pauseDailyReportFacebook ? "danger" : "neutral"}
                        />
                      </Box>
                    </Sheet>
                  </Grid>

                  <Grid xs={12} md={4}>
                    <Sheet
                      variant="soft"
                      sx={{
                        p: 2.5,
                        borderRadius: '12px',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                        gap: 2
                      }}
                    >
                      <Box>
                        <FormLabel sx={{ fontWeight: 700, mb: 0.5 }}>Pause Email Digests Posting</FormLabel>
                        <Typography level="body-xs" sx={{ opacity: 0.5 }}>
                          When enabled, category email digests will not be queued or published to Facebook.
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto' }}>
                        <Switch
                          checked={facebookSettings.pauseEmailDigestFacebook}
                          onChange={() => handleSettingToggle('pause_email_digest_facebook', facebookSettings.pauseEmailDigestFacebook)}
                          disabled={updatingSettings}
                          color={facebookSettings.pauseEmailDigestFacebook ? "danger" : "neutral"}
                        />
                      </Box>
                    </Sheet>
                  </Grid>

                  <Grid xs={12} md={4}>
                    <Sheet
                      variant="soft"
                      sx={{
                        p: 2.5,
                        borderRadius: '12px',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                        gap: 2
                      }}
                    >
                      <Box>
                        <FormLabel sx={{ fontWeight: 700, mb: 0.5 }}>Pause Custom Posts Posting</FormLabel>
                        <Typography level="body-xs" sx={{ opacity: 0.5 }}>
                          When enabled, manual custom posts will not be auto-published to Facebook.
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto' }}>
                        <Switch
                          checked={facebookSettings.pauseCustomFacebook}
                          onChange={() => handleSettingToggle('pause_custom_facebook', facebookSettings.pauseCustomFacebook)}
                          disabled={updatingSettings}
                          color={facebookSettings.pauseCustomFacebook ? "danger" : "neutral"}
                        />
                      </Box>
                    </Sheet>
                  </Grid>
                </Grid>
              </Stack>
            </Sheet>

            {/* Custom Posts Queue */}
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography level="title-md">Custom Standalone Posts</Typography>
                  <Typography level="body-xs" sx={{ opacity: 0.6 }}>
                    Draft and manage standalone posts to be published on the Facebook page.
                  </Typography>
                </Box>
                <Button
                  variant="soft"
                  color="primary"
                  startDecorator={<Plus size={18} />}
                  onClick={handleOpenCreatePost}
                  sx={{ borderRadius: '12px' }}
                >
                  Create Custom Post
                </Button>
              </Stack>

              <Sheet sx={{ ...glassStyle, overflow: 'hidden' }}>
                <Table sx={{ '& tr > *': { borderBottom: '1px solid var(--joy-palette-divider)' } }}>
                  <thead>
                    <tr>
                      <th style={{ background: 'transparent' }}>Title</th>
                      <th style={{ background: 'transparent', width: '120px' }}>Status</th>
                      <th style={{ background: 'transparent', width: '180px' }}>Created At</th>
                      <th style={{ background: 'transparent', textAlign: 'right', width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingPosts ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>
                          <Typography sx={{ opacity: 0.6 }}>Loading custom posts...</Typography>
                        </td>
                      </tr>
                    ) : customPosts.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>
                          <Typography sx={{ opacity: 0.6 }}>No custom posts configured.</Typography>
                        </td>
                      </tr>
                    ) : (
                      customPosts.map((post) => (
                        <tr key={post.id}>
                          <td>
                            <Typography level="title-sm" sx={{ cursor: 'pointer' }} onClick={() => handleOpenEditPost(post)}>
                              {post.thai_title || '(Untitled Custom Post)'}
                            </Typography>
                            <Typography level="body-xs" sx={{ opacity: 0.5 }} noWrap>
                              {post.thai_content ? (post.thai_content.substring(0, 80) + (post.thai_content.length > 80 ? '...' : '')) : 'No content'}
                            </Typography>
                          </td>
                          <td>
                            <Chip
                              size="sm"
                              variant="soft"
                              color={
                                post.status === 'posted'
                                  ? 'success'
                                  : post.status === 'pending'
                                  ? 'warning'
                                  : post.status === 'failed'
                                  ? 'danger'
                                  : 'neutral'
                              }
                            >
                              {post.status === 'posted'
                                ? 'Posted'
                                : post.status === 'pending'
                                ? 'Queued'
                                : post.status === 'failed'
                                ? 'Failed'
                                : 'Draft'}
                            </Chip>
                          </td>
                          <td>
                            <Typography level="body-xs">
                              {post.created_at ? new Date(post.created_at * 1000).toLocaleString() : 'N/A'}
                            </Typography>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <IconButton size="sm" variant="plain" color="neutral" onClick={() => handleOpenEditPost(post)}>
                              <Edit size={16} />
                            </IconButton>
                            <IconButton size="sm" variant="plain" color="danger" onClick={() => handleDeletePost(post.id)}>
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
          </Stack>
        </TabPanel>
      </Tabs>

      {/* Web Source Modal */}
      <SourceModal
        open={!!editingSource}
        onClose={() => setEditingSource(null)}
        source={editingSource === 'new' ? null : editingSource}
        onSave={handleSaveSource}
      />

      {/* Email Subscription Modal */}
      <SubscriptionModal
        open={!!editingSub}
        onClose={() => setEditingSub(null)}
        subscription={editingSub === 'new' ? null : editingSub}
        onSave={handleSaveSub}
      />

      {/* Custom Facebook Post Modal */}
      <Modal open={editorState.isOpen} onClose={() => setEditorState(prev => ({ ...prev, isOpen: false }))}>
        <ModalDialog
          sx={{
            ...glassStyle,
            width: { xs: '95%', md: '90%' },
            maxWidth: '1400px',
            p: 3,
            borderRadius: '20px'
          }}
        >
          <DialogTitle sx={{ mb: 2 }}>
            {editorState.post ? 'Edit Custom Post' : 'Create Custom Post'}
          </DialogTitle>
          <DialogContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mt: 1 }}>
              {/* Left Side: Editor */}
              <Stack spacing={2} sx={{ flex: 1 }}>
                <FormControl required>
                  <FormLabel>Post Title (for management reference)</FormLabel>
                  <Input
                    value={editorState.title}
                    onChange={(e) => setEditorState(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Tesla Q2 Earnings Analysis"
                    sx={{ borderRadius: '8px' }}
                  />
                </FormControl>

                {/* AI Styling Assistant Section */}
                <Sheet
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Sparkles size={16} style={{ color: '#e91e63' }} />
                    <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                      AI Facebook Styling Assistant
                    </Typography>
                  </Stack>
                  <Typography level="body-xs" sx={{ opacity: 0.6 }}>
                    Convert your raw draft into an engaging, formatted post rich in emojis and structure.
                  </Typography>

                  <Grid container spacing={1.5} alignItems="flex-end">
                    <Grid xs={12} sm={4}>
                      <FormControl size="sm">
                        <FormLabel>Style Tone</FormLabel>
                        <Select
                          value={stylingTone}
                          onChange={(_, newValue) => setStylingTone(newValue as any)}
                          sx={{ borderRadius: '8px' }}
                        >
                          <Option value="engaging">🔥 Engaging & Buzzing</Option>
                          <Option value="howard_marks">📝 Howard Marks Style</Option>
                          <Option value="analytical">📊 Professional Analyst</Option>
                          <Option value="concise">📰 Concise Bulletins</Option>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid xs={12} sm={8}>
                      <FormControl size="sm">
                        <FormLabel>Custom Instructions (Optional)</FormLabel>
                        <Input
                          value={stylingInstructions}
                          onChange={(e) => setStylingInstructions(e.target.value)}
                          placeholder="e.g. emphasize growth numbers, keep it brief"
                          sx={{ borderRadius: '8px' }}
                        />
                      </FormControl>
                    </Grid>
                  </Grid>

                  <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                    {originalContent && (
                      <Button
                        size="sm"
                        variant="plain"
                        color="neutral"
                        startDecorator={<RotateCcw size={16} />}
                        onClick={handleUndoStyling}
                        disabled={stylingLoading}
                      >
                        Undo Styling
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="solid"
                      color="primary"
                      startDecorator={<Sparkles size={16} />}
                      onClick={handleStyleContent}
                      loading={stylingLoading}
                      disabled={!editorState.content.trim()}
                      sx={{ borderRadius: '8px' }}
                    >
                      Style with AI
                    </Button>
                  </Stack>
                </Sheet>
                
                <FormControl required>
                  <FormLabel>Post Content (will be published to Facebook)</FormLabel>
                  <textarea
                    value={editorState.content}
                    onChange={(e) => setEditorState(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Write your Facebook post here..."
                    rows={12}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: 'inherit',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                  <Typography level="body-xs" sx={{ mt: 0.5, opacity: 0.6, alignSelf: 'flex-end' }}>
                    Characters: {editorState.content.length}
                  </Typography>
                </FormControl>
              </Stack>

              {/* Right Side: Facebook Preview Simulation */}
              <Box sx={{ width: { xs: '100%', md: '360px' } }}>
                <FormLabel sx={{ mb: 1 }}>Facebook Post Preview</FormLabel>
                <Sheet
                  variant="outlined"
                  sx={{
                    borderRadius: '12px',
                    bgcolor: 'background.surface',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    minHeight: '320px',
                  }}
                >
                  {/* Header: Page Info */}
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: '#1877f2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        boxShadow: '0 2px 8px rgba(24, 119, 242, 0.3)'
                      }}
                    >
                      <OaktreeIcon size={24} color="white" />
                    </Box>
                    <Box>
                      <Typography level="title-sm" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        Oaktree Agent
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ opacity: 0.5 }}>
                        <Typography level="body-xs">Just now</Typography>
                        <Typography level="body-xs">•</Typography>
                        <Globe size={12} />
                      </Stack>
                    </Box>
                  </Stack>

                  {/* Body Content */}
                  <Box
                    sx={{
                      flex: 1,
                      overflowY: 'auto',
                      maxHeight: '220px',
                      whiteSpace: 'pre-wrap',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      color: 'text.primary',
                      px: 0.5,
                      mb: 2,
                      '&::-webkit-scrollbar': { width: '4px' },
                      '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px' }
                    }}
                  >
                    {editorState.content || <Typography sx={{ opacity: 0.3, fontStyle: 'italic' }}>Post content preview will appear here...</Typography>}
                  </Box>

                  <Divider sx={{ opacity: 0.08, mb: 1 }} />

                  {/* Action Bar (Like, Comment, Share) */}
                  <Stack direction="row" justifyContent="space-between" sx={{ opacity: 0.6, px: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'default' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>
                      <Typography level="body-xs">Like</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'default' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                      <Typography level="body-xs">Comment</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'default' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                      <Typography level="body-xs">Share</Typography>
                    </Stack>
                  </Stack>
                </Sheet>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
              <Button variant="plain" color="neutral" onClick={() => setEditorState(prev => ({ ...prev, isOpen: false }))}>
                Cancel
              </Button>
              <Button
                variant="soft"
                color="neutral"
                onClick={() => handleSavePost('draft')}
                loading={submittingPost}
                sx={{ borderRadius: '8px' }}
              >
                Save Draft
              </Button>
              <Button
                variant="solid"
                color="warning"
                onClick={() => handleSavePost('pending')}
                loading={submittingPost}
                sx={{ borderRadius: '8px' }}
              >
                Save & Queue
              </Button>
              {editorState.post && (
                <Button
                  variant="solid"
                  color="success"
                  onClick={() => handlePostNow(editorState.post.id)}
                  loading={submittingPost}
                  sx={{ borderRadius: '8px' }}
                >
                  Post Now
                </Button>
              )}
            </Stack>
          </DialogContent>
        </ModalDialog>
      </Modal>
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
