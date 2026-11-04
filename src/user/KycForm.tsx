import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { submitKyc } from '@/lib/firestore';
import { getErrorMessage } from '@/lib/errors';
import {
  isValidAadhaar,
  isValidPan,
  maskAadhaar,
  maskPan,
  normalizeAadhaar,
  normalizePan,
} from '@/lib/validation';
import type { KycRecord } from '@/lib/types';

interface KycFormProps {
  kyc: KycRecord | null;
  userId: string;
  disabled: boolean;
  onSaved: () => void;
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider text-slate-900 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

export default function KycForm({ kyc, userId, disabled, onSaved }: KycFormProps) {
  const panLocked = kyc?.pan_status === 'verified';
  const aadhaarLocked = kyc?.aadhaar_status === 'verified';

  const [pan, setPan] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (!panLocked && !isValidPan(pan)) {
      setError('Please enter a valid PAN in the format ABCDE1234F.');
      return;
    }
    if (!aadhaarLocked && !isValidAadhaar(aadhaar)) {
      setError('Please enter a valid 12-digit Aadhaar number.');
      return;
    }

    setSubmitting(true);
    try {
      await submitKyc(
        userId,
        panLocked ? null : normalizePan(pan),
        aadhaarLocked ? null : normalizeAadhaar(aadhaar)
      );
      setPan('');
      setAadhaar('');
      setSaved(true);
      onSaved();
    } catch (cause) {
      setError(getErrorMessage(cause, 'We could not submit your details. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldsDisabled = disabled || submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!panLocked && (
        <div>
          <label htmlFor="kyc-pan" className="mb-1.5 block text-sm font-medium text-slate-700">
            PAN number
          </label>
          <input
            id="kyc-pan"
            type="text"
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase())}
            maxLength={10}
            autoComplete="off"
            spellCheck={false}
            placeholder="ABCDE1234F"
            disabled={fieldsDisabled}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-slate-500">Exactly as printed on your PAN card.</p>
        </div>
      )}

      {!aadhaarLocked && (
        <div>
          <label htmlFor="kyc-aadhaar" className="mb-1.5 block text-sm font-medium text-slate-700">
            Aadhaar number
          </label>
          <input
            id="kyc-aadhaar"
            type="text"
            inputMode="numeric"
            value={aadhaar}
            onChange={(e) => setAadhaar(e.target.value.replace(/[^0-9\s]/g, '').slice(0, 14))}
            autoComplete="off"
            placeholder="1234 5678 9012"
            disabled={fieldsDisabled}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Your full number is checked once and only the last 4 digits are kept.
          </p>
        </div>
      )}

      {panLocked && aadhaarLocked && kyc && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-600/20">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Both documents are verified: {maskPan(kyc.pan_number)} and {maskAadhaar(kyc.aadhaar_last4)}.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-600/20">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-600/20">
          Thanks, your details were submitted and are now awaiting review.
        </p>
      )}

      {!(panLocked && aadhaarLocked) && (
        <button
          type="submit"
          disabled={fieldsDisabled}
          className="flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          {kyc && (kyc.pan_status === 'rejected' || kyc.aadhaar_status === 'rejected')
            ? 'Resubmit for review'
            : 'Submit for verification'}
        </button>
      )}
    </form>
  );
}
