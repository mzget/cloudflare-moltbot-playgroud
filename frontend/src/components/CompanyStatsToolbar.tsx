import * as React from 'react';
import {
  Box,
  Chip,
  ButtonGroup,
  Button,
  Stack,
  Typography,
  Tooltip,
} from '@mui/joy';
import { X } from 'lucide-react';
import { ALL_COLUMNS } from './CompanyStatsTable';
import type { ScaleUnit } from './CompanyStatsTable';
import type { CompanyStats } from '../types/companyStats';

// ─── Props ───────────────────────────────────────────────────────────────────

interface CompanyStatsToolbarProps {
  visibleColumnIds: Array<keyof CompanyStats>;
  onToggleColumn: (id: keyof CompanyStats) => void;
  scale: ScaleUnit;
  onScaleChange: (s: ScaleUnit) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CompanyStatsToolbar({
  visibleColumnIds,
  onToggleColumn,
  scale,
  onScaleChange,
}: CompanyStatsToolbarProps) {
  // Only show chips for visible columns
  const visibleCols = ALL_COLUMNS.filter(c => visibleColumnIds.includes(c.id));
  // Hidden columns available to re-add
  const hiddenCols  = ALL_COLUMNS.filter(c => !visibleColumnIds.includes(c.id));

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        mb: 2,
      }}
    >
      {/* ── Column chips ─────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        {visibleCols.map(col => (
          <Chip
            key={col.id}
            size="sm"
            variant="soft"
            color="primary"
            onClick={() => onToggleColumn(col.id)}
            endDecorator={
              <Box
                component="span"
                onClick={(e) => { e.stopPropagation(); onToggleColumn(col.id); }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  opacity: 0.5,
                  '&:hover': { color: 'danger.plainColor', opacity: 1 },
                }}
              >
                <X size={10} />
              </Box>
            }
            sx={{ fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer' }}
          >
            {col.label}
          </Chip>
        ))}

        {/* Add-back hidden columns as greyed chips */}
        {hiddenCols.map(col => (
          <Tooltip key={col.id} title={`Show ${col.label}`} placement="top" size="sm">
            <Chip
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={() => onToggleColumn(col.id)}
              sx={{ fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer' }}
            >
              + {col.label}
            </Chip>
          </Tooltip>
        ))}
      </Box>

      {/* ── Right controls ────────────────────────────────────── */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ flexShrink: 0 }}>
        {/* Currency toggle (v1: USD only) */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography level="body-xs" sx={{ opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Currency
          </Typography>
          <Chip size="sm" variant="soft" sx={{ fontWeight: 700 }}>
            USD
          </Chip>
        </Stack>

        {/* Ownership (v1: UI only, disabled) */}
        <Tooltip title="Portfolio ownership — coming soon" size="sm">
          <Chip
            size="sm"
            variant="outlined"
            sx={{ opacity: 0.4, cursor: 'default' }}
          >
            Ownership
          </Chip>
        </Tooltip>

        {/* K / M / B selector */}
        <ButtonGroup size="sm" variant="outlined" sx={{ '--ButtonGroup-radius': '8px' }}>
          {(['K', 'M', 'B'] as ScaleUnit[]).map(s => (
            <Button
              key={s}
              onClick={() => onScaleChange(s)}
              sx={{
                minWidth: 32,
                fontWeight: 700,
                fontSize: '0.75rem',
                color: scale === s ? 'primary.plainColor' : 'text.tertiary',
                bgcolor: scale === s ? 'var(--joy-palette-primary-softBg)' : 'transparent',
                '&:hover': { bgcolor: 'background.level1' },
              }}
            >
              {s}
            </Button>
          ))}
        </ButtonGroup>
      </Stack>
    </Box>
  );
}
