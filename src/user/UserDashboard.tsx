import { useState } from 'react';
import { AlertTriangle, LogOut, ShieldCheck, Lock } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import BrandMark from '@/components/BrandMark';
import StatusBadge from '@/components/StatusBadge';
import KycForm from '@/user/KycForm';
import KycStatusCard from '@/user/KycStatusCard';
import PortalLockModal from '@/components/PortalLockModal';
import { useMyAccount } from '@/user/useMyAccount';
import { useAdminAccess } from '@/admin/useAdminAccess';
import ClaimAdminCard from '@/admin/ClaimAdminCard';
import ControlPanel from '@/admin/ControlPanel';
import { isFeatureEnabled, useAppFeatures } from '@/hooks/useAppFeatures';

interface UserDashboardProps {
  userId: string;
}

export default function UserDashboard({ userId }: UserDashboardProps) {
  const { profile, kyc, loading, error, reload } = useMyAccount(userId);
  const { features, loading: featuresLoading } = useAppFeatures();
  const { status: adminStatus, error: adminError, claiming, claimAdmin } = useAdminAccess();
  const [view, setView] = useState<'account' | 'control'>('account');
  const [signingOut, setSigningOut] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut(auth);
  };

  const isAdmin = adminStatus === 'admin';
  const suspended = profile !== null && profile.account_status !== 'active';
  const allVerified = kyc?.pan_status === 'verified' && kyc?.aadhaar_status === 'verified';
  const hasRejected = kyc?.pan_status === 'rejected' || kyc?.aadhaar_status === 'rejected';
  const identityOn = isFeatureEnabled(features, 'identity_verification');
  const resubmissionOn = isFeatureEnabled(features, 'document_resubmission');
  const pausedNotice = !identityOn
    ? 'Identity verification is paused right now. Please check back later.'
    : hasRejected && !resubmissionOn
      ? 'Resubmission is paused right now. Please check back later.'
      : null;
  const showForm = !featuresLoading && !allVerified && !suspended && pausedNotice === null;
  const firstName = profile?.full_name.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="hidden rounded-full bg-teal-700 px-2.5 py-0.5 text-xs font-medium text-white sm:inline">
              Portal
            </span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        {isAdmin && (
          <div className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
            {(['account', 'control'] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={view === item}
                onClick={() => setView(item)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  view === item ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item === 'account' ? 'My account' : 'Control panel'}
              </button>
            ))}
          </div>
        )}

        {isAdmin && view === 'control' && <ControlPanel adminId={userId} />}

        {(!isAdmin || view === 'account') && (
          <>
            {loading && (
              <div className="space-y-6" aria-busy="true" aria-label="Loading your account">
                <div className="h-28 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
                <div className="h-80 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
              </div>
            )}

            {!loading && error && (
              <div role="alert" className="flex flex-col items-start gap-4 rounded-2xl border border-rose-200 bg-white p-6">
                <p className="text-sm text-rose-700">{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && !profile && (
              <p className="rounded-2xl bg-white p-6 text-sm text-slate-600 ring-1 ring-slate-200">
                Your account is being set up. Please refresh in a moment.
              </p>
            )}

            {!loading && !error && profile && (
              <>
                {suspended && (
                  <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">
                        {profile.account_status === 'blocked' ? 'Your account is blocked' : 'Your account is suspended'}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-rose-800">
                        You cannot submit verification details right now. Please contact support for help.
                      </p>
                    </div>
                  </div>
                )}

                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-700 text-white shadow-sm">
                        <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Hello, {firstName}</h1>
                        <p className="mt-1 text-sm text-slate-500">{profile.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Active status</span>
                      <StatusBadge kind="account" status={profile.account_status} />
                    </div>
                  </div>
                </section>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowLockModal(true)}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 px-6 py-4 text-white shadow-md transition-all hover:shadow-lg hover:from-rose-600 hover:to-rose-800"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                      <Lock className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold">Portal Lock</span>
                  </button>
                </div>

                <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-slate-900">Identity verification</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      Verify your PAN and Aadhaar details. Updates from our review team appear here automatically.
                    </p>
                  </div>

                  <KycStatusCard kyc={kyc} />

                  {!allVerified && pausedNotice && (
                    <p role="status" className="mt-8 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-600/20">
                      {pausedNotice}
                    </p>
                  )}

                  {showForm && (
                    <div className="mt-8 border-t border-slate-200 pt-8">
                      <h3 className="mb-5 text-base font-semibold text-slate-900">
                        {kyc ? 'Update your details' : 'Add your details'}
                      </h3>
                      <KycForm kyc={kyc} userId={userId} disabled={suspended} onSaved={reload} />
                    </div>
                  )}
                </section>
              </>
            )}

            {adminStatus === 'denied' && <ClaimAdminCard onClaim={claimAdmin} claiming={claiming} error={adminError} />}
          </>
        )}

        {showLockModal && <PortalLockModal onClose={() => setShowLockModal(false)} />}
      </main>
    </div>
  );
}
