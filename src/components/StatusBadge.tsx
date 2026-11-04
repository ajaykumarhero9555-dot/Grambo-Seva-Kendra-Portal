import { Ban, CheckCircle2, Clock, PauseCircle, XCircle, type LucideIcon } from 'lucide-react';
import type { AccountStatus, DocumentStatus } from '@/lib/types';

const DOCUMENT_STYLES: Record<DocumentStatus, { label: string; className: string; Icon: LucideIcon }> = {
  pending: { label: 'Pending review', className: 'bg-amber-50 text-amber-800 ring-amber-600/20', Icon: Clock },
  verified: { label: 'Verified', className: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', className: 'bg-rose-50 text-rose-800 ring-rose-600/20', Icon: XCircle },
};

const ACCOUNT_STYLES: Record<AccountStatus, { label: string; className: string; Icon: LucideIcon }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20', Icon: CheckCircle2 },
  suspended: { label: 'Suspended', className: 'bg-amber-50 text-amber-800 ring-amber-600/20', Icon: PauseCircle },
  blocked: { label: 'Blocked', className: 'bg-rose-50 text-rose-800 ring-rose-600/20', Icon: Ban },
};

type StatusBadgeProps =
  | { kind: 'document'; status: DocumentStatus | null }
  | { kind: 'account'; status: AccountStatus };

export default function StatusBadge(props: StatusBadgeProps) {
  const notSubmitted = props.kind === 'document' && props.status === null;
  const style =
    props.kind === 'document' ? DOCUMENT_STYLES[props.status ?? 'pending'] : ACCOUNT_STYLES[props.status];
  const label = notSubmitted ? 'Not submitted' : style.label;
  const className = notSubmitted ? 'bg-slate-100 text-slate-600 ring-slate-500/20' : style.className;
  const { Icon } = style;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
