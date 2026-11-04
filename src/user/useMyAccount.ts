import { useEffect, useState } from 'react';
import { watchProfile, watchKyc } from '@/lib/firestore';
import type { KycRecord, Profile } from '@/lib/types';

export interface MyAccountState {
  profile: Profile | null;
  kyc: KycRecord | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useMyAccount(userId: string): MyAccountState {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kyc, setKyc] = useState<KycRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let profileLoaded = false;
    let kycLoaded = false;

    const checkDone = () => {
      if (profileLoaded && kycLoaded && active) setLoading(false);
    };

    const unsubProfile = watchProfile(userId, (data) => {
      if (!active) return;
      setProfile(data);
      profileLoaded = true;
      checkDone();
    });

    const unsubKyc = watchKyc(userId, (data) => {
      if (!active) return;
      setKyc(data);
      kycLoaded = true;
      checkDone();
    });

    return () => {
      active = false;
      unsubProfile();
      unsubKyc();
    };
  }, [userId]);

  const reload = () => {
    setLoading(true);
    setError(null);
  };

  return { profile, kyc, loading, error, reload };
}
