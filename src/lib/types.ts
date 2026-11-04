export type AccountStatus = 'active' | 'blocked' | 'suspended';
export type DocumentStatus = 'pending' | 'verified' | 'rejected';
export type LockType = 'portal' | 'data' | 'apps' | 'un_apps';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface KycRecord {
  user_id: string;
  pan_number: string;
  pan_status: DocumentStatus;
  pan_rejection_reason: string | null;
  aadhaar_last4: string;
  aadhaar_status: DocumentStatus;
  aadhaar_rejection_reason: string | null;
  submitted_at: string;
  updated_at: string;
  reviewed_at: string | null;
}

export interface AppFeature {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  updated_at: string;
}

export interface ScheduledFeatureUpdate {
  id: string;
  feature_keys: string[];
  enabled: boolean;
  run_at: string;
  status: 'pending' | 'applied';
}

export interface PortalLock {
  id: string;
  lock_type: LockType;
  activate_at: string;
  deactivate_at: string;
  active: boolean;
}

export const DEFAULT_FEATURES: Array<{ key: string; label: string; description: string }> = [
  { key: 'identity_verification', label: 'Identity Verification', description: 'Allow users to submit identity verification' },
  { key: 'document_resubmission', label: 'Document Resubmission', description: 'Allow users to resubmit rejected documents' },
  { key: 'aadhaar_updates', label: 'Aadhaar Updates', description: 'Allow users to update Aadhaar details' },
  { key: 'pan_updates', label: 'PAN Updates', description: 'Allow users to update PAN details' },
  { key: 'profile_editing', label: 'Profile Editing', description: 'Allow users to edit their profile' },
  { key: 'document_download', label: 'Document Download', description: 'Allow users to download documents' },
  { key: 'status_check', label: 'Status Check', description: 'Allow users to check verification status' },
  { key: 'support_chat', label: 'Support Chat', description: 'Allow users to access support chat' },
  { key: 'appointment_booking', label: 'Appointment Booking', description: 'Allow users to book appointments' },
  { key: 'sms_alerts', label: 'SMS Alerts', description: 'Allow users to receive SMS alerts' },
  { key: 'email_receipts', label: 'Email Receipts', description: 'Allow users to receive email receipts' },
  { key: 'feedback', label: 'Feedback', description: 'Allow users to submit feedback' },
];
