/*
# Control panel: block vs suspend, user deletion, and user app feature switches

## Plain-English summary
Adds two distinct account restrictions (Blocked for long-term locks, Suspended for temporary
pauses), a way for admins to delete a user account, and feature switches that control what
the user app allows. Existing accounts previously shown as "Blocked" stay blocked.

## 1. Modified tables
- `profiles.account_status` accepts `active`, `blocked`, or `suspended`.
  Existing `suspended` rows become `blocked` because the console already showed them as Blocked.

## 2. New tables
- `app_features`: one row per user app feature (key, label, description, enabled flag).
  Seeded with `identity_verification` and `document_resubmission`, both enabled.
- `scheduled_feature_updates`: queued feature switch changes with a run time and status
  (`pending` or `applied`). Only admins can read it.

## 3. Modified functions
- `submit_kyc`: rejects submissions while identity verification is off, and rejects
  resubmission of rejected documents while document resubmission is off.
- `admin_set_account_status`: accepts `active`, `blocked`, or `suspended`. Admins cannot change their own status.

## 4. New functions
- `admin_delete_user`: admin-only. Deletes the sign-in account, which cascades to the profile,
  KYC record, and admin entry. Admins cannot delete themselves.
- `admin_schedule_feature_update`: admin-only. Queues a feature switch change for a chosen time,
  or applies it immediately when the time is now or in the past.
- `apply_due_feature_updates`: applies pending updates whose time has arrived. Not callable from
  the browser; the scheduler runs it.

## 5. Security
- Row level security is enabled on both new tables.
- `app_features` is readable by signed-in users only and holds no personal data.
- `scheduled_feature_updates` is readable only by admins; nobody writes to it directly.
- All new admin functions check admin rights on the server.
- `apply_due_feature_updates` is revoked from every browser role.

## 6. Realtime
- `app_features` and `scheduled_feature_updates` join the realtime publication so the user app
  and the control panel update instantly.
*/

UPDATE public.profiles SET account_status = 'blocked' WHERE account_status = 'suspended';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'blocked', 'suspended'));

CREATE TABLE IF NOT EXISTS public.app_features (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_features (key, label, description, enabled) VALUES
  ('identity_verification', 'Identity verification', 'Lets users submit or update their PAN and Aadhaar details.', true),
  ('document_resubmission', 'Document resubmission', 'Lets users resubmit a document after it was rejected.', true)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.scheduled_feature_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_keys text[] NOT NULL CHECK (cardinality(feature_keys) > 0),
  enabled boolean NOT NULL,
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);

CREATE INDEX IF NOT EXISTS scheduled_feature_updates_pending_idx
  ON public.scheduled_feature_updates (run_at) WHERE status = 'pending';

ALTER TABLE public.app_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_feature_updates ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.app_features TO authenticated;
GRANT SELECT ON public.scheduled_feature_updates TO authenticated;

DROP POLICY IF EXISTS "app_features_select_signed_in" ON public.app_features;
CREATE POLICY "app_features_select_signed_in" ON public.app_features FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "scheduled_feature_updates_select_admin" ON public.scheduled_feature_updates;
CREATE POLICY "scheduled_feature_updates_select_admin" ON public.scheduled_feature_updates FOR SELECT
TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.apply_due_feature_updates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.scheduled_feature_updates;
  v_count integer := 0;
