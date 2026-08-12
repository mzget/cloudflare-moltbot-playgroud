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
} from '@mui/joy';
import { Trash2 } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';
import type { WatchlistItem } from './hooks/useWatchlist';

interface EditSecurityModalProps {
  open: boolean;
  item: WatchlistItem | null;
  onClose: () => void;
  onSave: (
    symbol: string,
    name: string,
    type: string,
    sectorLabel: string | null,
    sectorLabelColor: string | null
  ) => Promise<boolean | void>;
  onDeleteClick: () => void;
}

const COLOR_OPTIONS = [
  { color: '', label: 'Default' },
  { color: '#10b981', label: 'Green' },
  { color: '#3b82f6', label: 'Blue' },
  { color: '#f59e0b', label: 'Amber' },
  { color: '#ef4444', label: 'Red' },
  { color: '#8b5cf6', label: 'Purple' },
  { color: '#06b6d4', label: 'Cyan' },
  { color: '#f97316', label: 'Orange' },
  { color: '#ec4899', label: 'Pink' },
];

export const EditSecurityModal = React.memo<EditSecurityModalProps>(({
  open,
  item,
  onClose,
  onSave,
  onDeleteClick,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('stock');
  const [sectorLabel, setSectorLabel] = useState('');
  const [sectorLabelColor, setSectorLabelColor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item && open) {
      setName(item.name || '');
      setType(item.type || 'stock');
      setSectorLabel(item.sector_label || '');
      setSectorLabelColor(item.sector_label_color || '');
    }
  }, [item, open]);

  const handleSave = useCallback(async () => {
    if (!item?.symbol) return;
    setIsSubmitting(true);
    try {
      await onSave(
        item.symbol,
        name,
        type,
        sectorLabel || null,
        sectorLabelColor || null
      );
      onClose();
    } catch (e) {
      console.error('Failed to save security edit', e);
    } finally {
      setIsSubmitting(false);
    }
  }, [item?.symbol, name, type, sectorLabel, sectorLabelColor, onSave, onClose]);

  if (!item) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          ...glassStyle,
          minWidth: { xs: '90%', sm: 400 },
          maxWidth: 450,
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          p: 3,
        }}
      >
        <ModalClose />
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.02em', mb: 1 }}>
          Edit Security: {item.symbol}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <FormControl>
            <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Company Name</FormLabel>
            <Input
              placeholder="Company Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              size="sm"
            />
          </FormControl>

          <FormControl>
            <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Symbol Type</FormLabel>
            <Select
              value={type}
              onChange={(_, val) => setType(val || 'stock')}
              size="sm"
            >
              <Option value="stock">Stock</Option>
              <Option value="etf">ETF</Option>
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Sector / Business Type Label</FormLabel>
            <Input
              placeholder="e.g. Healthcare, Tech Growth, REIT"
              value={sectorLabel}
              onChange={(e) => setSectorLabel(e.target.value)}
              size="sm"
              endDecorator={
                sectorLabel ? (
                  <Typography level="body-xs" sx={{ color: sectorLabelColor || 'text.tertiary', fontWeight: 600 }}>
                    preview
                  </Typography>
                ) : null
              }
            />
          </FormControl>

          <FormControl>
            <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Label Color</FormLabel>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
              {COLOR_OPTIONS.map(({ color, label }) => (
                <Box
                  key={label}
                  onClick={() => setSectorLabelColor(color)}
                  title={label}
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: color || 'text.tertiary',
                    cursor: 'pointer',
                    border: sectorLabelColor === color
                      ? '2.5px solid white'
                      : '2px solid transparent',
                    boxShadow: sectorLabelColor === color
                      ? '0 0 0 2px ' + (color || '#888')
                      : 'none',
                    transition: 'all 0.15s ease',
                    '&:hover': { transform: 'scale(1.15)' },
                  }}
                />
              ))}
            </Box>
          </FormControl>

          <Stack direction="row" spacing={1.5} justifyContent="space-between" sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              color="danger"
              startDecorator={<Trash2 size={16} />}
              onClick={onDeleteClick}
              size="sm"
            >
              Delete
            </Button>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="plain"
                color="neutral"
                onClick={onClose}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                color="success"
                onClick={handleSave}
                loading={isSubmitting}
                size="sm"
              >
                Save
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
});
