import { useEffect, useState } from 'react';
import { watchAllProfiles, watchAllKyc } from '@/lib/firestore';
import type { KycRecord, Profile } from '@/lib/types';

export interface AdminUserRow {
  profile: Profile;
  kyc: KycRecord | null;
}

export interface AdminUsersState {
  rows: AdminUserRow[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAdminUsers(): AdminUsersState {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [kycRecords, setKycRecords] = useState<KycRecord[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [kycLoaded, setKycLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubProfiles = watchAllProfiles((data) => {
      setProfiles(data);
      setProfilesLoaded(true);
    });
    const unsubKyc = watchAllKyc((data) => {
      setKycRecords(data);
      setKycLoaded(true);
    });
    return () => {
      unsubProfiles();
      unsubKyc();
    };
  }, []);

  const loading = !profilesLoaded || !kycLoaded;

  const kycByUser = new Map(kycRecords.map((r) => [r.user_id, r]));
  const rows = profiles.map((profile) => ({
    profile,
    kyc: kycByUser.get(profile.id) ?? null,
  }));

  const reload = () => {
    setError(null);
  };

  return { rows, loading, error, reload };
}
