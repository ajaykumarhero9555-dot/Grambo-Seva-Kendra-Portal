import {
  Ban,
  CalendarDays,
  CreditCard,
  FileCheck2,
  Fingerprint,
  Mail,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { adminSetAccountStatus, adminDeleteUser } from '@/lib/firestore';
import { getErrorMessage } from '@/lib/errors';
import StatusBadge from '@/components/StatusBadge';
import { maskAadhaar, maskPan } from '@/lib/validation';
import type { AdminUserRow } from '@/admin/useAdminUsers';
import type { AccountStatus, DocumentStatus } from '@/lib/types';

interface UserProfilePanelProps {
  row: AdminUserRow;
  adminId: string;
  onClose: () => void;
  onChanged: () => void;
}

const ACTION_BTN =
  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export default function UserProfilePanel({ row, adminId, onClose, onChanged }: UserProfilePanelProps) {
  const { profile, kyc } = row;
  const status = profile.account_status;
  const isSelf = profile.id === adminId;
  const name = profile.full_name || 'Unnamed';

  const handleStatus = async (newStatus: AccountStatus) => {
    try {
      await adminSetAccountStatus(profile.id, newStatus, adminId);
      onChanged();
    } catch (cause) {
      alert(getErrorMessage(cause, 'We could not complete this action. Please try again.'));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${name} permanently? Their account and documents will be removed.`)) return;
    try {
      await adminDeleteUser(profile.id, adminId);
      onClose();
      onChanged();
    } catch (cause) {
      alert(getErrorMessage(cause, 'We could not delete this user. Please try again.'));
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col gap-6 overflow-y-auto bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-700 text-white shadow-sm">
              <UserIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{name}</h2>
              <p className="text-sm text-slate-500">{profile.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">
            Close
          </button>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active status</span>
            <StatusBadge kind="account" status={status} />
          </div>

          <Detail icon={CalendarDays} label="Joined" value={new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
          <Detail icon={Mail} label="Email" value={profile.email} />

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Documents</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <DocChip icon={CreditCard} title="PAN" value={kyc ? maskPan(kyc.pan_number) : 'Not submitted'} status={kyc?.pan_status ?? null} tint="bg-sky-50 text-sky-700 ring-sky-600/15" />
              <DocChip icon={Fingerprint} title="Aadhaar" value={kyc ? maskAadhaar(kyc.aadhaar_last4) : 'Not submitted'} status={kyc?.aadhaar_status ?? null} tint="bg-orange-50 text-orange-700 ring-orange-600/15" />
            </div>
            {kyc?.pan_rejection_reason && (
              <p className="mt-2 text-xs text-rose-700">PAN rejection: {kyc.pan_rejection_reason}</p>
            )}
            {kyc?.aadhaar_rejection_reason && (
              <p className="mt-1 text-xs text-rose-700">Aadhaar rejection: {kyc.aadhaar_rejection_reason}</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!kyc} className={`${ACTION_BTN} bg-teal-700 hover:bg-teal-800`}>
              <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
              Verify Documents
            </button>
            {status !== 'blocked' && (
              <button type="button" disabled={isSelf} onClick={() => handleStatus('blocked')} className={`${ACTION_BTN} bg-rose-600 hover:bg-rose-700`}>
                <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                Block User
              </button>
            )}
            {status === 'blocked' && (
              <button type="button" onClick={() => handleStatus('active')} className={`${ACTION_BTN} bg-emerald-600 hover:bg-emerald-700`}>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Unblock User
              </button>
            )}
            {status === 'active' && (
              <button type="button" disabled={isSelf} onClick={() => handleStatus('suspended')} className={`${ACTION_BTN} bg-amber-600 hover:bg-amber-700`}>
                <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Suspend User
              </button>
            )}
            {status === 'suspended' && (
              <button type="button" onClick={() => handleStatus('active')} className={`${ACTION_BTN} bg-emerald-600 hover:bg-emerald-700`}>
                <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Unsuspend User
              </button>
            )}
            <button type="button" disabled={isSelf} onClick={handleDelete} className={`${ACTION_BTN} bg-slate-900 hover:bg-slate-800`}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete User
            </button>
          </div>
          {isSelf && (
            <p className="mt-3 text-xs text-slate-400">You cannot block, suspend, or delete your own account.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

interface DetailProps {
  icon: typeof Mail;
  label: string;
  value: string;
}

function Detail({ icon: Icon, label, value }: DetailProps) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm text-slate-700">{value}</p>
      </div>
    </div>
  );
}

interface DocChipProps {
  icon: typeof Mail;
  title: string;
  value: string;
  status: DocumentStatus | null;
  tint: string;
}

function DocChip({ icon: Icon, title, value, status, tint }: DocChipProps) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ring-1 ${tint}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-900">{title}</p>
          <p className="font-mono text-xs text-slate-500">{value}</p>
        </div>
      </div>
      <div className="mt-2">
        <StatusBadge kind="document" status={status} />
      </div>
    </div>
  );
}
