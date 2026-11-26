/**
 * How long ago a UTC time was, in the words Jig uses (`jig_utc_ago`): "just now", "12 min ago", "3 h ago",
 * "2 days ago"; a date with no time as "today", "yesterday" or "2 days ago"; empty when the time cannot be read.
 */
export function ago(at: string, now = Date.now()): string {
  // A date with no time (Jig writes a task's `updated_at` so): counted in whole UTC days, never in hours since midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) {
    const days = Math.floor((Date.UTC(...utcDay(now)) - Date.parse(at)) / 86400000);
    if (Number.isNaN(days)) return '';
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  }
  const s = Math.floor((now - Date.parse(at)) / 1000);
  if (Number.isNaN(s)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 172800) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} days ago`;
}

/** The UTC year, month and day of a moment. */
function utcDay(now: number): [number, number, number] {
  const d = new Date(now);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
}
