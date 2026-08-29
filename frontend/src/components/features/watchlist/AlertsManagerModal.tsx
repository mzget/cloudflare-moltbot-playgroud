import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  ModalClose,
  FormControl,
  FormLabel,
  Input,
  Select,
  Option,
  Typography,
  Box,
  Stack,
  Button,
  FormHelperText,
  Switch,
  IconButton,
  CircularProgress,
  Chip,
} from '@mui/joy';
import { Trash2, TrendingUp, TrendingDown, Edit2, Check, X } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';

interface AlertRule {
  id: number;
  metric: string;
  condition_type: string;
  target_value: number;
  is_active: number;
  note?: string | null;
  last_checked_value?: number | null;
}

interface AlertsManagerModalProps {
  open: boolean;
  symbol: string | null;
  symbolRules: AlertRule[];
  currentSymbolStats: any;
  isLoading?: boolean;
  onClose: () => void;
  onCreateRule: (metric: string, condition: string, targetVal: number, note?: string) => Promise<void>;
  onToggleRule: (ruleId: number, currentStatus: number) => Promise<void>;
  onDeleteRule: (ruleId: number) => Promise<void>;
  onUpdateRuleTarget?: (ruleId: number, targetValue: number) => Promise<void>;
  onUpdateRuleNote?: (ruleId: number, note: string) => Promise<void>;
}

const formatMetricLabel = (m: string) => {
  switch (m) {
    case 'price': return 'Price';
    case 'market_cap': return 'Market Cap';
    case 'p_e': return 'P/E';
    case 'ev_ebit': return 'EV/EBIT';
    case 'ev_sales': return 'EV/Sales';
    default: return m;
  }
};

const formatTargetValue = (val: number | null | undefined, metric: string) => {
  if (val === null || val === undefined) {
    return 'N/A';
  }
  if (metric === 'market_cap') {
    return `$${(val / 1000).toFixed(2)}B`;
  }
  if (metric === 'price') {
    return `$${val.toFixed(2)}`;
  }
  return val.toFixed(2);
};

const formatConditionLabel = (cond: string) => {
  return cond === 'cross_up' ? 'Crosses Up' : 'Crosses Down';
};

