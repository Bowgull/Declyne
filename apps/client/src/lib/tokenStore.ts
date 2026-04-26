import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

const KEY = 'declyne_api_token';

let cachedToken: string | null = null;

/**
 * Resolve the API token. Order of precedence:
 *  1. In-memory cache (set after first read)
 *  2. Secure storage (Keychain on iOS, localStorage fallback on web)
 *  3. Build-time env (VITE_API_TOKEN) — migration path only. If found,
 *     it is written into secure storage and then env is no longer consulted.
 * Returns empty string if nothing is set yet (caller should redirect to onboarding).
 */
export async function getToken(): Promise<string> {
  if (cachedToken !== null) return cachedToken;

  const fromStore = await readFromStore();
  if (fromStore) {
    cachedToken = fromStore;
    return fromStore;
  }

  const fromEnv = (import.meta.env.VITE_API_TOKEN as string | undefined) ?? '';
  if (fromEnv) {
    await writeToStore(fromEnv);
    cachedToken = fromEnv;
    return fromEnv;
  }

  cachedToken = '';
  return '';
}

export async function setToken(token: string): Promise<void> {
  await writeToStore(token);
  cachedToken = token;
}

export async function clearToken(): Promise<void> {
  await removeFromStore();
  cachedToken = '';
}

export function hasCachedToken(): boolean {
  return cachedToken !== null && cachedToken !== '';
}

async function readFromStore(): Promise<string> {
  try {
    const result = await SecureStoragePlugin.get({ key: KEY });
    return result.value ?? '';
  } catch {
    return '';
  }
}

async function writeToStore(value: string): Promise<void> {
  await SecureStoragePlugin.set({ key: KEY, value });
}

async function removeFromStore(): Promise<void> {
  try {
    await SecureStoragePlugin.remove({ key: KEY });
  } catch {
    /* not present */
  }
}
