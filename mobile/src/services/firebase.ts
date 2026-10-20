/** Configuração do Firebase, autenticação persistida com SecureStore e sincronização da carteira. */
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Persistence,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from 'firebase/firestore';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getAllRecords, saveSyncedRecord } from '../data/database';
import type { WalletRecord } from '../data/types';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseReady = Object.values(config).every(Boolean);
const existingFirebaseApp = getApps().length > 0;
const app = firebaseReady ? (existingFirebaseApp ? getApp() : initializeApp(config)) : undefined;
// O Firebase Auth instancia a persistência com `new`, então ela precisa ser uma classe.
class SecureStorePersistence {
  static type = 'LOCAL' as const;
  readonly type = 'LOCAL' as const;
  _isAvailable = () => SecureStore.isAvailableAsync();
  // O SecureStore só aceita letras, números, ".", "-" e "_"; o Firebase usa chaves com ":" e "[]".
  private storeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');
  _set = async (key: string, value: unknown) => SecureStore.setItemAsync(this.storeKey(key), JSON.stringify(value));
  _get = async <T,>(key: string) => {
    const value = await SecureStore.getItemAsync(this.storeKey(key));
    return value === null ? null : JSON.parse(value) as T;
  };
  _remove = (key: string) => SecureStore.deleteItemAsync(this.storeKey(key));
  _addListener = (_key: string, _listener: (value: unknown) => void) => undefined;
  _removeListener = (_key: string, _listener: (value: unknown) => void) => undefined;
}
const securePersistence = SecureStorePersistence as unknown as Persistence;
export const auth = app
  ? existingFirebaseApp || Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, { persistence: securePersistence })
  : undefined;
export const firestore = app ? getFirestore(app) : undefined;

export function useDisplayName(): string | undefined {
  const [name, setName] = useState<string | undefined>(auth?.currentUser?.displayName ?? undefined);
  useEffect(() => {
    if (!auth) return;
    setName(auth.currentUser?.displayName ?? undefined);
    return onIdTokenChanged(auth, (user) => setName(user?.displayName ?? undefined));
  }, []);
  return name;
}

export async function updateAccountName(name: string): Promise<void> {
  const user = auth?.currentUser;
  if (!user) return; // modo demonstração: não há conta para atualizar
  await updateProfile(user, { displayName: name.trim() });
  await user.getIdToken(true); // avisa quem observa o nome (useDisplayName)
}

export async function signIn(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase não configurado. Preencha as variáveis EXPO_PUBLIC_FIREBASE_* no arquivo .env.');
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  await persistIdToken(result.user);
  return result.user;
}

export async function register(name: string, email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase não configurado. Preencha as variáveis EXPO_PUBLIC_FIREBASE_* no arquivo .env.');
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(result.user, { displayName: name.trim() });
  await result.user.getIdToken(true); // renova o token para avisar quem observa o nome
  await persistIdToken(result.user);
  return result.user;
}

export async function signInWithGoogleIdToken(idToken: string): Promise<User> {
  if (!auth) throw new Error('Firebase não configurado. Preencha as variáveis EXPO_PUBLIC_FIREBASE_* no arquivo .env.');
  const result = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  await persistIdToken(result.user);
  return result.user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase não configurado. Preencha as variáveis EXPO_PUBLIC_FIREBASE_* no arquivo .env.');
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutUser(): Promise<void> {
  if (auth) await signOut(auth);
  await SecureStore.deleteItemAsync('girls-wallet-id-token');
}

export async function persistIdToken(user: User): Promise<void> {
  await SecureStore.setItemAsync('girls-wallet-id-token', await user.getIdToken());
}

export async function sendBudgetAlert(category: string, spent: number, limit: number): Promise<void> {
  const currentUser = auth?.currentUser;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (!currentUser || !apiUrl) {
    throw new Error('Notificação push indisponível: entre com Firebase e configure EXPO_PUBLIC_API_URL.');
  }
  const response = await fetch(`${apiUrl}/api/push/budget-alert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await currentUser.getIdToken()}`,
    },
    body: JSON.stringify({ category, spent, limit }),
  });
  if (!response.ok) {
    const result: unknown = await response.json().catch(() => undefined);
    const message = typeof result === 'object' && result !== null && 'message' in result
      ? String(result.message)
      : `O servidor não enviou o alerta push (HTTP ${response.status}).`;
    throw new Error(message);
  }
}

export async function syncRecords(uid: string): Promise<void> {
  // Reconcilia por updatedAt; deletedAt é mantido como tombstone para propagar exclusões.
  if (!firestore) throw new Error('Firestore não configurado.');
  const local = await getAllRecords(uid);
  const remoteRef = collection(firestore, 'users', uid, 'records');
  const remote = await getDocs(remoteRef);
  const remoteById = new Map(remote.docs.map((snapshot) => [snapshot.id, snapshot.data()]));
  const localIds = new Set(local.map(({ record }) => record.id));

  for (const { record, deletedAt } of local) {
    const remoteRecord = remoteById.get(record.id);
    const remoteUpdatedAt = Number(remoteRecord?.updatedAt ?? 0);
    if (remoteRecord && remoteUpdatedAt > record.updatedAt) {
      const cloudRecord = remoteRecord.record as WalletRecord;
      await saveSyncedRecord(cloudRecord, remoteRecord.deletedAt ? Number(remoteRecord.deletedAt) : null, uid);
    } else {
      await setDoc(doc(remoteRef, record.id), {
        record,
        updatedAt: record.updatedAt,
        deletedAt,
      });
    }
  }

  for (const snapshot of remote.docs) {
    if (localIds.has(snapshot.id)) continue;
    const data = snapshot.data();
    const record = data.record as WalletRecord | undefined;
    if (!record) throw new Error(`Registro sincronizado inválido: ${snapshot.id}`);
    await saveSyncedRecord(record, data.deletedAt ? Number(data.deletedAt) : null, uid);
  }
}
