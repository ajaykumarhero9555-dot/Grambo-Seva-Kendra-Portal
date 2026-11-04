import { useState } from 'react';
import { Ban, FileCheck2, PauseCircle, PlayCircle, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errors';
import StatusBadge from '@/components/StatusBadge';
import { useAdminUsers, type AdminUserRow } from '@/admin/useAdminUsers';
import VerifyDocumentsPanel from '@/admin/VerifyDocumentsPanel';
import UserProfilePanel from '@/admin/UserProfilePanel';
import type { AccountStatus } from '@/lib/types';

interface AdminConsoleProps {
  adminId: string;
}

const ACTION_BUTTON =
  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export default function AdminConsole({ adminId }: AdminConsoleProps) {
  const { rows, loading, error, reload } = useAdminUsers();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const selected = rows.find((row) => row.profile.id === selectedId) ?? null;
  const profileRow = rows.find((row) => row.profile.id === profileId) ?? null;

  const runAction = async (row: AdminUserRow, task: () => Promise<void>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(row.profile.id);
    setActionError(null);
    try {
      await task();
      await reload();
    } catch (cause) {
      setActionError(getErrorMessage(cause, 'We could not complete this action. Please try again.'));
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = (row: AdminUserRow, status: AccountStatus, confirmText?: string) =>
    runAction(
      row,
      async () => {
        const { error: rpcError } = await supabase.rpc('admin_set_account_status', {
          p_user: row.profile.id,
          p_status: status,
        });
        if (rpcError) throw rpcError;
      },
      confirmText
    );

  const deleteUser = (row: AdminUserRow) =>
    runAction(
      row,
      async () => {
        const { error: rpcError } = await supabase.rpc('admin_delete_user', { p_user: row.profile.id });
        if (rpcError) throw rpcError;
        setSelectedId(null);
      },
      `Delete ${row.profile.full_name || row.profile.email} permanently? Their account and documents will be removed.`
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          {rows.length} {rows.length === 1 ? 'user' : 'users'}. Changes here appear in the user app instantly.
        </p>
      </div>

      {(error || actionError) && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-600/20">
          {error ?? actionError}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">PAN</th>
              <th className="px-4 py-3 font-medium">Aadhaar</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading users...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No users yet.</td>
              </tr>
            )}
            {rows.map((row) => {
              const status = row.profile.account_status;
              const busy = busyId === row.profile.id;
              const isSelf = row.profile.id === adminId;
              const name = row.profile.full_name || row.profile.email;
              return (
                <tr key={row.profile.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => setProfileId(row.profile.id)}
                        className="text-left"
                      >
                        <p className="font-medium text-slate-900 hover:text-teal-700">{row.profile.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-500">{row.profile.email}</p>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(row.profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge kind="account" status={status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge kind="document" status={row.kyc?.pan_status ?? null} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge kind="document" status={row.kyc?.aadhaar_status ?? null} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.profile.id)}
                        disabled={!row.kyc || busy}
                        className={`${ACTION_BUTTON} bg-teal-700 hover:bg-teal-800`}
                      >
                        <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Verify Documents
                      </button>
                      {status !== 'blocked' && (
                        <button
                          type="button"
                          onClick={() => setStatus(row, 'blocked', `Block ${name}? They will not be able to submit verification details.`)}
                          disabled={busy || isSelf}
                          className={`${ACTION_BUTTON} bg-rose-600 hover:bg-rose-700`}
                        >
                          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                          Block User
                        </button>
                      )}
                      {status === 'blocked' && (
                        <button
                          type="button"
                          onClick={() => setStatus(row, 'active')}
                          disabled={busy}
                          className={`${ACTION_BUTTON} bg-emerald-600 hover:bg-emerald-700`}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Unblock User
                        </button>
                      )}
                      {status === 'active' && (
                        <button
                          type="button"
                          onClick={() => setStatus(row, 'suspended')}
                          disabled={busy || isSelf}
                          className={`${ACTION_BUTTON} bg-amber-600 hover:bg-amber-700`}
                        >
                          <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Suspend User
                        </button>
                      )}
                      {status === 'suspended' && (
                        <button
                          type="button"
                          onClick={() => setStatus(row, 'active')}
                          disabled={busy}
                          className={`${ACTION_BUTTON} bg-emerald-600 hover:bg-emerald-700`}
                        >
                          <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Unsuspend User
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteUser(row)}
                        disabled={busy || isSelf}
                        className={`${ACTION_BUTTON} bg-slate-900 hover:bg-slate-800`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete User
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && selected.kyc && (
        <VerifyDocumentsPanel row={selected} onClose={() => setSelectedId(null)} onChanged={reload} />
      )}

      {profileRow && (
        <UserProfilePanel
          row={profileRow}
          adminId={adminId}
          onClose={() => setProfileId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
