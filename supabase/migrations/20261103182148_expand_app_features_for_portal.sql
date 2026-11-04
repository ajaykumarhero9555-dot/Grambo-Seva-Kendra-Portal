/*
# Grambo Seva Kendra Portal: expand user app feature switches

## Plain-English summary
Adds ten more user app feature switches so the control panel grid can show 10-15+ toggles.
The two existing features (identity verification, document resubmission) are kept as-is.

## 1. Modified tables
- `app_features`: seeded with ten additional service-centre toggles. Existing rows are not
  changed; only new keys are inserted.

## 2. Security
- No changes. The table stays readable by signed-in users only; writes still go through
  the admin scheduling function.
*/

INSERT INTO public.app_features (key, label, description, enabled) VALUES
  ('aadhaar_updates', 'Aadhaar updates', 'Lets users update an already verified Aadhaar.', false),
  ('pan_updates', 'PAN updates', 'Lets users update an already verified PAN.', false),
  ('profile_editing', 'Profile editing', 'Lets users change their name and contact details.', true),
  ('document_download', 'Document download', 'Lets users download a copy of their verified documents.', true),
  ('status_check', 'Status check', 'Shows the live verification status to users.', true),
  ('support_chat', 'Support chat', 'Lets users start a chat with the service centre.', true),
  ('appointment_booking', 'Appointment booking', 'Lets users book an in-person slot.', true),
  ('sms_alerts', 'SMS alerts', 'Sends users a text when their status changes.', true),
  ('email_receipts', 'Email receipts', 'Emails users a receipt after verification.', true),
  ('feedback', 'Feedback', 'Lets users rate the service and leave comments.', true)
ON CONFLICT (key) DO NOTHING;
