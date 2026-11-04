/*
# Run scheduled feature updates every minute

## Plain-English summary
Turns on the database job scheduler and sets it to apply any due feature switch updates
once per minute. When an admin schedules a change for a future time, it takes effect
within about a minute of that time, even if no admin or user has the app open.

## 1. New extension
- `pg_cron`: the database's built-in job scheduler.

## 2. New scheduled job
- `apply-scheduled-feature-updates`: runs every minute and calls `apply_due_feature_updates`.
  Re-running this migration updates the same job rather than creating a duplicate.

## 3. Security
- The job runs with database owner rights and is not reachable from the browser.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
  'apply-scheduled-feature-updates',
  '* * * * *',
  $$SELECT public.apply_due_feature_updates()$$
);
