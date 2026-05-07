/**
 * Cache key rotation on sign-out (DES-0004 §3.5 / ADR-0006 §2).
 *
 * Goals:
 *   1. Drop the encryption key from `expo-secure-store` so the next user's
 *      session encrypts under a fresh 256-bit secret. After rotation, the
 *      previous user's ciphertext on disk is unreadable.
 *   2. Drop every cached receipt + the cache index from AsyncStorage so
 *      the next user starts with an empty list (a sanity check on top of
 *      key rotation — even if a stale ciphertext blob survives, the index
 *      no longer references it).
 *   3. Keep this side-effecting code outside the encrypted repo so the
 *      receipt-detail screen never needs to know about it. The Profile
 *      screen calls this once on sign-out, the receipt cache then bootstraps
 *      a fresh key on next session start.
 *
 * Imports of native deps (`expo-secure-store`,
 * `@react-native-async-storage/async-storage`) live behind dynamic
 * `require` so this file stays loadable inside the pure-TS Jest project
 * (where these deps are mocked via the jest-expo preset for the rn project
 * only).
 */

import {
  CACHE_INDEX_KEY,
  CACHE_KEY_NAMESPACE,
  CACHE_RECEIPT_KEY_PREFIX,
  CACHE_VERSION_KEY,
} from "./types";

export type RotateOptions = {
  /** Injectable for tests; defaults to the live `expo-secure-store`. */
  secureStore?: {
    deleteItemAsync(key: string): Promise<void>;
  };
  /** Injectable for tests; defaults to the live AsyncStorage. */
  asyncStorage?: {
    getAllKeys(): Promise<readonly string[] | string[]>;
    multiRemove(keys: string[]): Promise<void>;
    removeItem(key: string): Promise<void>;
  };
};

/**
 * Wipe the encryption key and every cached blob.
 *
 * Best-effort: any individual storage call that throws is swallowed and
 * logged via the returned warning array — the sign-out flow must still
 * succeed even if a single key delete fails (otherwise we'd leave the user
 * stuck on Profile after Supabase has already revoked their session).
 */
export async function rotateCacheKeyOnSignOut(
  options: RotateOptions = {}
): Promise<{ wiped: number; warnings: string[] }> {
  const warnings: string[] = [];
  let wiped = 0;

  const secureStore = options.secureStore ?? loadSecureStore();
  const asyncStorage = options.asyncStorage ?? loadAsyncStorage();

  try {
    await secureStore.deleteItemAsync(CACHE_KEY_NAMESPACE);
  } catch (err) {
    warnings.push(`secure-store-delete: ${(err as Error).message}`);
  }

  try {
    const allKeys = await asyncStorage.getAllKeys();
    const cacheKeys = (allKeys as string[]).filter(
      (k) =>
        k.startsWith(CACHE_RECEIPT_KEY_PREFIX) ||
        k === CACHE_INDEX_KEY ||
        k === CACHE_VERSION_KEY
    );
    if (cacheKeys.length > 0) {
      await asyncStorage.multiRemove(cacheKeys);
      wiped = cacheKeys.length;
    }
  } catch (err) {
    warnings.push(`async-storage-clear: ${(err as Error).message}`);
  }

  return { wiped, warnings };
}

// ---------------------------------------------------------------------------
// Lazy native loaders — kept out of the test path.
// ---------------------------------------------------------------------------

function loadSecureStore(): RotateOptions["secureStore"] & object {
  // Avoid `require` so the bundler (and Jest under `node`) doesn't try to
  // resolve `expo-secure-store` synchronously when this module is just
  // imported but never called.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("expo-secure-store");
  return {
    deleteItemAsync: (key: string) => m.deleteItemAsync(key),
  };
}

function loadAsyncStorage(): RotateOptions["asyncStorage"] & object {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@react-native-async-storage/async-storage").default;
  return {
    getAllKeys: () => m.getAllKeys(),
    multiRemove: (keys: string[]) => m.multiRemove(keys),
    removeItem: (key: string) => m.removeItem(key),
  };
}
