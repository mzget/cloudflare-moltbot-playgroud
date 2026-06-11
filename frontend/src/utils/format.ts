export function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return '--';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

export function fmtShares(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  if (v % 1 === 0) {
    return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return v.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 4,
  });
}

export function gainClass(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (v > 0) return 'yf-positive';
  if (v < 0) return 'yf-negative';
  return '';
}
