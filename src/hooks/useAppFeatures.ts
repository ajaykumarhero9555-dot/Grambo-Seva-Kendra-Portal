import { useEffect, useState } from 'react';
import { watchFeatures } from '@/lib/firestore';
import type { AppFeature } from '@/lib/types';

export interface AppFeaturesState {
  features: AppFeature[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAppFeatures(): AppFeaturesState {
  const [features, setFeatures] = useState<AppFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = watchFeatures((data) => {
      setFeatures(data);
      setError(null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const reload = () => {
    setError(null);
  };

  return { features, loading, error, reload };
}

export function isFeatureEnabled(features: AppFeature[], key: string): boolean {
  return features.find((feature) => feature.key === key)?.enabled ?? false;
}
