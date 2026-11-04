import { Loader2 } from 'lucide-react';

interface ClaimAdminCardProps {
  onClaim: () => Promise<void>;
  claiming: boolean;
  error: string | null;
}

export default function ClaimAdminCard({ onClaim, claiming, error }: ClaimAdminCardProps) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold text-slate-900">Administrator setup</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        If no administrator has been set up yet, you can claim the role for this account.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-600/20">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onClaim}
        disabled={claiming}
        className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
      >
        {claiming && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Claim administrator access
      </button>
    </section>
  );
}
