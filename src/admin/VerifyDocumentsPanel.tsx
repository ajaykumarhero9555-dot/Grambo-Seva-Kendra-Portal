import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errors';
import StatusBadge from '@/components/StatusBadge';
import type { AdminUserRow } from '@/admin/useAdminUsers';
import { maskAadhaar } from '@/lib/validation';
import type { DocumentStatus } from '@/lib/types';

interface VerifyDocumentsPanelProps {
  row: AdminUserRow;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export default function VerifyDocumentsPanel({ row, onClose, onChanged }: VerifyDocumentsPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<'pan' | 'aadhaar', string>>({ pan: '', aadhaar: '' });
  const { profile, kyc } = row;

  const review = async (document: 'pan' | 'aadhaar', decision: DocumentStatus) => {
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('admin_review_kyc', {
        p_user: profile.id,
        p_document: document,
        p_decision: decision,
        p_reason: reasons[document] || null,
      });
      if (rpcError) throw rpcError;
      await onChanged();
    } catch (cause) {
      setError(getErrorMessage(cause, 'We could not save this review. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (!kyc) return null;

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col gap-6 overflow-y-auto bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Verify documents</h2>
            <p className="mt-1 text-sm text-slate-500">
              {profile.full_name || 'Unnamed'} · {profile.email}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">
            Close
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-600/20">
            {error}
          </p>
        )}

        <DocumentReview
          label="PAN card"
          value={kyc.pan_number}
          status={kyc.pan_status}
          busy={busy}
          reason={reasons.pan}
          onReason={(value) => setReasons({ ...reasons, pan: value })}
          onVerify={() => review('pan', 'verified')}
          onReject={() => review('pan', 'rejected')}
        />
        <DocumentReview
          label="Aadhaar card (last 4 digits)"
          value={maskAadhaar(kyc.aadhaar_last4)}
          status={kyc.aadhaar_status}
          busy={busy}
          reason={reasons.aadhaar}
          onReason={(value) => setReasons({ ...reasons, aadhaar: value })}
          onVerify={() => review('aadhaar', 'verified')}
          onReject={() => review('aadhaar', 'rejected')}
        />
      </aside>
    </div>
  );
}

interface DocumentReviewProps {
  label: string;
  value: string;
  status: DocumentStatus;
  busy: boolean;
  reason: string;
  onReason: (value: string) => void;
  onVerify: () => void;
  onReject: () => void;
}

function DocumentReview({ label, value, status, busy, reason, onReason, onVerify, onReject }: DocumentReviewProps) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="font-mono text-sm text-slate-600">{value}</p>
        </div>
        <StatusBadge kind="document" status={status} />
      </div>
      <textarea
        value={reason}
        onChange={(e) => onReason(e.target.value)}
        placeholder="Reason (required to reject)"
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || status === 'verified'}
          onClick={onVerify}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Verify
        </button>
        <button
          type="button"
          disabled={busy || !reason.trim()}
          onClick={onReject}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Reject
        </button>
      </div>
    </div>
  );
}
