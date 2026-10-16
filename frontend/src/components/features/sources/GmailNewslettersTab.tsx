import React, { useState, useEffect } from 'react';
import { useGmailSubscriptions, type EmailSubscription } from './hooks/useGmailSubscriptions';
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
  Alert,
} from '@mui/joy';
import {
  Mail,
  Plus,
  Trash2,
  Edit,
  Link,
  Unlink,
  RefreshCw,
  Play,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { glassStyle } from '../../../styles/glass';
import { useSettingsStore, type DensityMode } from '../../../store/settingsStore';

export interface GmailNewslettersTabProps {
  density?: DensityMode;
}

export default function GmailNewslettersTab({ density: propDensity }: GmailNewslettersTabProps) {
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
    testDigest,
  } = useGmailSubscriptions();

  const [editingSub, setEditingSub] = useState<EmailSubscription | 'new' | null>(null);
  const [deleteSubId, setDeleteSubId] = useState<number | null>(null);

  useEffect(() => {
    checkGmailStatus();
    fetchSubscriptions();

    const handleConnected = () => {
      checkGmailStatus();
    };

    window.addEventListener('gmail-connected', handleConnected);
    return () => {
      window.removeEventListener('gmail-connected', handleConnected);
    };
  }, [checkGmailStatus, fetchSubscriptions]);

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

  const handleDeleteSub = (id: number) => {
    setDeleteSubId(id);
  };

  const handleConfirmDeleteSub = async () => {
    if (deleteSubId === null) return;
    try {
      await deleteSubscription(deleteSubId);
    } catch (e) {
      console.error('Failed to delete subscription', e);
    } finally {
      setDeleteSubId(null);
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
        const errorData = (await res.json().catch(() => ({ error: 'Unknown error' }))) as any;
        alert(`Failed to generate digest: ${errorData.error}`);
      }
    } catch (e) {
      console.error('Failed to run test email digest', e);
      alert('Network or server error during digest generation.');
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        {/* Connection Status Panel */}
        <Sheet
          variant="outlined"
          sx={{
            p: 3,
            borderRadius: '16px',
            bgcolor: 'background.surface',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
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
                  justifyContent: 'center',
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

      {/* Email Subscription Modal */}
      <SubscriptionModal
        open={!!editingSub}
        onClose={() => setEditingSub(null)}
        subscription={editingSub === 'new' ? null : editingSub}
        onSave={handleSaveSub}
      />

      {/* Delete Email Subscription Confirm Modal */}
      <Modal open={deleteSubId !== null} onClose={() => setDeleteSubId(null)}>
        <ModalDialog sx={{ ...glassStyle, minWidth: { xs: '90%', sm: 400 }, maxWidth: 460, borderRadius: '20px', p: 3 }}>
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Trash2 size={20} color="var(--joy-palette-danger-plainColor)" />
            Confirm Deletion
          </DialogTitle>
          <DialogContent sx={{ mb: 2 }}>
            <Typography level="body-sm">
              Are you sure you want to delete this email subscription? This action cannot be undone.
            </Typography>
          </DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
            <Button variant="outlined" color="neutral" size="sm" onClick={() => setDeleteSubId(null)}>
              Cancel
            </Button>
            <Button variant="solid" color="danger" size="sm" onClick={handleConfirmDeleteSub}>
              Delete
            </Button>
          </Box>
        </ModalDialog>
      </Modal>
    </Box>
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
    is_active: true,
  });
  const [isAdvanced, setIsAdvanced] = useState(false);

  useEffect(() => {
    if (subscription) {
      setFormData({
        ...subscription,
        is_active: !!subscription.is_active,
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
        is_active: true,
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
