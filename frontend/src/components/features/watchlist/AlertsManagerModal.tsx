import React, { useState, useCallback } from 'react';
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
} from '@mui/joy';
import { Trash2 } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';

interface AlertRule {
  id: number;
  metric: string;
  condition_type: string;
  target_value: number;
  is_active: number;
  last_checked_value?: number | null;
}

interface AlertsManagerModalProps {
  open: boolean;
  symbol: string | null;
  symbolRules: AlertRule[];
  currentSymbolStats: any;
  onClose: () => void;
  onCreateRule: (metric: string, condition: string, targetVal: number) => Promise<void>;
  onToggleRule: (ruleId: number, currentStatus: number) => Promise<void>;
  onDeleteRule: (ruleId: number) => Promise<void>;
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
  onClose,
  onCreateRule,
  onToggleRule,
  onDeleteRule,
}) => {
  const [metric, setMetric] = useState('price');
  const [condition, setCondition] = useState('cross_up');
  const [target, setTarget] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await onCreateRule(metric, condition, targetVal);
      setTarget('');
    } catch (e) {
      console.error('Failed to create rule', e);
    } finally {
      setIsSubmitting(false);
    }
  }, [metric, condition, target, onCreateRule]);

  if (!symbol) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          ...glassStyle,
          minWidth: { xs: '90%', sm: 480 },
          maxWidth: 500,
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
            <Stack spacing={2}>
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
                  >
                    <Option value="cross_up">Crosses Up</Option>
                    <Option value="cross_down">Crosses Down</Option>
                  </Select>
                </FormControl>
              </Stack>

              <FormControl>
                <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Target Value</FormLabel>
                <Stack direction="row" spacing={1}>
                  <Input
                    type="number"
                    placeholder="e.g. 150"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
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
                <FormHelperText sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 500, mt: 0.5 }}>
                  {getHelperText(metric)}
                </FormHelperText>
              </FormControl>
            </Stack>
          </Box>

          {/* Existing Rules List */}
          <Box>
            <Typography level="title-sm" sx={{ mb: 1.5, fontWeight: 700 }}>Active Rules</Typography>
            {symbolRules.length === 0 ? (
              <Typography level="body-sm" sx={{ color: 'text.tertiary', fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                No alert rules set for this symbol.
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ maxHeight: 200, overflowY: 'auto', pr: 0.5 }}>
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
                      bgcolor: rule.is_active ? 'transparent' : 'rgba(0,0,0,0.02)',
                      opacity: rule.is_active ? 1 : 0.7,
                    }}
                  >
                    <Box>
                      <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                        {formatMetricLabel(rule.metric)} {formatConditionLabel(rule.condition_type)} {formatTargetValue(rule.target_value, rule.metric)}
                      </Typography>
                      {rule.last_checked_value !== null && rule.last_checked_value !== undefined && (
                        <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.25 }}>
                          Last Checked: {formatTargetValue(rule.last_checked_value, rule.metric)}
                        </Typography>
                      )}
                    </Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
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
