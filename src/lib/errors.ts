const KNOWN_MESSAGES: Array<[string, string]> = [
  ['Account is blocked', 'Your account is blocked. Please contact support.'],
  ['Account is suspended', 'Your account is temporarily suspended. Please try again later.'],
  ['Identity verification is currently unavailable', 'Identity verification is paused right now. Please check back later.'],
  ['Document resubmission is currently unavailable', 'Resubmission is paused right now. Please check back later.'],
  ['PAN is already verified', 'Your PAN is already verified and cannot be changed.'],
  ['Aadhaar is already verified', 'Your Aadhaar is already verified and cannot be changed.'],
  ['Invalid PAN format', 'Please enter a valid PAN in the format ABCDE1234F.'],
  ['Invalid Aadhaar number', 'Please enter a valid 12-digit Aadhaar number.'],
  ['A reason is required', 'Please add a reason before rejecting this document.'],
  ['cannot block or suspend your own account', 'You cannot block or suspend your own account.'],
  ['cannot delete your own account', 'You cannot delete your own account.'],
  ['Select at least one feature', 'Select at least one feature before updating.'],
  ['Not authorized', 'You do not have permission to do that.'],
  ['Not signed in', 'Your session has ended. Please sign in again.'],
];

export function getErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  const match = KNOWN_MESSAGES.find(([text]) => message.includes(text));
  if (match) return match[1];
  console.error(error);
  return fallback;
}

const AUTH_MESSAGES: Array<[string, string]> = [
  ['auth/invalid-credential', 'The email or password is incorrect.'],
  ['auth/wrong-password', 'The email or password is incorrect.'],
  ['auth/user-not-found', 'The email or password is incorrect.'],
  ['auth/email-already-in-use', 'An account with this email already exists. Try signing in.'],
  ['auth/invalid-email', 'Please enter a valid email address.'],
  ['auth/weak-password', 'Your password must be at least 6 characters.'],
  ['auth/too-many-requests', 'Too many attempts. Please wait a moment and try again.'],
  ['auth/network-request-failed', 'Network error. Please check your connection and try again.'],
];

export function getAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const match = AUTH_MESSAGES.find(([code]) => message.includes(code));
  if (match) return match[1];
  console.error(error);
  return 'Something went wrong. Please try again.';
}
