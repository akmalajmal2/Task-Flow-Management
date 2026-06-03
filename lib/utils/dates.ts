import {
  format,
  formatDistanceToNowStrict,
  isPast,
  isToday,
  parseISO,
} from 'date-fns';

export function relativeTime(iso: string | Date) {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function shortDate(iso: string | Date) {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  return format(d, 'MMM d');
}

export function fullDate(iso: string | Date) {
  const d = typeof iso === 'string' ? parseISO(iso) : iso;
  return format(d, 'PPpp');
}

export function isOverdue(iso: string | null | undefined) {
  if (!iso) return false;
  const d = parseISO(iso);
  return isPast(d) && !isToday(d);
}

export function isDueToday(iso: string | null | undefined) {
  if (!iso) return false;
  return isToday(parseISO(iso));
}
