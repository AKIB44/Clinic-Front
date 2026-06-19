import { format, parseISO } from 'date-fns';

/** Format an appointment ISO timestamp for display (12-hour clock). */
export function formatAppointmentTime12h(iso: string): string {
  try {
    const d = parseISO(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, 'h:mm a');
  } catch {
    return iso;
  }
}

/** Format an appointment ISO timestamp with date + time (12-hour clock). */
export function formatAppointmentDateTime12h(iso: string): string {
  try {
    const d = parseISO(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, 'EEE, d MMM yyyy · h:mm a');
  } catch {
    return iso;
  }
}

/**
 * Normalize slot time strings from the API (`14:30` or `2:30 PM`) to 12-hour display.
 */
export function formatSlotTime12h(time: string): string {
  const trimmed = time.trim();
  if (!trimmed) return trimmed;
  if (/am|pm/i.test(trimmed)) return trimmed;

  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (!match) return trimmed;

  const hour24 = +match[1];
  const minute = match[2];
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute} ${period}`;
}
