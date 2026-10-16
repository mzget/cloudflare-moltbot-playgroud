import * as React from 'react';
import { Chip, type ChipProps } from '@mui/joy';

export type FreshnessStatus = 'active' | 'stale' | 'missing';

export interface FundamentalFreshnessBadgeProps {
  /** Freshness status derived from as_of_date (<90d: active, ≥90d: stale, null: missing) */
  status: FreshnessStatus | string;
  /** Optional filing as-of date (e.g. "2026-07-29") for title tooltip or label */
  asOfDate?: string | null;
  /** Joy UI Chip size (default: 'sm') */
  size?: ChipProps['size'];
  /** Joy UI Chip variant (default: 'soft') */
  variant?: ChipProps['variant'];
  /** Display format: 'verbose' (🟢 Active (<90d)) or 'short' (🟢 Active) */
  format?: 'short' | 'verbose';
  /** Optional Joy UI sx prop for layout overrides */
  sx?: ChipProps['sx'];
}

interface BadgeConfig {
  color: ChipProps['color'];
  label: string;
  tooltip: string;
}

const getBadgeConfig = (
  status: FreshnessStatus | string,
  asOfDate?: string | null,
  format: 'short' | 'verbose' = 'verbose'
): BadgeConfig => {
  const dateSuffix = asOfDate ? ` (As-of: ${asOfDate})` : '';

  switch (status) {
    case 'active':
      return {
        color: 'success',
        label: format === 'short' ? '🟢 Active' : '🟢 Active (<90d)',
        tooltip: `Active: Filing updated within 90 days${dateSuffix}`,
      };
    case 'stale':
      return {
        color: 'warning',
        label: format === 'short' ? '🟡 Stale' : '🟡 Stale (≥90d)',
        tooltip: `Stale: Filing is ≥ 90 days old, quarterly refresh needed${dateSuffix}`,
      };
    case 'missing':
    default:
      return {
        color: 'danger',
        label: '🔴 Missing',
        tooltip: 'Missing: No qualitative fundamental brief recorded',
      };
  }
};

export const FundamentalFreshnessBadge: React.FC<FundamentalFreshnessBadgeProps> = ({
  status,
  asOfDate,
  size = 'sm',
  variant = 'soft',
  format = 'verbose',
  sx,
}) => {
  const config = getBadgeConfig(status, asOfDate, format);

  return (
    <Chip
      size={size}
      variant={variant}
      color={config.color}
      title={config.tooltip}
      data-testid="freshness-badge"
      data-status={status}
      sx={{
        fontWeight: 600,
        fontSize: 'xs',
        letterSpacing: '0.01em',
        userSelect: 'none',
        ...sx,
      }}
    >
      {config.label}
    </Chip>
  );
};

export default FundamentalFreshnessBadge;
