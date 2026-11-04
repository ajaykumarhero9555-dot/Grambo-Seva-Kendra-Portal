import { useRef, useState, type FormEvent } from 'react';
import { Loader2, Lock, Database, AppWindow, Unlock, X, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { setPortalLock } from '@/lib/firestore';
import { getErrorMessage } from '@/lib/errors';
import type { LockType } from '@/lib/types';

interface PortalLockModalProps {
  onClose: () => void;
}

interface LockOption {
  type: LockType;
  label: string;
  icon: LucideIcon;
  color: string;
}

const LOCK_OPTIONS: LockOption[] = [
  { type: 'portal', label: 'Portal lock', icon: Lock, color: 'bg-rose-600' },
  { type: 'data', label: 'Data lock', icon: Database, color: 'bg-amber-600' },
  { type: 'apps', label: 'Apps lock', icon: AppWindow, color: 'bg-sky-600' },
  { type: 'un_apps', label: 'Un apps lock', icon: Unlock, color: 'bg-emerald-600' },
];

const APP_LIST = [
  'Identity verification',
  'Document resubmission',
  'Aadhaar updates',
  'PAN updates',
  'Profile editing',
  'Document download',
  'Status check',
  'Support chat',
  'Appointment booking',
  'SMS alerts',
  'Email receipts',
  'Feedback',
];

const LONG_PRESS_MS = 2000;

function toLocalInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function PortalLockModal({ onClose }: PortalLockModalProps) {
  const [selected, setSelected] = useState<LockType>('portal');
  const [activateAt, setActivateAt] = useState('');
  const [deactivateAt, setDeactivateAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [pressingApp, setPressingApp] = useState<string | null>(null);
  const [pressProgress, setPressProgress] = useState(0);
  const [hasLongPressed, setHasLongPressed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAppList = selected === 'apps' || selected === 'un_apps';
  const labelFor = (type: LockType) => LOCK_OPTIONS.find((o) => o.type === type)?.label ?? type;

  const clearPressTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPressingApp(null);
    setPressProgress(0);
  };

  const startLongPress = (app: string) => {
    setPressingApp(app);
    setPressProgress(0);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / LONG_PRESS_MS, 1);
      setPressProgress(pct);
    }, 50);
    timeoutRef.current = setTimeout(() => {
      setSelectedApps((prev) => {
        const next = new Set(prev);
        if (next.has(app)) {
          next.delete(app);
        } else {
          next.add(app);
        }
        return next;
      });
      setHasLongPressed(true);
      clearPressTimer();
    }, LONG_PRESS_MS);
  };

  const toggleApp = (app: string) => {
    setSelectedApps((prev) => {
      const next = new Set(prev);
      if (next.has(app)) {
        next.delete(app);
      } else {
        next.add(app);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedApps(new Set(APP_LIST));
  const deselectAll = () => setSelectedApps(new Set());

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!activateAt || !deactivateAt) {
      setError('Please set both activate and deactivate times.');
      return;
    }

    const start = new Date(activateAt);
    const end = new Date(deactivateAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('Please enter valid times.');
      return;
    }
    if (end <= start) {
      setError('Deactivate time must be after activate time.');
      return;
    }

    setSubmitting(true);
    try {
      await setPortalLock(selected, start.toISOString(), end.toISOString());
      setSuccess(`${labelFor(selected)} timer updated successfully.`);
    } catch (cause) {
      setError(getErrorMessage(cause, 'We could not update the lock timer. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Portal Lock</h2>
          <button type="button" onClick={() => { clearPressTimer(); onClose(); }} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {LOCK_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selected === option.type;
              return (
                <button
                  key={option.type}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => { setSelected(option.type); clearPressTimer(); }}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                    isSelected ? 'border-teal-600 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${option.color} text-white`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium text-slate-700">{option.label}</span>
                </button>
              );
            })}
          </div>

          {showAppList && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">
                  Long-press an app for 2 seconds to select it
                </p>
                {hasLongPressed && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {APP_LIST.map((app) => {
                  const isSelected = selectedApps.has(app);
                  const isPressing = pressingApp === app;
                  return (
                    <button
                      key={app}
                      type="button"
                      onPointerDown={() => startLongPress(app)}
                      onPointerUp={clearPressTimer}
                      onPointerLeave={clearPressTimer}
                      onClick={() => toggleApp(app)}
                      className={`relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border-2 p-3 text-center transition-colors ${
                        isSelected ? 'border-teal-600 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {isPressing && (
                        <span
                          className="absolute bottom-0 left-0 bg-teal-200/60 transition-all"
                          style={{ width: `${pressProgress * 100}%`, top: 0 }}
                        />
                      )}
                      <span
                        className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
                          isSelected ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-transparent'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="relative text-[11px] font-medium leading-tight text-slate-700">{app}</span>
                    </button>
                  );
                })}
              </div>

              {selectedApps.size > 0 ? (
                <p className="text-xs text-slate-500">
                  {selectedApps.size} app{selectedApps.size === 1 ? '' : 's'} selected
                </p>
              ) : showAppList ? (
                <p className="text-xs text-slate-400">
                  No specific apps selected — the lock will apply to all apps.
                </p>
              ) : null}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="lock-activate" className="mb-1 block text-xs font-medium text-slate-500">
                Activate at
              </label>
              <input
                id="lock-activate"
                type="datetime-local"
                value={activateAt}
                min={toLocalInputValue(new Date())}
                onChange={(e) => setActivateAt(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              />
            </div>
            <div>
              <label htmlFor="lock-deactivate" className="mb-1 block text-xs font-medium text-slate-500">
                Deactivate at
              </label>
              <input
                id="lock-deactivate"
                type="datetime-local"
                value={deactivateAt}
                min={activateAt || toLocalInputValue(new Date())}
                onChange={(e) => setDeactivateAt(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
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
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
            Update
          </button>
        </form>
      </div>
    </div>
  );
}
