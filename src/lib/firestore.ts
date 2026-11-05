import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_FEATURES } from '@/lib/types';
import type {
  Profile,
  KycRecord,
  AppFeature,
  ScheduledFeatureUpdate,
  PortalLock,
  LockType,
  AccountStatus,
  DocumentStatus,
} from '@/lib/types';

function tsToDate(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

export async function ensureProfile(uid: string, email: string, fullName: string): Promise<void> {
  const ref = doc(db, 'profiles', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      id: uid,
      email,
      full_name: fullName,
      account_status: 'active' as AccountStatus,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db, 'profiles', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: uid,
    email: d.email ?? '',
    full_name: d.full_name ?? '',
    account_status: (d.account_status ?? 'active') as AccountStatus,
    created_at: tsToDate(d.created_at),
    updated_at: tsToDate(d.updated_at),
  };
}

export async function getAllProfiles(): Promise<Profile[]> {
  const snap = await getDocs(query(collection(db, 'profiles'), orderBy('created_at', 'desc')));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      email: data.email ?? '',
      full_name: data.full_name ?? '',
      account_status: (data.account_status ?? 'active') as AccountStatus,
      created_at: tsToDate(data.created_at),
      updated_at: tsToDate(data.updated_at),
    };
  });
}

export async function getKyc(uid: string): Promise<KycRecord | null> {
  const snap = await getDoc(doc(db, 'kyc_records', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    user_id: uid,
    pan_number: d.pan_number ?? '',
    pan_status: (d.pan_status ?? 'pending') as DocumentStatus,
    pan_rejection_reason: d.pan_rejection_reason ?? null,
    aadhaar_last4: d.aadhaar_last4 ?? '',
    aadhaar_status: (d.aadhaar_status ?? 'pending') as DocumentStatus,
    aadhaar_rejection_reason: d.aadhaar_rejection_reason ?? null,
    submitted_at: tsToDate(d.submitted_at),
    updated_at: tsToDate(d.updated_at),
    reviewed_at: d.reviewed_at ? tsToDate(d.reviewed_at) : null,
  };
}

export async function getAllKyc(): Promise<KycRecord[]> {
  const snap = await getDocs(collection(db, 'kyc_records'));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      user_id: d.id,
      pan_number: data.pan_number ?? '',
      pan_status: (data.pan_status ?? 'pending') as DocumentStatus,
      pan_rejection_reason: data.pan_rejection_reason ?? null,
      aadhaar_last4: data.aadhaar_last4 ?? '',
      aadhaar_status: (data.aadhaar_status ?? 'pending') as DocumentStatus,
      aadhaar_rejection_reason: data.aadhaar_rejection_reason ?? null,
      submitted_at: tsToDate(data.submitted_at),
      updated_at: tsToDate(data.updated_at),
      reviewed_at: data.reviewed_at ? tsToDate(data.reviewed_at) : null,
    };
  });
}

export async function submitKyc(
  uid: string,
  pan: string | null,
  aadhaar: string | null
): Promise<void> {
  const ref = doc(db, 'kyc_records', uid);
  const existing = await getDoc(ref);
  const data: DocumentData = {
    updated_at: serverTimestamp(),
  };

  if (!existing.exists()) {
    data.user_id = uid;
    data.submitted_at = serverTimestamp();
    data.reviewed_at = null;
  }

  if (pan !== null) {
    const ex = existing.data();
    if (ex?.pan_status === 'verified') {
      throw new Error('PAN is already verified');
    }
    data.pan_number = pan;
    if (ex?.pan_status !== 'rejected' && ex?.pan_status !== 'pending') {
      data.pan_status = 'pending';
    } else if (ex?.pan_status === 'rejected') {
      data.pan_status = 'pending';
      data.pan_rejection_reason = null;
    }
  }

  if (aadhaar !== null) {
    const ex = existing.data();
    if (ex?.aadhaar_status === 'verified') {
      throw new Error('Aadhaar is already verified');
    }
    data.aadhaar_last4 = aadhaar.slice(-4);
    if (ex?.aadhaar_status === 'rejected') {
      data.aadhaar_status = 'pending';
      data.aadhaar_rejection_reason = null;
    } else if (ex?.aadhaar_status !== 'pending') {
      data.aadhaar_status = 'pending';
    }
  }

  if (existing.exists()) {
    await updateDoc(ref, data);
  } else {
    await setDoc(ref, {
      user_id: uid,
      pan_number: pan ?? '',
      pan_status: 'pending',
      pan_rejection_reason: null,
      aadhaar_last4: aadhaar ? aadhaar.slice(-4) : '',
      aadhaar_status: 'pending',
      aadhaar_rejection_reason: null,
      submitted_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      reviewed_at: null,
      ...data,
    });
  }
}

