/*
# Let users resubmit only the document that still needs review

## Plain-English summary
The KYC submission function now accepts PAN and Aadhaar separately. If one document is already
verified, the user can leave it blank and submit only the other one. Verified details still
cannot be changed.

## 1. Modified functions
- `submit_kyc`: both inputs are optional. A blank input keeps the verified value on file.
  A blank input for a document that is not yet verified is rejected.

## 2. Security
- Same checks as before: signed-in users only, suspended accounts blocked, formats validated
  on the server, verified details locked.
- Access rules are unchanged; the function is re-granted to signed-in users only.

## 3. Important notes
1. Only the last 4 digits of Aadhaar are stored, so a verified Aadhaar cannot be re-entered
   from the stored value. A blank Aadhaar input keeps the stored last 4 digits.
*/

DROP FUNCTION IF EXISTS public.submit_kyc(text, text);

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
  IF v_account_status <> 'active' THEN
    RAISE EXCEPTION 'Account is suspended';
  END IF;

  SELECT * INTO v_existing FROM public.kyc_records WHERE user_id = v_uid;
  v_has_existing := FOUND;

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
