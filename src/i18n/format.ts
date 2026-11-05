/** Swiss formatting helpers (C5): CHF via de-CH, dates dd.MM.yyyy, time zone Europe/Zurich. */
const TIME_ZONE = 'Europe/Zurich';

const chf = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' });
const integer = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('de-CH', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TIME_ZONE,
});
const time = new Intl.DateTimeFormat('de-CH', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});
const dateTime = new Intl.DateTimeFormat('de-CH', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: TIME_ZONE,
});

/** `CHF 1’000.50` */
export function formatChf(value: number): string {
  return chf.format(value);
}

/** `1’234` */
export function formatInteger(value: number): string {
  return integer.format(value);
}

/** `07.11.2026` from a UTC ISO timestamp, in Europe/Zurich. */
export function formatDate(iso: string): string {
  return date.format(new Date(iso));
}

/** `07.11.2026` from a calendar date `yyyy-MM-dd` (no time-zone shift). */
export function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match === null ? value : `${match[3] ?? ''}.${match[2] ?? ''}.${match[1] ?? ''}`;
}

/** `20:15` in Europe/Zurich. */
export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

/** `07.11.2026, 20:15:03` in Europe/Zurich. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** `1 h 05 min`, `23 min`, `< 1 min`; computed from UTC instants, so DST cannot distort it. */
export function formatDuration(milliseconds: number): string {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  if (minutes < 1) return '< 1 min';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest} min` : `${hours} h ${String(rest).padStart(2, '0')} min`;
}

/** Bytes as `12.3 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
