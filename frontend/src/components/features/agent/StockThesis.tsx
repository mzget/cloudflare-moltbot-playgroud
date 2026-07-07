import * as React from 'react';
import {
  Box, Sheet, Typography, Stack, Divider, Input, Textarea, Button,
  Select, Option, Grid, IconButton, Alert, CircularProgress, Badge
} from '@mui/joy';
import {
  BookOpen, Plus, Trash2, Save, Calendar, Check,
  AlertTriangle, Play, FileText, Send, Eye, Edit2
} from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import MarkdownRenderer from '../../common/MarkdownRenderer';

interface StockThesisProps {
  symbol: string;
}

interface Thesis {
  id: number;
  symbol: string;
  title: string;
  buy_price: number | null;
  sell_price: number | null;
  conviction: 'High' | 'Medium' | 'Low';
  status: 'Active' | 'Closed' | 'Invalidated';
  catalysts: string | null;
  risks: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface JournalEntry {
  id: number;
  thesis_id: number;
  content: string;
  created_at: string;
}

export default function StockThesis({ symbol }: StockThesisProps) {
  const [theses, setTheses] = React.useState<Thesis[]>([]);
  const [selectedThesis, setSelectedThesis] = React.useState<Thesis | null>(null);
  const [journalEntries, setJournalEntries] = React.useState<JournalEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [journalLoading, setJournalLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form states for edits
  const [title, setTitle] = React.useState('');
  const [buyPrice, setBuyPrice] = React.useState<string>('');
  const [sellPrice, setSellPrice] = React.useState<string>('');
  const [conviction, setConviction] = React.useState<'High' | 'Medium' | 'Low'>('Medium');
  const [status, setStatus] = React.useState<'Active' | 'Closed' | 'Invalidated'>('Active');
  const [catalysts, setCatalysts] = React.useState('');
  const [risks, setRisks] = React.useState('');
  const [note, setNote] = React.useState('');
  const [previewMode, setPreviewMode] = React.useState(false);

  // New Journal Entry state
  const [newJournalContent, setNewJournalContent] = React.useState('');

  const fetchTheses = async (selectId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/theses?symbol=${symbol}`);
      if (!res.ok) throw new Error('Failed to fetch stock theses');
      const data = (await res.json()) as Thesis[];
      setTheses(data);

      if (data.length > 0) {
        // Select either the requested thesis or the first one
        const toSelect = selectId ? data.find((t: Thesis) => t.id === selectId) || data[0] : data[0];
        handleSelectThesis(toSelect);
      } else {
        setSelectedThesis(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchJournal = async (thesisId: number) => {
    setJournalLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/theses/${thesisId}/journal`);
      if (res.ok) {
        const data = (await res.json()) as JournalEntry[];
        setJournalEntries(data);
      }
    } catch (e) {
      console.error('Failed to fetch journal entries:', e);
    } finally {
      setJournalLoading(false);
    }
  };

  const handleSelectThesis = (thesis: Thesis) => {
    setSelectedThesis(thesis);
    setTitle(thesis.title || '');
    setBuyPrice(thesis.buy_price !== null ? thesis.buy_price.toString() : '');
    setSellPrice(thesis.sell_price !== null ? thesis.sell_price.toString() : '');
    setConviction(thesis.conviction || 'Medium');
    setStatus(thesis.status || 'Active');
    setCatalysts(thesis.catalysts || '');
    setRisks(thesis.risks || '');
    setNote(thesis.note || '');
    setPreviewMode(false);
    setNewJournalContent('');
    fetchJournal(thesis.id);
  };

  React.useEffect(() => {
    fetchTheses();
  }, [symbol]);

