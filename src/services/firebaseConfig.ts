import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence internal harmless gRPC idle stream cancellation notices
try {
  setLogLevel('error');
} catch {
  // Ignored in non-browser contexts
}

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Critical: Specify firestoreDatabaseId with auto-detect long polling to prevent idle stream dropouts
export const db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
})();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Connection testing as mandated by skill
let quotaExhaustedState = false;
const quotaListeners = new Set<(exhausted: boolean) => void>();

const LOCAL_DEV_MODE_KEY = 'pb_local_dev_sync_mode';
let localDevSyncMode = (() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(LOCAL_DEV_MODE_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
  }
  // Default to false so live writes and connection work normally
  return false;
})();

export function isLocalDevMode(): boolean {
  return localDevSyncMode;
}

export function setLocalDevMode(enabled: boolean) {
  localDevSyncMode = enabled;
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(LOCAL_DEV_MODE_KEY, String(enabled));
  }
  quotaListeners.forEach(cb => {
    try { cb(isQuotaExhausted()); } catch {}
  });
}

export function isQuotaExhausted(): boolean {
  return quotaExhaustedState;
}

export function setQuotaExhausted(exhausted: boolean = true) {
  if (quotaExhaustedState !== exhausted) {
    quotaExhaustedState = exhausted;
    quotaListeners.forEach(cb => {
      try { cb(isQuotaExhausted()); } catch {}
    });
  }
}

export function onQuotaStateChange(callback: (exhausted: boolean) => void): () => void {
  quotaListeners.add(callback);
  return () => quotaListeners.delete(callback);
}

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  return (
    code === 'resource-exhausted' ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('resource-exhausted') ||
    msg.toLowerCase().includes('quota limit exceeded')
  );
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (isQuotaError(error)) {
      setQuotaExhausted(true);
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration: client is offline");
      return false;
    }
    // Document might not exist, which still proves server reached
    return true;
  }
}

// Error handling conforming to skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  if (isQuotaError(error)) {
    setQuotaExhausted(true);
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Trigger initial connection check
testFirestoreConnection().catch(console.warn);

export { signInWithPopup, fbSignOut, onAuthStateChanged };
export type { User };
