import * as React from 'react';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/joy';
import { computeMarginOfSafety } from '@oaktree/shared';
import { formatMosLabel, rangeBarLayout, zoneColor } from '../../utils/marginOfSafety';

export interface ScenarioRangeBarProps {
  /** Current market price. */
  price: number | null | undefined;
  bear?: number | null;
  base?: number | null;
  bull?: number | null;
  /** Compact: thin bar with tooltips only (for cards/tables). */
  compact?: boolean;
}

const ZONE_LABEL: Record<string, string> = {
  below_bear: 'Below Bear (deep value)',
  bear_to_base: 'Between Bear and Base',
  base_to_bull: 'Between Base and Bull',
  above_bull: 'Above Bull (overvalued)',
};

const fmtPrice = (n: number) => `$${n.toFixed(2)}`;

export default function ScenarioRangeBar({ price, bear, base, bull, compact = false }: ScenarioRangeBarProps) {
  const layout = rangeBarLayout({ price, bear, base, bull });
  const mos = computeMarginOfSafety({ price, bear, base, bull });

  if (!layout) {
    return (
      <Typography level="body-xs" sx={{ color: 'text.tertiary', fontStyle: 'italic' }}>
        Unvalued (ยังไม่ได้ประเมิน)
      </Typography>
    );
  }

  const markers = [
    { key: 'bear', label: 'Bear', value: bear, pct: layout.bearPct, color: '#10b981', mos: mos.mosBear },
    { key: 'base', label: 'Base', value: base, pct: layout.basePct, color: '#3b82f6', mos: mos.mosBase },
    { key: 'bull', label: 'Bull', value: bull, pct: layout.bullPct, color: '#f59e0b', mos: mos.mosBull },
  ].filter((m) => m.pct !== null && m.value != null);

  // Zone-colored track (success → warning → danger) only when all three scenarios exist.
  const track =
    layout.bearPct !== null && layout.basePct !== null && layout.bullPct !== null
      ? (() => {
          const [a, b, c] = [layout.bearPct, layout.basePct, layout.bullPct].sort((x, y) => x - y);
          return `linear-gradient(90deg,
            rgba(16,185,129,0.55) 0%, rgba(16,185,129,0.55) ${a}%,
            rgba(250,204,21,0.55) ${a}%, rgba(250,204,21,0.55) ${b}%,
            rgba(249,115,22,0.55) ${b}%, rgba(249,115,22,0.55) ${c}%,
            rgba(239,68,68,0.55) ${c}%, rgba(239,68,68,0.55) 100%)`;
        })()
      : 'linear-gradient(90deg, rgba(148,163,184,0.35), rgba(148,163,184,0.35))';

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ position: 'relative', height: compact ? 22 : 36, mx: 1 }}>
        {/* track */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: compact ? 4 : 8,
            height: compact ? 6 : 8,
            borderRadius: '999px',
            background: track,
          }}
        />
        {/* scenario ticks */}
        {markers.map((m) => (
          <Tooltip
            key={m.key}
            arrow
            title={`${m.label} ${fmtPrice(m.value as number)} · MoS ${formatMosLabel(m.mos, true)}`}
          >
            <Box
              sx={{
                position: 'absolute',
                left: `${m.pct}%`,
                bottom: compact ? 1 : 4,
                width: 3,
                height: compact ? 12 : 16,
                ml: '-1.5px',
                borderRadius: '2px',
                bgcolor: m.color,
              }}
            />
          </Tooltip>
        ))}
        {/* current price pin */}
        <Tooltip arrow title={`Price ${fmtPrice(price as number)} · ${ZONE_LABEL[mos.zone ?? ''] ?? 'Zone n/a'}`}>
          <Box
            sx={{
              position: 'absolute',
              left: `${layout.pricePct}%`,
              top: 0,
              ml: '-5px',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '8px solid var(--joy-palette-text-primary)',
            }}
          />
        </Tooltip>
      </Box>

      {!compact && (
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.75 }} alignItems="center">
          <Chip size="sm" variant="solid" color={zoneColor(mos.zone)} sx={{ fontWeight: 700 }}>
            Price {fmtPrice(price as number)}
            {mos.zone ? ` · ${ZONE_LABEL[mos.zone]}` : ''}
          </Chip>
          {markers.map((m) => (
            <Chip
              key={m.key}
              size="sm"
              variant="soft"
              color={m.mos !== null && m.mos >= 0 ? 'success' : m.mos !== null ? 'danger' : 'neutral'}
              startDecorator={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: m.color }} />}
              sx={{ fontWeight: 600 }}
            >
              {m.label} {fmtPrice(m.value as number)} · MoS {formatMosLabel(m.mos, true)}
            </Chip>
          ))}
        </Stack>
      )}
    </Box>
  );
}
