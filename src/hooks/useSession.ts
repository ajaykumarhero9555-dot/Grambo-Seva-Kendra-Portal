import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ensureProfile } from '@/lib/firestore';

interface SessionState {
  user: User | null;
  loading: boolean;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ user: null, loading: true });

  useEffect(() => {
    let active = true;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      if (user) {
        const displayName = user.displayName ?? '';
        await ensureProfile(user.uid, user.email ?? '', displayName).catch(() => {});
      }
      setState({ user, loading: false });
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return state;
}
