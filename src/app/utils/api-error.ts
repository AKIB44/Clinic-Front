// Turn a backend error response into a human-readable message.
//
// Joi validation failures come back as:
//   { error: 'Validation failed', details: ['"bp_diastolic" must be greater than or equal to 30', …] }
// This surfaces the specific `details` (with tidied field names) instead of the
// opaque top-level "Validation failed".

const FIELD_ACRONYMS = /\b(bp|inr|npo|spo2|dob|id|url|gst|tpa)\b/gi;

function humanizeField(field: string): string {
  const words = field.replace(/_/g, ' ').trim();
  const cased = words.replace(FIELD_ACRONYMS, (m) => m.toUpperCase());
  return cased.charAt(0).toUpperCase() + cased.slice(1);
}

function humanizeDetail(detail: string): string {
  // Replace the quoted field name Joi emits, e.g. "bp_diastolic" → BP diastolic.
  return detail.replace(/"([a-z0-9_]+)"/gi, (_, f) => humanizeField(f));
}

/**
 * Best human-readable message for an HttpErrorResponse-like error.
 * Prefers validation `details`, then a plain `error`/`message`, then `fallback`.
 */
export function formatApiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = (err as { error?: { error?: string; message?: string; details?: unknown } })?.error;
  if (e && Array.isArray(e.details) && e.details.length) {
    return e.details.map((d) => humanizeDetail(String(d))).join(' · ');
  }
  return e?.error ?? e?.message ?? fallback;
}
