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
  Divider,
  Grid,
  Select,
  Option,
} from '@mui/joy';
import {
  Globe,
  Plus,
  Trash2,
  Edit,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import { useSettingsStore, type DensityMode } from '../../../store/settingsStore';
import OaktreeIcon from '../../common/OaktreeIcon';

// Custom Facebook Icon component using standard Lucide SVG path
export const FacebookIcon = (props: any) => (
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

export interface FacebookQueueTabProps {
  density?: DensityMode;
  active?: boolean;
}

export default function FacebookQueueTab({ density: propDensity, active = true }: FacebookQueueTabProps) {
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

  // Facebook Posting & System settings
  const [facebookSettings, setFacebookSettings] = useState({
    pauseDailyReportFacebook: false,
    pauseEmailDigestFacebook: false,
    pauseCustomFacebook: false,
    pauseNotebookFacebook: false,
  });
  const [updatingSettings, setUpdatingSettings] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`);
      if (res.ok) {
        const settings = (await res.json()) as any;
        setFacebookSettings({
          pauseDailyReportFacebook: settings.pause_daily_report_facebook === '1',
          pauseEmailDigestFacebook: settings.pause_email_digest_facebook === '1',
          pauseCustomFacebook: settings.pause_custom_facebook === '1',
          pauseNotebookFacebook: settings.pause_notebook_facebook === '1',
        });
      }
    } catch (e) {
      console.error('Failed to fetch system settings', e);
    }
  };

  const handleSettingToggle = async (
    key: 'pause_daily_report_facebook' | 'pause_email_digest_facebook' | 'pause_custom_facebook' | 'pause_notebook_facebook',
    currentValue: boolean
  ) => {
    const newValue = !currentValue;
    const stateKey = key === 'pause_daily_report_facebook' 
      ? 'pauseDailyReportFacebook' 
      : key === 'pause_email_digest_facebook' 
      ? 'pauseEmailDigestFacebook' 
      : key === 'pause_notebook_facebook'
      ? 'pauseNotebookFacebook'
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
      }
    } catch (e) {
      // Revert on failure
      setFacebookSettings(prev => ({ ...prev, [stateKey]: currentValue }));
      console.error(e);
    } finally {
      setUpdatingSettings(false);
    }
  };

  // Facebook Custom Posts Management States
  const [customPosts, setCustomPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [deletePostId, setDeletePostId] = useState<number | null>(null);

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
      const data = (await res.json()) as any;
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
        const data = (await res.json()) as any;
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

  const handleDeletePost = (id: number) => {
    setDeletePostId(id);
  };

  const handleConfirmDeletePost = async () => {
    if (deletePostId === null) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/facebook/posts/${deletePostId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchCustomPosts();
      } else {
        alert('Failed to delete custom post');
      }
    } catch (e) {
      console.error('Failed to delete custom post', e);
    } finally {
      setDeletePostId(null);
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
      const data = (await res.json()) as any;
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
    fetchSettings();
  }, []);

  useEffect(() => {
    if (active) {
      fetchCustomPosts();
    }
  }, [active]);

  return (
    <Box>
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
                <FacebookIcon size={24} />
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
              <Grid xs={12} sm={6} md={3}>
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

              <Grid xs={12} sm={6} md={3}>
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

              <Grid xs={12} sm={6} md={3}>
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
                    <FormLabel sx={{ fontWeight: 700, mb: 0.5 }}>Pause Articles & Analyses</FormLabel>
                    <Typography level="body-xs" sx={{ opacity: 0.5 }}>
                      When enabled, market news and Gemini Spark analyses will not be auto-published to Facebook.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto' }}>
                    <Switch
                      checked={facebookSettings.pauseNotebookFacebook}
                      onChange={() => handleSettingToggle('pause_notebook_facebook', facebookSettings.pauseNotebookFacebook)}
                      disabled={updatingSettings}
                      color={facebookSettings.pauseNotebookFacebook ? "danger" : "neutral"}
                    />
                  </Box>
                </Sheet>
              </Grid>

              <Grid xs={12} sm={6} md={3}>
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

      {/* Delete Custom Post Confirm Modal */}
      <Modal open={deletePostId !== null} onClose={() => setDeletePostId(null)}>
        <ModalDialog sx={{ ...glassStyle, minWidth: { xs: '90%', sm: 400 }, maxWidth: 460, borderRadius: '20px', p: 3 }}>
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Trash2 size={20} color="var(--joy-palette-danger-plainColor)" />
            Confirm Deletion
          </DialogTitle>
          <DialogContent sx={{ mb: 2 }}>
            <Typography level="body-sm">
              Are you sure you want to delete this custom post? This action cannot be undone.
            </Typography>
          </DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
            <Button variant="outlined" color="neutral" size="sm" onClick={() => setDeletePostId(null)}>
              Cancel
            </Button>
            <Button variant="solid" color="danger" size="sm" onClick={handleConfirmDeletePost}>
              Delete
            </Button>
          </Box>
        </ModalDialog>
      </Modal>

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
                      maxHeight: '480px',
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