  const handleCreateThesis = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/theses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          title: `New Thesis for ${symbol}`,
          conviction: 'Medium',
          status: 'Active'
        })
      });
      if (!res.ok) throw new Error('Failed to create thesis');
      const data = (await res.json()) as { id: number };
      await fetchTheses(data.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveThesis = async () => {
    if (!selectedThesis) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/theses/${selectedThesis.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          buy_price: buyPrice !== '' ? Number(buyPrice) : null,
          sell_price: sellPrice !== '' ? Number(sellPrice) : null,
          conviction,
          status,
          catalysts,
          risks,
          note
        })
      });
      if (!res.ok) throw new Error('Failed to save thesis');
      
      // Update list
      setTheses(prev => prev.map(t => t.id === selectedThesis.id ? {
        ...t,
        title,
        buy_price: buyPrice !== '' ? Number(buyPrice) : null,
        sell_price: sellPrice !== '' ? Number(sellPrice) : null,
        conviction,
        status,
        catalysts,
        risks,
        note,
        updated_at: new Date().toISOString()
      } : t));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteThesis = async () => {
    if (!selectedThesis) return;
    if (!window.confirm('Are you sure you want to delete this thesis?')) return;
    
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/theses/${selectedThesis.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete thesis');
      await fetchTheses();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddJournalEntry = async () => {
    if (!selectedThesis || !newJournalContent.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/theses/${selectedThesis.id}/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newJournalContent })
      });
      if (res.ok) {
        setNewJournalContent('');
        fetchJournal(selectedThesis.id);
      }
    } catch (e) {
      console.error('Failed to add journal entry:', e);
    }
  };

  const getConvictionColor = (c: 'High' | 'Medium' | 'Low') => {
    if (c === 'High') return 'success';
    if (c === 'Medium') return 'warning';
    return 'danger';
  };

  const getStatusColor = (s: 'Active' | 'Closed' | 'Invalidated') => {
    if (s === 'Active') return 'primary';
    if (s === 'Closed') return 'neutral';
    return 'danger';
  };

  if (loading) {
    return (
      <Sheet sx={{ ...glassStyle, p: 4, minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <CircularProgress size="md" color="success" />
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>Loading Stock Thesis for {symbol}...</Typography>
      </Sheet>
    );
  }

  return (
    <Grid container spacing={3} sx={{ flexGrow: 1 }}>
      {/* LEFT PANEL - THESIS LIST */}
      <Grid xs={12} md={4} lg={3}>
        <Stack spacing={2}>
          <Button
            variant="solid"
            color="success"
            startDecorator={<Plus size={16} />}
            onClick={handleCreateThesis}
            disabled={saving}
            fullWidth
            sx={{ borderRadius: '12px', fontWeight: 700 }}
          >
            Create New Thesis
          </Button>

          <Sheet
            sx={{
              ...glassStyle,
              p: 2,
              maxHeight: '650px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}
          >
            <Typography level="title-md" sx={{ fontWeight: 800, mb: 1 }}>
              Thesis List ({theses.length})
            </Typography>

            {theses.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography level="body-sm" sx={{ opacity: 0.6 }}>No thesis created yet. Click "Create New Thesis" to start.</Typography>
              </Box>
            ) : (
              theses.map((t) => {
                const isSelected = selectedThesis?.id === t.id;
                return (
                  <Sheet
                    key={t.id}
                    onClick={() => handleSelectThesis(t)}
                    sx={{
                      p: 1.5,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: isSelected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.06)',
                      bgcolor: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.04)',
                        borderColor: isSelected ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography level="title-sm" sx={{ fontWeight: 700, color: isSelected ? 'success.plainColor' : 'text.primary' }}>
                        {t.title || 'Untitled Thesis'}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                        <Badge
                          color={getConvictionColor(t.conviction)}
                          size="sm"
                          variant="soft"
                          sx={{ textTransform: 'capitalize', borderRadius: '6px' }}
                        >
                          {t.conviction}
                        </Badge>
                        <Badge
                          color={getStatusColor(t.status)}
                          size="sm"
                          variant="solid"
                          sx={{ textTransform: 'capitalize', borderRadius: '6px' }}
                        >
                          {t.status}
                        </Badge>
                      </Stack>
                      {t.buy_price && (
                        <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                          Buy: {t.buy_price} {t.sell_price ? `| Sell: ${t.sell_price}` : ''}
                        </Typography>
                      )}
                    </Stack>
                  </Sheet>
                );
              })
            )}
          </Sheet>
        </Stack>
      </Grid>

      {/* RIGHT PANEL - DETAILED EDIT / JOURNAL */}
      <Grid xs={12} md={8} lg={9}>
        {!selectedThesis ? (
          <Sheet sx={{ ...glassStyle, p: 4, minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textAlign: 'center' }}>
            <BookOpen size={48} style={{ opacity: 0.3 }} />
            <Typography level="h4">Select or Create a Thesis</Typography>
            <Typography level="body-md" sx={{ color: 'text.secondary', maxWidth: '400px' }}>
              Choose a thesis from the sidebar to edit, write Catalysts & Risks, and view journal entries.
            </Typography>
          </Sheet>
        ) : (
          <Stack spacing={3}>
            {/* THESIS HEADER & CONTROLS */}
            <Sheet sx={{ ...glassStyle, p: 3 }}>
              {error && <Alert color="danger" sx={{ mb: 2 }}>{error}</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Input
                    variant="soft"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Thesis Title"
                    sx={{
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      bgcolor: 'transparent',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                      '& input': { px: 0 }
                    }}
                  />
                </Box>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Button
                    variant="solid"
                    color="success"
                    startDecorator={<Save size={16} />}
                    onClick={handleSaveThesis}
                    disabled={saving}
                    sx={{ borderRadius: '10px' }}
                  >
                    Save Changes
                  </Button>
                  <IconButton
                    variant="soft"
                    color="danger"
                    onClick={handleDeleteThesis}
                    disabled={saving}
                    sx={{ borderRadius: '10px' }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </Stack>
              </Stack>

              <Divider sx={{ my: 2.5, opacity: 0.1 }} />

              <Grid container spacing={2}>
                <Grid xs={12} sm={6} md={3}>
                  <Typography level="body-xs" sx={{ mb: 0.5, fontWeight: 700 }}>Status</Typography>
                  <Select
                    value={status}
                    onChange={(_, val) => setStatus(val as any)}
                    variant="soft"
                    sx={{ borderRadius: '8px' }}
                  >
                    <Option value="Active">Active</Option>
                    <Option value="Closed">Closed</Option>
                    <Option value="Invalidated">Invalidated</Option>
                  </Select>
                </Grid>

                <Grid xs={12} sm={6} md={3}>
                  <Typography level="body-xs" sx={{ mb: 0.5, fontWeight: 700 }}>Conviction</Typography>
                  <Select
                    value={conviction}
                    onChange={(_, val) => setConviction(val as any)}
                    variant="soft"
                    sx={{ borderRadius: '8px' }}
                  >
                    <Option value="High">High</Option>
                    <Option value="Medium">Medium</Option>
                    <Option value="Low">Low</Option>
                  </Select>
                </Grid>

                <Grid xs={12} sm={6} md={3}>
                  <Typography level="body-xs" sx={{ mb: 0.5, fontWeight: 700 }}>Buy Price</Typography>
                  <Input
                    type="number"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    placeholder="Enter buy price"
                    variant="soft"
                    sx={{ borderRadius: '8px' }}
                  />
                </Grid>

                <Grid xs={12} sm={6} md={3}>
                  <Typography level="body-xs" sx={{ mb: 0.5, fontWeight: 700 }}>Sell Price</Typography>
                  <Input
                    type="number"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="Enter sell price"
                    variant="soft"
                    sx={{ borderRadius: '8px' }}
                  />
                </Grid>
              </Grid>
            </Sheet>

            {/* CATALYSTS & RISKS */}
            <Grid container spacing={2}>
              <Grid xs={12} md={6}>
                <Sheet sx={{ ...glassStyle, p: 3 }}>
                  <Typography level="title-sm" sx={{ mb: 1, fontWeight: 800, color: 'success.plainColor' }}>
                    Catalysts (ปัจจัยเร่ง/บวก)
                  </Typography>
                  <Textarea
                    minRows={4}
                    value={catalysts}
                    onChange={(e) => setCatalysts(e.target.value)}
                    placeholder="ปัจจัยที่จะทำให้เกิดการเติบโตหรือปลดล็อกมูลค่า..."
                    variant="soft"
                    sx={{ borderRadius: '10px' }}
                  />
                </Sheet>
              </Grid>

              <Grid xs={12} md={6}>
                <Sheet sx={{ ...glassStyle, p: 3 }}>
                  <Typography level="title-sm" sx={{ mb: 1, fontWeight: 800, color: 'danger.plainColor' }}>
                    Risks & Red Flags (ความเสี่ยง)
                  </Typography>
                  <Textarea
                    minRows={4}
                    value={risks}
                    onChange={(e) => setRisks(e.target.value)}
                    placeholder="ความเสี่ยงที่จะทำให้ thesis พัง หรือส่งผลเสียต่อบริษัท..."
                    variant="soft"
                    sx={{ borderRadius: '10px' }}
                  />
                </Sheet>
              </Grid>
            </Grid>

            {/* DETAILED THESIS NOTE (MARKDOWN) */}
            <Sheet sx={{ ...glassStyle, p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography level="title-md" sx={{ fontWeight: 800 }}>
                  Detailed Thesis Notes (บันทึกเชิงลึก)
                </Typography>
                <Button
                  variant="plain"
                  color="neutral"
                  size="sm"
                  startDecorator={previewMode ? <Edit2 size={14} /> : <Eye size={14} />}
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  {previewMode ? 'Write Markdown' : 'Preview Output'}
                </Button>
              </Stack>

              {previewMode ? (
                <Box
                  className="markdown-body"
                  sx={{
                    p: 2,
                    minHeight: '200px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    bgcolor: 'rgba(255,255,255,0.02)'
                  }}
                >
                  {note ? (
                    <MarkdownRenderer text={note} />
                  ) : (
                    <Typography level="body-sm" sx={{ opacity: 0.5, fontStyle: 'italic' }}>No notes written yet.</Typography>
                  )}
                </Box>
              ) : (
                <Textarea
                  minRows={8}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เขียนวิเคราะห์สมมติฐาน จุดแข็ง จุดอ่อน จุดซื้อ จุดขาย ด้วย Markdown..."
                  variant="soft"
                  sx={{ borderRadius: '10px' }}
                />
              )}
            </Sheet>

            {/* JOURNAL / UPDATES LOG */}
            <Sheet sx={{ ...glassStyle, p: 3 }}>
              <Typography level="title-md" sx={{ mb: 2, fontWeight: 800 }}>
                Thesis Journal Log (บันทึกความคืบหน้า)
              </Typography>

              {/* Add journal input */}
              <Stack direction="row" spacing={1.5} sx={{ mb: 3 }}>
                <Input
                  placeholder="Add a new update or review (e.g., 'Q2 earnings match thesis', 'Reached entry level')"
                  value={newJournalContent}
                  onChange={(e) => setNewJournalContent(e.target.value)}
                  variant="soft"
                  sx={{ flexGrow: 1, borderRadius: '8px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddJournalEntry();
                  }}
                />
                <Button
                  color="primary"
                  onClick={handleAddJournalEntry}
                  startDecorator={<Send size={15} />}
                  sx={{ borderRadius: '8px' }}
                >
                  Post
                </Button>
              </Stack>

              {/* Journal timeline */}
              {journalLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size="sm" />
                </Box>
              ) : journalEntries.length === 0 ? (
                <Typography level="body-sm" sx={{ opacity: 0.5, fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                  No updates posted yet. Write progress updates above.
                </Typography>
              ) : (
                <Stack spacing={2} sx={{ position: 'relative', pl: 2, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                  {journalEntries.map((j) => (
                    <Box key={j.id} sx={{ position: 'relative' }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '-22px',
                          top: '6px',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          bgcolor: 'success.solidBg',
                          border: '2px solid',
                          borderColor: 'background.body'
                        }}
                      />
                      <Typography level="body-xs" sx={{ opacity: 0.5, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Calendar size={12} />
                        {new Date(j.created_at + 'Z').toLocaleString()}
                      </Typography>
                      <Sheet
                        variant="soft"
                        sx={{
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.04)'
                        }}
                      >
                        <Typography level="body-sm">{j.content}</Typography>
                      </Sheet>
                    </Box>
                  ))}
                </Stack>
              )}
            </Sheet>
          </Stack>
        )}
      </Grid>
    </Grid>
  );
}