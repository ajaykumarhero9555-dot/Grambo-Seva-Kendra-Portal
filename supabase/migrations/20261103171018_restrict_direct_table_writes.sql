/*
# Restrict direct table access to read-only for signed-in users

## Plain-English summary
Removes the default write permissions that the database gives the browser on new tables.
All changes now have to go through the server functions, which check who is calling.

## 1. Modified tables
- `profiles`, `kyc_records`: anonymous and signed-in browser access reduced to read-only
  (signed-in users only, still filtered by row level security).
- `admin_users`: no browser access at all.

## 2. Security
- Anonymous visitors can no longer read or write any of these tables.
- Signed-in users can only read rows they are allowed to see.
- All inserts and updates happen inside the functions created in the previous migration.

## 3. Important notes
1. This change does not affect the functions, which run with owner rights.
*/

REVOKE ALL ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.kyc_records FROM anon, authenticated;
REVOKE ALL ON public.admin_users FROM anon, authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.kyc_records TO authenticated;
