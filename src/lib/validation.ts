const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_PATTERN = /^[0-9]{12}$/;

export function normalizePan(value: string): string {
  return value.replace(/\s/g, '').toUpperCase();
}

export function normalizeAadhaar(value: string): string {
  return value.replace(/\s/g, '');
}

export function isValidPan(value: string): boolean {
  return PAN_PATTERN.test(normalizePan(value));
}

export function isValidAadhaar(value: string): boolean {
  const digits = normalizeAadhaar(value);
  return AADHAAR_PATTERN.test(digits) && !['0', '1'].includes(digits[0]);
}

export function maskPan(pan: string): string {
  return `${pan.slice(0, 2)}XXXXX${pan.slice(-4)}`;
}

export function maskAadhaar(last4: string): string {
  return `XXXX XXXX ${last4}`;
}
