/*
# User management, KYC verification and admin console

## Plain-English summary
Creates the core tables for user accounts and identity verification (PAN and Aadhaar),
the admin roster, and the server-side functions that users and admins call to change data.
Enables realtime so changes made by an admin appear instantly in the user app and vice versa.

## 1. New tables
- `profiles`: one row per signed-up user (name, email, account status, join date).
  `account_status` is either `active` or `suspended`.
- `kyc_records`: one row per user holding their PAN number and Aadhaar last 4 digits,
  plus the verification status and rejection reason for each document.
  The full 12-digit Aadhaar number is never stored.
- `admin_users`: the list of people allowed to open the admin console.

## 2. Automatic behavior
- A profile is created automatically whenever someone signs up.
- Users submit or resubmit KYC only through the `submit_kyc` function, which validates
  formats on the server. Verified PAN or Aadhaar details cannot be changed by the user.
- Admins review documents and change account status only through admin functions,
  which check admin rights on the server.

## 3. Security
- Row level security is enabled on every table.
- Users can read only their own profile and KYC record. Admins can read all rows.
- Nobody can write to these tables directly; all writes go through functions.
- Functions that write data run with owner rights and check the caller first.
- `admin_users` is not readable by the browser at all.

## 4. Realtime
- `profiles` and `kyc_records` are added to the realtime publication so the
  apps receive live change notifications (filtered by row-level security).

## 5. Important notes
1. The first signed-in person to call `claim_first_admin` becomes the administrator.
   After that the function does nothing.
2. Aadhaar numbers are validated and only the last 4 digits are kept, in line with
   UIDAI guidance on storing Aadhaar.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kyc_records (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pan_number text NOT NULL CHECK (pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  pan_status text NOT NULL DEFAULT 'pending' CHECK (pan_status IN ('pending', 'verified', 'rejected')),
  pan_rejection_reason text,
  aadhaar_last4 text NOT NULL CHECK (aadhaar_last4 ~ '^[0-9]{4}$'),
  aadhaar_status text NOT NULL DEFAULT 'pending' CHECK (aadhaar_status IN ('pending', 'verified', 'rejected')),
  aadhaar_rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles (created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    coalesce(NEW.email, ''),
    left(coalesce(NEW.raw_user_meta_data->>'full_name', ''), 120)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, coalesce(u.email, ''), left(coalesce(u.raw_user_meta_data->>'full_name', ''), 120)
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.kyc_records TO authenticated;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT
TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "kyc_select_own" ON public.kyc_records;
CREATE POLICY "kyc_select_own" ON public.kyc_records FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "kyc_select_admin" ON public.kyc_records;
CREATE POLICY "kyc_select_admin" ON public.kyc_records FOR SELECT
TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.submit_kyc(p_pan text, p_aadhaar text)
RETURNS public.kyc_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_account_status text;
  v_pan text := upper(btrim(coalesce(p_pan, '')));
  v_aadhaar text := regexp_replace(coalesce(p_aadhaar, ''), '\s', '', 'g');
  v_existing public.kyc_records;
  v_row public.kyc_records;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT account_status INTO v_account_status FROM public.profiles WHERE id = v_uid;
  IF v_account_status IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF v_account_status <> 'active' THEN
    RAISE EXCEPTION 'Account is suspended';
  END IF;

  IF v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' THEN
    RAISE EXCEPTION 'Invalid PAN format';
  END IF;
  IF v_aadhaar !~ '^[0-9]{12}$' OR left(v_aadhaar, 1) IN ('0', '1') THEN
    RAISE EXCEPTION 'Invalid Aadhaar number';
  END IF;

  SELECT * INTO v_existing FROM public.kyc_records WHERE user_id = v_uid;
  IF FOUND THEN
    IF v_existing.pan_status = 'verified' AND v_existing.pan_number <> v_pan THEN
      RAISE EXCEPTION 'PAN is already verified and cannot be changed';
    END IF;
    IF v_existing.aadhaar_status = 'verified' AND v_existing.aadhaar_last4 <> right(v_aadhaar, 4) THEN
      RAISE EXCEPTION 'Aadhaar is already verified and cannot be changed';
    END IF;
  END IF;

  INSERT INTO public.kyc_records (user_id, pan_number, aadhaar_last4)
  VALUES (v_uid, v_pan, right(v_aadhaar, 4))
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

CREATE OR REPLACE FUNCTION public.admin_review_kyc(
  p_user uuid,
  p_document text,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS public.kyc_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
  v_row public.kyc_records;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_document NOT IN ('pan', 'aadhaar') THEN
    RAISE EXCEPTION 'Invalid document';
  END IF;
  IF p_decision NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;
  IF p_decision = 'rejected' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required to reject a document';
  END IF;

  IF p_document = 'pan' THEN
    UPDATE public.kyc_records SET
      pan_status = p_decision,
      pan_rejection_reason = CASE WHEN p_decision = 'rejected' THEN v_reason ELSE NULL END,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    WHERE user_id = p_user
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.kyc_records SET
      aadhaar_status = p_decision,
      aadhaar_rejection_reason = CASE WHEN p_decision = 'rejected' THEN v_reason ELSE NULL END,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    WHERE user_id = p_user
    RETURNING * INTO v_row;
  END IF;

  IF v_row.user_id IS NULL THEN
    RAISE EXCEPTION 'No KYC submission found for this user';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_review_kyc(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_kyc(uuid, text, text, text) TO authenticated;

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
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Invalid account status';
  END IF;
  IF p_user = auth.uid() AND p_status = 'suspended' THEN
    RAISE EXCEPTION 'You cannot suspend your own account';
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

REVOKE EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  LOCK TABLE public.admin_users IN EXCLUSIVE MODE;

  IF EXISTS (SELECT 1 FROM public.admin_users) THEN
    RETURN false;
  END IF;

  INSERT INTO public.admin_users (user_id) VALUES (auth.uid());
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'kyc_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kyc_records;
  END IF;
END $$;
