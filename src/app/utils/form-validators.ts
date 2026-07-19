import { Validators } from '@angular/forms';

/** Indian mobile: 10 digits starting with 6–9. */
export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

export const clinicPhoneValidators = [
  Validators.required,
  Validators.pattern(INDIAN_MOBILE_PATTERN),
];

export const clinicEmailValidators = [
  Validators.required,
  Validators.email,
];

/** Strip formatting; returns up to 10 digits (handles +91 / leading 0). */
export function normalizeIndianMobile(value: string | null | undefined): string {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}
