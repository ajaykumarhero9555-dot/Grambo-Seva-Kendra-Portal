import { CreditCard, Fingerprint, type LucideIcon } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { maskAadhaar, maskPan } from '@/lib/validation';
import type { DocumentStatus, KycRecord } from '@/lib/types';

interface KycStatusCardProps {
  kyc: KycRecord | null;
}

export default function KycStatusCard({ kyc }: KycStatusCardProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DocumentRow
        icon={CreditCard}
        title="PAN card"
        value={kyc ? maskPan(kyc.pan_number) : null}
        status={kyc?.pan_status ?? null}
        reason={kyc?.pan_rejection_reason ?? null}
        tint="bg-sky-50 text-sky-700 ring-sky-600/15"
      />
      <DocumentRow
        icon={Fingerprint}
        title="Aadhaar card"
        value={kyc ? maskAadhaar(kyc.aadhaar_last4) : null}
        status={kyc?.aadhaar_status ?? null}
        reason={kyc?.aadhaar_rejection_reason ?? null}
        tint="bg-orange-50 text-orange-700 ring-orange-600/15"
      />
    </div>
  );
}

interface DocumentRowProps {
  icon: LucideIcon;
  title: string;
  value: string | null;
  status: DocumentStatus | null;
  reason: string | null;
  tint: string;
}

function DocumentRow({ icon: Icon, title, value, status, reason, tint }: DocumentRowProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ring-1 ${tint}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{value ?? 'Not added yet'}</p>
          </div>
        </div>
        <StatusBadge kind="document" status={status} />
      </div>
      {status === 'rejected' && reason && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-800 ring-1 ring-rose-600/15">
          Reason: {reason}
        </p>
      )}
    </div>
  );
}
