import { useEffect, useState } from 'react';
import { watchPendingScheduledUpdates } from '@/lib/firestore';
import type { ScheduledFeatureUpdate } from '@/lib/types';

export interface ScheduledUpdatesState {
  pending: ScheduledFeatureUpdate[];
  error: string | null;
  reload: () => void;
}

export function useScheduledFeatureUpdates(): ScheduledUpdatesState {
  const [pending, setPending] = useState<ScheduledFeatureUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = watchPendingScheduledUpdates((data) => {
      setPending(data);
      setError(null);
    });
    return unsub;
  }, []);

  const reload = () => {
    setError(null);
  };

  return { pending, error, reload };
}