export async function adminReviewKyc(
  uid: string,
  document: 'pan' | 'aadhaar',
  decision: DocumentStatus,
  reason: string | null
): Promise<void> {
  if (decision === 'rejected' && !reason?.trim()) {
    throw new Error('A reason is required');
  }
  const ref = doc(db, 'kyc_records', uid);
  const update: DocumentData = {
    reviewed_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  if (document === 'pan') {
    update.pan_status = decision;
    update.pan_rejection_reason = decision === 'rejected' ? reason : null;
  } else {
    update.aadhaar_status = decision;
    update.aadhaar_rejection_reason = decision === 'rejected' ? reason : null;
  }
  await updateDoc(ref, update);
}

export async function adminSetAccountStatus(
  uid: string,
  status: AccountStatus,
  adminId: string
): Promise<void> {
  if (uid === adminId) {
    throw new Error('cannot block or suspend your own account');
  }
  await updateDoc(doc(db, 'profiles', uid), {
    account_status: status,
    updated_at: serverTimestamp(),
  });
}

export async function adminDeleteUser(uid: string, adminId: string): Promise<void> {
  if (uid === adminId) {
    throw new Error('cannot delete your own account');
  }
  await deleteDoc(doc(db, 'profiles', uid));
  await deleteDoc(doc(db, 'kyc_records', uid)).catch(() => {});
}

export async function isAdmin(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}

export async function claimFirstAdmin(uid: string): Promise<boolean> {
  const snap = await getDocs(collection(db, 'admins'));
  if (snap.size > 0) return false;
  await setDoc(doc(db, 'admins', uid), {
    uid,
    created_at: serverTimestamp(),
  });
  return true;
}

export async function ensureDefaultFeatures(): Promise<void> {
  const snap = await getDocs(collection(db, 'app_features'));
  if (snap.size > 0) return;
  for (const f of DEFAULT_FEATURES) {
    await setDoc(doc(db, 'app_features', f.key), {
      key: f.key,
      label: f.label,
      description: f.description,
      enabled: true,
      updated_at: serverTimestamp(),
    });
  }
}

export async function getAllFeatures(): Promise<AppFeature[]> {
  await ensureDefaultFeatures();
  const snap = await getDocs(query(collection(db, 'app_features'), orderBy('label')));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      key: data.key ?? d.id,
      label: data.label ?? '',
      description: data.description ?? '',
      enabled: data.enabled ?? false,
      updated_at: tsToDate(data.updated_at),
    };
  });
}

export async function updateFeature(key: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(db, 'app_features', key), {
    enabled,
    updated_at: serverTimestamp(),
  });
}

export async function scheduleFeatureUpdate(
  featureKeys: string[],
  enabled: boolean,
  runAt: string
): Promise<void> {
  if (featureKeys.length === 0) {
    throw new Error('Select at least one feature');
  }
  const ref = doc(collection(db, 'scheduled_feature_updates'));
  await setDoc(ref, {
    feature_keys: featureKeys,
    enabled,
    run_at: runAt,
    status: 'pending',
    created_at: serverTimestamp(),
  });
}

export async function applyScheduledUpdate(updateId: string, featureKeys: string[], enabled: boolean): Promise<void> {
  for (const key of featureKeys) {
    await updateFeature(key, enabled);
  }
  await updateDoc(doc(db, 'scheduled_feature_updates', updateId), {
    status: 'applied',
    applied_at: serverTimestamp(),
  });
}

export async function getPendingScheduledUpdates(): Promise<ScheduledFeatureUpdate[]> {
  const snap = await getDocs(
    query(
      collection(db, 'scheduled_feature_updates'),
      where('status', '==', 'pending'),
      orderBy('run_at')
    )
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      feature_keys: data.feature_keys ?? [],
      enabled: data.enabled ?? true,
      run_at: tsToDate(data.run_at),
      status: (data.status ?? 'pending') as 'pending' | 'applied',
    };
  });
}