BEGIN
  FOR v_job IN
    SELECT * FROM public.scheduled_feature_updates
    WHERE status = 'pending' AND run_at <= now()
    ORDER BY run_at
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.app_features
    SET enabled = v_job.enabled, updated_at = now()
    WHERE key = ANY (v_job.feature_keys);

    UPDATE public.scheduled_feature_updates
    SET status = 'applied', applied_at = now()
    WHERE id = v_job.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_due_feature_updates() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_schedule_feature_update(
  p_features text[],
  p_enabled boolean,
  p_run_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_features IS NULL OR cardinality(p_features) = 0 THEN
    RAISE EXCEPTION 'Select at least one feature';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'Choose whether the features should be turned on or off';
  END IF;
  IF p_run_at IS NULL THEN
    RAISE EXCEPTION 'Choose when the update should run';
  END IF;
  IF (SELECT count(*) FROM public.app_features WHERE key = ANY (p_features))
     <> (SELECT count(DISTINCT f) FROM unnest(p_features) AS f) THEN
    RAISE EXCEPTION 'Unknown feature';
  END IF;

  INSERT INTO public.scheduled_feature_updates (feature_keys, enabled, run_at, created_by)
  VALUES (p_features, p_enabled, p_run_at, auth.uid());

  IF p_run_at <= now() THEN
    PERFORM public.apply_due_feature_updates();
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_schedule_feature_update(text[], boolean, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_schedule_feature_update(text[], boolean, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(p_user uuid, p_status text)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_status NOT IN ('active', 'blocked', 'suspended') THEN
    RAISE EXCEPTION 'Invalid account status';
  END IF;
  IF p_user = auth.uid() AND p_status <> 'active' THEN
    RAISE EXCEPTION 'You cannot block or suspend your own account';
  END IF;

  UPDATE public.profiles SET account_status = p_status, updated_at = now()
  WHERE id = p_user
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  DELETE FROM auth.users WHERE id = p_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_kyc(p_pan text DEFAULT NULL, p_aadhaar text DEFAULT NULL)
RETURNS public.kyc_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_account_status text;
  v_pan_input text := nullif(upper(btrim(coalesce(p_pan, ''))), '');
  v_aadhaar_input text := nullif(regexp_replace(coalesce(p_aadhaar, ''), '\s', '', 'g'), '');
  v_pan text;
  v_aadhaar_last4 text;
  v_existing public.kyc_records;
  v_has_existing boolean;
  v_row public.kyc_records;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT account_status INTO v_account_status FROM public.profiles WHERE id = v_uid;
  IF v_account_status IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF v_account_status = 'blocked' THEN
    RAISE EXCEPTION 'Account is blocked';
  END IF;
  IF v_account_status = 'suspended' THEN
    RAISE EXCEPTION 'Account is suspended';
  END IF;

  IF NOT coalesce((SELECT enabled FROM public.app_features WHERE key = 'identity_verification'), false) THEN
    RAISE EXCEPTION 'Identity verification is currently unavailable';
  END IF;

  SELECT * INTO v_existing FROM public.kyc_records WHERE user_id = v_uid;
  v_has_existing := FOUND;

  IF v_has_existing AND (v_existing.pan_status = 'rejected' OR v_existing.aadhaar_status = 'rejected')
     AND NOT coalesce((SELECT enabled FROM public.app_features WHERE key = 'document_resubmission'), false) THEN
    RAISE EXCEPTION 'Document resubmission is currently unavailable';
  END IF;

  IF v_pan_input IS NULL THEN
    IF NOT v_has_existing OR v_existing.pan_status <> 'verified' THEN
      RAISE EXCEPTION 'Invalid PAN format';
    END IF;
    v_pan := v_existing.pan_number;
  ELSE
    IF v_pan_input !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' THEN
      RAISE EXCEPTION 'Invalid PAN format';
    END IF;
    IF v_has_existing AND v_existing.pan_status = 'verified' AND v_existing.pan_number <> v_pan_input THEN
      RAISE EXCEPTION 'PAN is already verified and cannot be changed';
    END IF;
    v_pan := v_pan_input;
  END IF;

  IF v_aadhaar_input IS NULL THEN
    IF NOT v_has_existing OR v_existing.aadhaar_status <> 'verified' THEN
      RAISE EXCEPTION 'Invalid Aadhaar number';
    END IF;
    v_aadhaar_last4 := v_existing.aadhaar_last4;
  ELSE
    IF v_aadhaar_input !~ '^[0-9]{12}$' OR left(v_aadhaar_input, 1) IN ('0', '1') THEN
      RAISE EXCEPTION 'Invalid Aadhaar number';
    END IF;
    v_aadhaar_last4 := right(v_aadhaar_input, 4);
    IF v_has_existing AND v_existing.aadhaar_status = 'verified' AND v_existing.aadhaar_last4 <> v_aadhaar_last4 THEN
      RAISE EXCEPTION 'Aadhaar is already verified and cannot be changed';
    END IF;
  END IF;

  INSERT INTO public.kyc_records (user_id, pan_number, aadhaar_last4)
  VALUES (v_uid, v_pan, v_aadhaar_last4)
  ON CONFLICT (user_id) DO UPDATE SET
    pan_number = EXCLUDED.pan_number,
    pan_status = CASE WHEN public.kyc_records.pan_status = 'verified' THEN 'verified' ELSE 'pending' END,
    pan_rejection_reason = NULL,
    aadhaar_last4 = EXCLUDED.aadhaar_last4,
    aadhaar_status = CASE WHEN public.kyc_records.aadhaar_status = 'verified' THEN 'verified' ELSE 'pending' END,
    aadhaar_rejection_reason = NULL,
    submitted_at = now(),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_kyc(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_kyc(text, text) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_features'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_features;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'scheduled_feature_updates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_feature_updates;
  END IF;
END $$;
