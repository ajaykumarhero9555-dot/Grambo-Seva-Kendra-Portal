import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { isAdmin, claimFirstAdmin } from '@/lib/firestore';
import { getErrorMessage } from '@/lib/errors';

export type AdminStatus = 'checking' | 'admin' | 'denied';

interface AdminAccessState {
  status: AdminStatus;
  error: string | null;
  claiming: boolean;
  claimAdmin: () => Promise<void>;
}

export function useAdminAccess(): AdminAccessState {
  const [status, setStatus] = useState<AdminStatus>('checking');
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let active = true;
    const unsub = auth.onIdTokenChanged(async (user) => {
      if (!active) return;
      if (!user) {
        setStatus('denied');
        return;
      }
      try {
        const result = await isAdmin(user.uid);
        if (active) setStatus(result ? 'admin' : 'denied');
      } catch (cause) {
        if (active) {
          setError(getErrorMessage(cause, 'We could not verify your access. Please try again.'));
          setStatus('denied');
        }
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const claimAdmin = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setError('Your session has ended. Please sign in again.');
      return;
    }
    setClaiming(true);
    setError(null);
    try {
      const result = await claimFirstAdmin(user.uid);
      if (result) {
        setStatus('admin');
      } else {
        setError('An administrator is already set up. Ask them to add your account.');
      }
    } catch (cause) {
      setError(getErrorMessage(cause, 'We could not claim administrator access. Please try again.'));
    } finally {
      setClaiming(false);
    }
  }, []);

  return { status, error, claiming, claimAdmin };
}