export const AlertsManagerModal = React.memo<AlertsManagerModalProps>(({
  open,
  symbol,
  symbolRules,
  currentSymbolStats,
  isLoading = false,
  onClose,
  onCreateRule,
  onToggleRule,
  onDeleteRule,
  onUpdateRuleTarget,
  onUpdateRuleNote,
}) => {
  const [metric, setMetric] = useState('price');
  const [condition, setCondition] = useState('cross_up');
  const [target, setTarget] = useState('');
  const [newRuleNote, setNewRuleNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Note inline editing
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Target value inline editing
  const [editingTargetRuleId, setEditingTargetRuleId] = useState<number | null>(null);
  const [editingTargetText, setEditingTargetText] = useState('');
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  useEffect(() => {
    if (open) {
      setTarget('');
      setNewRuleNote('');
      setMetric('price');
      setCondition('cross_up');
      setEditingRuleId(null);
      setEditingNoteText('');
      setEditingTargetRuleId(null);
      setEditingTargetText('');
    }
  }, [open, symbol]);

  const getHelperText = useCallback((m: string) => {
    if (!currentSymbolStats) return 'No current data available';
    let val: number | null | undefined = null;
    if (m === 'price') {
      val = currentSymbolStats.price;
      return val !== null && val !== undefined ? `Current Price: $${val.toFixed(2)}` : 'Current Price: N/A';
    }
    if (m === 'market_cap') {
      val = currentSymbolStats.market_cap;
      return val !== null && val !== undefined ? `Current Market Cap: $${(val / 1000).toFixed(2)}B` : 'Current Market Cap: N/A';
    }
    if (m === 'p_e') {
      val = currentSymbolStats.p_e;
      return val !== null && val !== undefined ? `Current P/E: ${val.toFixed(2)}` : 'Current P/E: N/A';
    }
    if (m === 'ev_ebit') {
      val = currentSymbolStats.ev_ebit;
      return val !== null && val !== undefined ? `Current EV/EBIT: ${val.toFixed(2)}` : 'Current EV/EBIT: N/A';
    }
    if (m === 'ev_sales') {
      val = currentSymbolStats.ev_sales;
      return val !== null && val !== undefined ? `Current EV/Sales: ${val.toFixed(2)}` : 'Current EV/Sales: N/A';
    }
    return '';
  }, [currentSymbolStats]);

  const handleAddRule = useCallback(async () => {
    if (!target || isNaN(Number(target))) return;
    let targetVal = Number(target);
    if (metric === 'market_cap') {
      targetVal = targetVal * 1000;
    }
    setIsSubmitting(true);
    try {
      await onCreateRule(metric, condition, targetVal, newRuleNote.trim());
      setTarget('');
      setNewRuleNote('');
    } catch (e) {
      console.error('Failed to create rule', e);
    } finally {
      setIsSubmitting(false);
    }
  }, [metric, condition, target, newRuleNote, onCreateRule]);

  const handleStartEditNote = useCallback((rule: AlertRule) => {
    setEditingRuleId(rule.id);
    setEditingNoteText(rule.note || '');
  }, []);

  const handleSaveNote = useCallback(async (ruleId: number) => {
    if (!onUpdateRuleNote) return;
    setIsSavingNote(true);
    try {
      await onUpdateRuleNote(ruleId, editingNoteText.trim());
      setEditingRuleId(null);
    } catch (e) {
      console.error('Failed to update rule note', e);
    } finally {
      setIsSavingNote(false);
    }
  }, [editingNoteText, onUpdateRuleNote]);

  const handleStartEditTarget = useCallback((rule: AlertRule) => {
    setEditingTargetRuleId(rule.id);
    const displayVal = rule.metric === 'market_cap' ? (rule.target_value / 1000).toString() : rule.target_value.toString();
    setEditingTargetText(displayVal);
  }, []);

  const handleSaveTarget = useCallback(async (rule: AlertRule) => {
    if (!onUpdateRuleTarget || !editingTargetText || isNaN(Number(editingTargetText))) return;
    let targetVal = Number(editingTargetText);
    if (rule.metric === 'market_cap') {
      targetVal = targetVal * 1000;
    }
    setIsSavingTarget(true);
    try {
      await onUpdateRuleTarget(rule.id, targetVal);
      setEditingTargetRuleId(null);
    } catch (e) {
      console.error('Failed to update rule target value', e);
    } finally {
      setIsSavingTarget(false);
    }
  }, [editingTargetText, onUpdateRuleTarget]);

  if (!symbol) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          ...glassStyle,
          minWidth: { xs: '90%', sm: 480 },
          maxWidth: 520,
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          p: 3,
        }}
      >
        <ModalClose />
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.02em', mb: 1 }}>
          Alert Manager: {symbol}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Create Rule Form */}
          <Box sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
            <Typography level="title-sm" sx={{ mb: 1.5, fontWeight: 700 }}>Create New Alert</Typography>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5}>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Metric</FormLabel>
                  <Select
                    value={metric}
                    onChange={(_, val) => setMetric(val || 'price')}
                    size="sm"
                  >
                    <Option value="price">Price ($)</Option>
                    <Option value="market_cap">Market Cap ($B)</Option>
                    <Option value="p_e">P/E Ratio</Option>
                    <Option value="ev_ebit">EV/EBIT</Option>
                    <Option value="ev_sales">EV/Sales</Option>
                  </Select>
                </FormControl>

                <FormControl sx={{ flex: 1 }}>
                  <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Condition</FormLabel>
                  <Select
                    value={condition}
                    onChange={(_, val) => setCondition(val || 'cross_up')}
                    size="sm"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {selected?.value === 'cross_up' ? (
                          <TrendingUp size={16} color="var(--joy-palette-success-500, #22c55e)" />
                        ) : (
                          <TrendingDown size={16} color="var(--joy-palette-danger-500, #ef4444)" />
                        )}
                        <Typography level="body-sm">{selected?.label}</Typography>
                      </Box>
                    )}
                  >
                    <Option value="cross_up" label="Crosses Up">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TrendingUp size={16} color="var(--joy-palette-success-500, #22c55e)" />
                        <span>Crosses Up</span>
                      </Stack>
                    </Option>
                    <Option value="cross_down" label="Crosses Down">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TrendingDown size={16} color="var(--joy-palette-danger-500, #ef4444)" />
                        <span>Crosses Down</span>
                      </Stack>
                    </Option>
                  </Select>
                </FormControl>
              </Stack>

              <FormControl>
                <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Target Value</FormLabel>
                <Input
                  type="number"
                  placeholder="e.g. 150"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  size="sm"
                />
                <FormHelperText sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 500, mt: 0.5 }}>
                  {getHelperText(metric)}
                </FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Note (Optional)</FormLabel>
                <Stack direction="row" spacing={1}>
                  <Input
                    placeholder="e.g. Target dip buy price, take profit level"
                    value={newRuleNote}
                    onChange={(e) => setNewRuleNote(e.target.value)}
                    size="sm"
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="solid"
                    color="success"
                    onClick={handleAddRule}
                    loading={isSubmitting}
                    size="sm"
                  >
                    Add
                  </Button>
                </Stack>
              </FormControl>
            </Stack>
          </Box>

          {/* Existing Rules List */}
          <Box>
            <Typography level="title-sm" sx={{ mb: 1.5, fontWeight: 700 }}>Active Rules</Typography>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <CircularProgress size="sm" variant="plain" />
              </Box>
            ) : symbolRules.length === 0 ? (
              <Typography level="body-sm" sx={{ color: 'text.tertiary', fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                No alert rules set for this symbol.
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ maxHeight: 240, overflowY: 'auto', pr: 0.5 }}>
                {symbolRules.map((rule) => (
                  <Box
                    key={rule.id}
                    sx={{
                      p: 1.5,
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      bgcolor: rule.is_active ? 'transparent' : 'rgba(0,0,0,0.02)',
                      opacity: rule.is_active ? 1 : 0.7,
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                          {formatMetricLabel(rule.metric)}
                        </Typography>
                        <Chip
                          size="sm"
                          variant="soft"
                          color={rule.condition_type === 'cross_up' ? 'success' : 'danger'}
                          startDecorator={
                            rule.condition_type === 'cross_up' ? (
                              <TrendingUp size={14} />
                            ) : (
                              <TrendingDown size={14} />
                            )
                          }
                          sx={{ fontWeight: 600, fontSize: '0.75rem', px: 0.75, py: 0.2 }}
                        >
                          {formatConditionLabel(rule.condition_type)}
                        </Chip>
                        {/* Editable Target Value */}
                        {editingTargetRuleId === rule.id ? (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Input
                              type="number"
                              size="sm"
                              value={editingTargetText}
                              onChange={(e) => setEditingTargetText(e.target.value)}
                              placeholder="Target"
                              autoFocus
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  await handleSaveTarget(rule);
                                } else if (e.key === 'Escape') {
                                  setEditingTargetRuleId(null);
                                }
                              }}
                              sx={{ width: 85, height: 26, fontSize: '0.75rem', px: 1 }}
                            />
                            <IconButton
                              size="sm"
                              variant="soft"
                              color="success"
                              onClick={() => handleSaveTarget(rule)}
                              loading={isSavingTarget}
                              sx={{ minWidth: 24, minHeight: 24, p: 0.25 }}
                            >
                              <Check size={13} />
                            </IconButton>
                            <IconButton
                              size="sm"
                              variant="plain"
                              color="neutral"
                              onClick={() => setEditingTargetRuleId(null)}
                              disabled={isSavingTarget}
                              sx={{ minWidth: 24, minHeight: 24, p: 0.25 }}
                            >
                              <X size={13} />
                            </IconButton>
                          </Stack>
                        ) : (
                          <Box
                            onClick={() => handleStartEditTarget(rule)}
                            title="Click to edit target value"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                              cursor: 'pointer',
                              px: 0.5,
                              py: 0.2,
                              borderRadius: '4px',
                              transition: 'all 0.15s ease',
                              '&:hover': {
                                bgcolor: 'rgba(255, 255, 255, 0.08)',
                                color: 'primary.softColor',
                              },
                            }}
                          >
                            <Typography level="body-sm" sx={{ fontWeight: 700, color: 'inherit' }}>
                              {formatTargetValue(rule.target_value, rule.metric)}
                            </Typography>
                            <Edit2 size={11} style={{ opacity: 0.45, flexShrink: 0 }} />
                          </Box>
                        )}
                      </Stack>

                      {/* Editable Note Subtitle */}
                      {editingRuleId === rule.id ? (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                          <Input
                            size="sm"
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            placeholder="Add note..."
                            autoFocus
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                await handleSaveNote(rule.id);
                              } else if (e.key === 'Escape') {
                                setEditingRuleId(null);
                              }
                            }}
                            sx={{ flex: 1, minWidth: 120, height: 28, fontSize: '0.75rem' }}
                          />
                          <IconButton
                            size="sm"
                            variant="soft"
                            color="success"
                            onClick={() => handleSaveNote(rule.id)}
                            loading={isSavingNote}
                            sx={{ minWidth: 28, minHeight: 28 }}
                          >
                            <Check size={14} />
                          </IconButton>
                          <IconButton
                            size="sm"
                            variant="plain"
                            color="neutral"
                            onClick={() => setEditingRuleId(null)}
                            disabled={isSavingNote}
                            sx={{ minWidth: 28, minHeight: 28 }}
                          >
                            <X size={14} />
                          </IconButton>
                        </Stack>
                      ) : (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mt: 0.25,
                            cursor: 'pointer',
                            borderRadius: '4px',
                            py: 0.2,
                            px: 0.4,
                            mx: -0.4,
                            width: 'fit-content',
                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
                          }}
                          onClick={() => handleStartEditNote(rule)}
                          title="Click to edit note"
                        >
                          {rule.note ? (
                            <>
                              <Typography
                                level="body-xs"
                                sx={{
                                  color: 'text.secondary',
                                  fontWeight: 500,
                                  fontStyle: 'italic',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: { xs: 180, sm: 260 },
                                }}
                              >
                                {rule.note}
                              </Typography>
                              <Edit2 size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
                            </>
                          ) : (
                            <Typography
                              level="body-xs"
                              sx={{
                                color: 'primary.plainColor',
                                opacity: 0.8,
                                fontSize: '0.72rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <Edit2 size={10} /> + Add note
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>

                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
                      <Switch
                        size="sm"
                        checked={rule.is_active === 1}
                        onChange={() => onToggleRule(rule.id, rule.is_active)}
                        color={rule.is_active === 1 ? 'success' : 'neutral'}
                      />
                      <IconButton
                        size="sm"
                        color="danger"
                        variant="plain"
                        onClick={() => onDeleteRule(rule.id)}
                        sx={{ '&:hover': { bgcolor: 'rgba(231, 76, 60, 0.1)' } }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
});

