import { useMemo, useState, type FormEvent } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { scheduleFeatureUpdate, updateFeature, applyScheduledUpdate } from '@/lib/firestore';
import { getErrorMessage } from '@/lib/errors';
import { useAppFeatures } from '@/hooks/useAppFeatures';
import { useScheduledFeatureUpdates } from '@/admin/useScheduledFeatureUpdates';
import type { AppFeature } from '@/lib/types';

function toLocalInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const CATEGORY_LABELS: Record<string, string> = {
  identity_verification: 'Verification',
  document_resubmission: 'Verification',
  aadhaar_updates: 'Verification',
  pan_updates: 'Verification',
  profile_editing: 'Account',
  document_download: 'Account',
  status_check: 'Account',
  support_chat: 'Support',
  appointment_booking: 'Support',
  sms_alerts: 'Notifications',
  email_receipts: 'Notifications',
  feedback: 'Notifications',
};

export default function UserAppsPanel() {
  const { features, error: featuresError, reload: reloadFeatures } = useAppFeatures();
  const { pending, error: scheduleError, reload: reloadScheduled } = useScheduledFeatureUpdates();
  const [selected, setSelected] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [runAt, setRunAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, AppFeature[]>();
    for (const feature of features) {
      const category = CATEGORY_LABELS[feature.key] ?? 'Other';
      const list = map.get(category) ?? [];
      list.push(feature);
      map.set(category, list);
    }
    return Array.from(map.entries());
  }, [features]);

  const labelFor = (key: string) => features.find((feature) => feature.key === key)?.label ?? key;

  const toggle = (key: string) =>
    setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const isImmediate = !runAt;
    let runAtIso = new Date().toISOString();
    if (runAt) {
      const when = new Date(runAt);
      if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
        setError('Please pick a time in the future.');
        return;
      }
      runAtIso = when.toISOString();
    }

    setSubmitting(true);
    try {
      if (isImmediate) {
        for (const key of selected) {
          await updateFeature(key, enabled);
        }
        setSuccess('Update applied to the user app.');
      } else {
        await scheduleFeatureUpdate(selected, enabled, runAtIso);
        setSuccess('Update scheduled. It will be pushed to the user app at the chosen time.');
      }
      setSelected([]);
      setRunAt('');
      reloadFeatures();
      reloadScheduled();
    } catch (cause) {
      setError(getErrorMessage(cause, 'We could not save this update. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">User Apps</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tap the round buttons to select features, choose on or off, then update now or at a set time.
        </p>
      </div>

      {(featuresError || scheduleError) && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-600/20">
          {featuresError ?? scheduleError}
        </p>
      )}

      <form onSubmit={handleUpdate} className="space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="space-y-6">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{category}</h2>
              <div className="flex flex-wrap gap-3">
                {items.map((feature) => (
                  <FeatureToggle
                    key={feature.key}
                    feature={feature}
                    selected={selected.includes(feature.key)}
                    onToggle={() => toggle(feature.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {[
              { value: true, label: 'Turn on' },
              { value: false, label: 'Turn off' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={enabled === option.value}
                onClick={() => setEnabled(option.value)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  enabled === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="run-at" className="text-xs font-medium text-slate-500">
              Schedule (optional)
            </label>
            <input
              id="run-at"
              type="datetime-local"
              value={runAt}
              min={toLocalInputValue(new Date())}
              onChange={(e) => setRunAt(e.target.value)}
              className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 sm:w-auto"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-600/20">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-600/20">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={selected.length === 0 || submitting}
          className="flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Update
        </button>
      </form>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Scheduled updates</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing is scheduled.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((update) => (
              <li key={update.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between">
                <span className="text-slate-900">
                  {update.enabled ? 'Turn on' : 'Turn off'}: {update.feature_keys.map(labelFor).join(', ')}
                </span>
                <span className="text-slate-500">
                  {new Date(update.run_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface FeatureToggleProps {
  feature: AppFeature;
  selected: boolean;
  onToggle: () => void;
}

function FeatureToggle({ feature, selected, onToggle }: FeatureToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      title={feature.description}
      className="flex w-20 flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors"
      style={{ borderColor: selected ? '#0f766e' : undefined, background: selected ? '#f0fdfa' : undefined }}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
          selected
            ? 'border-teal-700 bg-teal-700 text-white'
            : 'border-slate-300 bg-white text-transparent'
        }`}
      >
        <Check className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="flex items-center gap-1 text-[11px] font-medium leading-tight text-slate-700">
        {feature.label}
        <span
          className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
            feature.enabled ? 'bg-emerald-500' : 'bg-rose-400'
          }`}
          aria-label={feature.enabled ? 'Currently on' : 'Currently off'}
        />
      </span>
    </button>
  );
}
