/*
# Add un_apps lock type

## Plain-English summary
Adds 'un_apps' as a valid portal lock type so admins can schedule unlocking specific apps.

## 1. Modified tables
- `portal_locks.lock_type` now accepts 'portal', 'data', 'apps', or 'un_apps'.
*/

ALTER TABLE public.portal_locks DROP CONSTRAINT IF EXISTS portal_locks_lock_type_check;
ALTER TABLE public.portal_locks ADD CONSTRAINT portal_locks_lock_type_check
  CHECK (lock_type IN ('portal', 'data', 'apps', 'un_apps'));
