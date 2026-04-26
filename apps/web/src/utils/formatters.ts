/**
 * Shared utility for formatting dates and times across the dashboard.
 */

export function formatTime(isoString: string): string {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleString();
  } catch (e) {
    return isoString;
  }
}

/**
 * Formats token counts with K/M suffixes.
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Formats currency values in cents to dollars.
 */
export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
