/*
# Portal locks: Portal lock, Data lock, Apps lock

## Plain-English summary
Adds a table for timed portal locks. Each lock has a type (portal, data, apps), an activate
time, a deactivate time, and an active flag. A database job checks every minute and flips
the active flag on or off based on the times.

## 1. New table
- `portal_locks`: one row per lock schedule, owned by the user who created it.

## 2. New function
- `admin_set_portal_lock`: admin-only. Creates or replaces a lock schedule for a given type.

## 3. Scheduler
- `apply_due_portal_locks`: runs every minute via pg_cron, activating locks whose start time
  has arrived and deactivating locks whose end time has passed.

## 4. Security
- RLS enabled. Users can read their own locks; admins can read all.
- Writes go through the admin function only.
*/

CREATE TABLE IF NOT EXISTS public.portal_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lock_type text NOT NULL CHECK (lock_type IN ('portal', 'data', 'apps')),
  activate_at timestamptz NOT NULL,
  deactivate_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, lock_type)
);

ALTER TABLE public.portal_locks ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.portal_locks TO authenticated;

DROP POLICY IF EXISTS "portal_locks_select_own" ON public.portal_locks;
CREATE POLICY "portal_locks_select_own" ON public.portal_locks FOR SELECT
TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "portal_locks_select_admin" ON public.portal_locks;
CREATE POLICY "portal_locks_select_admin" ON public.portal_locks FOR SELECT
TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_set_portal_lock(
  p_lock_type text,
  p_activate_at timestamptz,
  p_deactivate_at timestamptz
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
  IF p_lock_type NOT IN ('portal', 'data', 'apps') THEN
    RAISE EXCEPTION 'Invalid lock type';
  END IF;
  IF p_activate_at IS NULL OR p_deactivate_at IS NULL THEN
    RAISE EXCEPTION 'Activate and deactivate times are required';
  END IF;
  IF p_deactivate_at <= p_activate_at THEN
    RAISE EXCEPTION 'Deactivate time must be after activate time';
  END IF;

  INSERT INTO public.portal_locks (owner_id, lock_type, activate_at, deactivate_at, active)
  VALUES (auth.uid(), p_lock_type, p_activate_at, p_deactivate_at, false)
  ON CONFLICT (owner_id, lock_type) DO UPDATE SET
    activate_at = EXCLUDED.activate_at,
    deactivate_at = EXCLUDED.deactivate_at,
    active = false,
    created_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_portal_lock(text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_portal_lock(text, timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_due_portal_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.portal_locks
  SET active = true
  WHERE active = false AND activate_at <= now() AND deactivate_at > now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.portal_locks
  SET active = false
  WHERE active = true AND deactivate_at <= now();

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_due_portal_locks() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'portal_locks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_locks;
  END IF;
END $$;

SELECT cron.schedule(
  'apply-due-portal-locks',
  '* * * * *',
  $$SELECT public.apply_due_portal_locks()$$
);