export async function setPortalLock(
  lockType: LockType,
  activateAt: string,
  deactivateAt: string
): Promise<void> {
  const ref = doc(db, 'portal_locks', lockType);
  await setDoc(ref, {
    id: lockType,
    lock_type: lockType,
    activate_at: activateAt,
    deactivate_at: deactivateAt,
    active: true,
    updated_at: serverTimestamp(),
  });
}

export async function getPortalLocks(): Promise<PortalLock[]> {
  const snap = await getDocs(collection(db, 'portal_locks'));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      lock_type: (data.lock_type ?? d.id) as LockType,
      activate_at: tsToDate(data.activate_at),
      deactivate_at: tsToDate(data.deactivate_at),
      active: data.active ?? false,
    };
  });
}

export function watchProfile(uid: string, cb: (profile: Profile | null) => void): () => void {
  return onSnapshot(doc(db, 'profiles', uid), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const d = snap.data();
    cb({
      id: uid,
      email: d.email ?? '',
      full_name: d.full_name ?? '',
      account_status: (d.account_status ?? 'active') as AccountStatus,
      created_at: tsToDate(d.created_at),
      updated_at: tsToDate(d.updated_at),
    });
  });
}

export function watchKyc(uid: string, cb: (kyc: KycRecord | null) => void): () => void {
  return onSnapshot(doc(db, 'kyc_records', uid), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const d = snap.data();
    cb({
      user_id: uid,
      pan_number: d.pan_number ?? '',
      pan_status: (d.pan_status ?? 'pending') as DocumentStatus,
      pan_rejection_reason: d.pan_rejection_reason ?? null,
      aadhaar_last4: d.aadhaar_last4 ?? '',
      aadhaar_status: (d.aadhaar_status ?? 'pending') as DocumentStatus,
      aadhaar_rejection_reason: d.aadhaar_rejection_reason ?? null,
      submitted_at: tsToDate(d.submitted_at),
      updated_at: tsToDate(d.updated_at),
      reviewed_at: d.reviewed_at ? tsToDate(d.reviewed_at) : null,
    });
  });
}

export function watchFeatures(cb: (features: AppFeature[]) => void): () => void {
  return onSnapshot(query(collection(db, 'app_features'), orderBy('label')), (snap) => {
    const features = snap.docs.map((d) => {
      const data = d.data();
      return {
        key: data.key ?? d.id,
        label: data.label ?? '',
        description: data.description ?? '',
        enabled: data.enabled ?? false,
        updated_at: tsToDate(data.updated_at),
      };
    });
    cb(features);
  });
}

export function watchAllProfiles(cb: (profiles: Profile[]) => void): () => void {
  return onSnapshot(query(collection(db, 'profiles'), orderBy('created_at', 'desc')), (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: data.email ?? '',
          full_name: data.full_name ?? '',
          account_status: (data.account_status ?? 'active') as AccountStatus,
          created_at: tsToDate(data.created_at),
          updated_at: tsToDate(data.updated_at),
        };
      })
    );
  });
}

export function watchAllKyc(cb: (records: KycRecord[]) => void): () => void {
  return onSnapshot(collection(db, 'kyc_records'), (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          user_id: d.id,
          pan_number: data.pan_number ?? '',
          pan_status: (data.pan_status ?? 'pending') as DocumentStatus,
          pan_rejection_reason: data.pan_rejection_reason ?? null,
          aadhaar_last4: data.aadhaar_last4 ?? '',
          aadhaar_status: (data.aadhaar_status ?? 'pending') as DocumentStatus,
          aadhaar_rejection_reason: data.aadhaar_rejection_reason ?? null,
          submitted_at: tsToDate(data.submitted_at),
          updated_at: tsToDate(data.updated_at),
          reviewed_at: data.reviewed_at ? tsToDate(data.reviewed_at) : null,
        };
      })
    );
  });
}

export function watchPendingScheduledUpdates(cb: (updates: ScheduledFeatureUpdate[]) => void): () => void {
  return onSnapshot(
    query(
      collection(db, 'scheduled_feature_updates'),
      where('status', '==', 'pending'),
      orderBy('run_at')
    ),
    (snap) => {
      cb(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            feature_keys: data.feature_keys ?? [],
            enabled: data.enabled ?? true,
            run_at: tsToDate(data.run_at),
            status: (data.status ?? 'pending') as 'pending' | 'applied',
          };
        })
      );
    }
  );
}
