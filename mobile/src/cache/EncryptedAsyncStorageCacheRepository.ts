/**
 * Production cache repository (ADR-0006).
 *
 * Storage substrate: ``@react-native-async-storage/async-storage``.
 * Encryption: AES-256-GCM via ``@noble/ciphers/aes`` (audited, JS-pure).
 * Key custody: 32 random bytes generated on first run, kept in
 * ``expo-secure-store`` under the key ``CACHE_KEY_NAMESPACE``.
 *
 * Ciphertext layout (all base64 inside the AsyncStorage value):
 *   "v1." + base64(iv 12B) + "." + base64(ciphertext+tag)
 *
 * The encrypted variant deliberately reuses ``sanitizeForCache`` so the
 * "what fields are stored" decision is single-sourced. LRU eviction
 * mirrors the in-memory repository, and ``raw_html`` is dropped before
 * encryption (defense-in-depth).
 *
 * Imports of native deps live behind the constructor to keep the module
 * loadable in tests where these deps are mocked. Screens construct the
 * encrypted repo lazily via ``createEncryptedCacheRepository`` so
 * unit-testable code never imports ``expo-secure-store`` directly.
 */

import { gcm } from "@noble/ciphers/aes";
import { utf8ToBytes, bytesToUtf8 } from "@noble/ciphers/utils";
import { randomBytes } from "@noble/ciphers/webcrypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { sanitizeForCache } from "./sanitizer";
import {
  CACHE_INDEX_KEY,
  CACHE_KEY_NAMESPACE,
  CACHE_LRU_CAP,
  CACHE_RECEIPT_KEY_PREFIX,
  CACHE_VERSION,
  CACHE_VERSION_KEY,
  type CacheableReceipt,
  type CacheIndexEntry,
  type CacheRepository,
} from "./types";

const IV_BYTES = 12;
const KEY_BYTES = 32;
const ENVELOPE_PREFIX = "v1.";

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export async function createEncryptedCacheRepository(): Promise<CacheRepository> {
  const key = await loadOrCreateKey();
  await ensureSchemaVersion();
  return new EncryptedAsyncStorageCacheRepository(key);
}

// ---------------------------------------------------------------------------
// Internal — exported only for the integration test under
// `mobile/__tests__/cache/encrypted.contract.test.ts` (BLG-0007 follow-up).
// Production callers go through the factory above.
// ---------------------------------------------------------------------------

export class EncryptedAsyncStorageCacheRepository implements CacheRepository {
  constructor(private readonly key: Uint8Array) {
    if (key.byteLength !== KEY_BYTES) {
      throw new Error(`cache key must be ${KEY_BYTES} bytes`);
    }
  }

  async getById(id: string): Promise<CacheableReceipt | null> {
    const blob = await AsyncStorage.getItem(receiptKey(id));
    if (!blob) return null;
    try {
      return this.decrypt(blob);
    } catch {
      // Corruption / wrong key: drop the entry rather than throwing on the
      // hot path. The Home / Detail screen treats `null` as "cache miss".
      await AsyncStorage.removeItem(receiptKey(id));
      await this.removeFromIndex(id);
      return null;
    }
  }

  async getList(limit?: number): Promise<CacheableReceipt[]> {
    const index = await this.readIndex();
    const ordered = [...index.values()].sort((a, b) =>
      compareIso(b.issue_date, a.issue_date)
    );
    const slice =
      typeof limit === "number" ? ordered.slice(0, limit) : ordered;
    const out: CacheableReceipt[] = [];
    for (const entry of slice) {
      const receipt = await this.getById(entry.id);
      if (receipt) out.push(receipt);
    }
    return out;
  }

  async put(receipt: unknown, now: Date = new Date()): Promise<void> {
    const sanitized = sanitizeForCache(receipt);
    if (!sanitized) return;
    const blob = this.encrypt(sanitized);
    await AsyncStorage.setItem(receiptKey(sanitized.id), blob);

    const index = await this.readIndex();
    index.set(sanitized.id, {
      id: sanitized.id,
      issue_date: sanitized.issue_date,
      last_seen_at: now.toISOString(),
    });
    await this.evictAndPersist(index);
  }

  async putMany(receipts: unknown[], now: Date = new Date()): Promise<void> {
    const index = await this.readIndex();
    for (const receipt of receipts) {
      const sanitized = sanitizeForCache(receipt);
      if (!sanitized) continue;
      const blob = this.encrypt(sanitized);
      await AsyncStorage.setItem(receiptKey(sanitized.id), blob);
      index.set(sanitized.id, {
        id: sanitized.id,
        issue_date: sanitized.issue_date,
        last_seen_at: now.toISOString(),
      });
    }
    await this.evictAndPersist(index);
  }

  async touch(id: string, now: Date = new Date()): Promise<void> {
    const index = await this.readIndex();
    const entry = index.get(id);
    if (!entry) return;
    index.set(id, { ...entry, last_seen_at: now.toISOString() });
    await this.persistIndex(index);
  }

  async clear(): Promise<void> {
    const index = await this.readIndex();
    for (const entry of index.values()) {
      await AsyncStorage.removeItem(receiptKey(entry.id));
    }
    await AsyncStorage.removeItem(CACHE_INDEX_KEY);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private encrypt(receipt: CacheableReceipt): string {
    const iv = randomBytes(IV_BYTES);
    const aead = gcm(this.key, iv);
    const plaintext = utf8ToBytes(JSON.stringify(receipt));
    const ciphertext = aead.encrypt(plaintext);
    return `${ENVELOPE_PREFIX}${toBase64(iv)}.${toBase64(ciphertext)}`;
  }

  private decrypt(blob: string): CacheableReceipt | null {
    if (!blob.startsWith(ENVELOPE_PREFIX)) return null;
    const body = blob.slice(ENVELOPE_PREFIX.length);
    const dot = body.indexOf(".");
    if (dot < 0) return null;
    const iv = fromBase64(body.slice(0, dot));
    const ciphertext = fromBase64(body.slice(dot + 1));
    const aead = gcm(this.key, iv);
    const plaintext = aead.decrypt(ciphertext);
    const json = bytesToUtf8(plaintext);
    const parsed = JSON.parse(json) as unknown;
    // Re-sanitize on decrypt: defense-in-depth against an attacker who
    // somehow planted a forged blob with the right key.
    return sanitizeForCache(parsed);
  }

  private async readIndex(): Promise<Map<string, CacheIndexEntry>> {
    const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    if (!raw) return new Map();
    try {
      const arr = JSON.parse(raw) as CacheIndexEntry[];
      const map = new Map<string, CacheIndexEntry>();
      for (const e of arr) {
        if (
          e &&
          typeof e.id === "string" &&
          typeof e.issue_date === "string" &&
          typeof e.last_seen_at === "string"
        ) {
          map.set(e.id, e);
        }
      }
      return map;
    } catch {
      return new Map();
    }
  }

  private async persistIndex(
    index: Map<string, CacheIndexEntry>
  ): Promise<void> {
    await AsyncStorage.setItem(
      CACHE_INDEX_KEY,
      JSON.stringify([...index.values()])
    );
  }

  private async removeFromIndex(id: string): Promise<void> {
    const index = await this.readIndex();
    if (!index.delete(id)) return;
    await this.persistIndex(index);
  }

  private async evictAndPersist(
    index: Map<string, CacheIndexEntry>
  ): Promise<void> {
    if (index.size > CACHE_LRU_CAP) {
      const ordered = [...index.values()].sort((a, b) =>
        compareIso(a.last_seen_at, b.last_seen_at)
      );
      const dropCount = index.size - CACHE_LRU_CAP;
      for (let i = 0; i < dropCount; i += 1) {
        const victim = ordered[i];
        if (!victim) continue;
        index.delete(victim.id);
        await AsyncStorage.removeItem(receiptKey(victim.id));
      }
    }
    await this.persistIndex(index);
  }
}

// ---------------------------------------------------------------------------
// Key custody (ADR-0006 §2)
// ---------------------------------------------------------------------------

async function loadOrCreateKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(CACHE_KEY_NAMESPACE);
  if (existing) {
    const bytes = fromBase64(existing);
    if (bytes.byteLength === KEY_BYTES) return bytes;
    // Old / corrupt key: regenerate and let the caller treat the on-disk
    // ciphertext as garbage. ``getById`` will drop unreadable entries.
  }
  const fresh = randomBytes(KEY_BYTES);
  await SecureStore.setItemAsync(CACHE_KEY_NAMESPACE, toBase64(fresh), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return fresh;
}

async function ensureSchemaVersion(): Promise<void> {
  const stored = await AsyncStorage.getItem(CACHE_VERSION_KEY);
  if (stored === String(CACHE_VERSION)) return;
  // Different schema -> drop everything (no migration path for cache).
  if (stored !== null) {
    await AsyncStorage.clear();
  }
  await AsyncStorage.setItem(CACHE_VERSION_KEY, String(CACHE_VERSION));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function receiptKey(id: string): string {
  return `${CACHE_RECEIPT_KEY_PREFIX}${id}`;
}

function compareIso(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function toBase64(bytes: Uint8Array): string {
  // RN ships a `Buffer`-less environment; use a hand-rolled encoder so this
  // module also loads under jest-expo's node runtime.
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // `globalThis.btoa` exists in Hermes / RN runtime and in modern Node.
  // Fall back to `Buffer` when neither is available (CI smoke tests).
  if (typeof globalThis.btoa === "function") return globalThis.btoa(binary);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return Buffer.from(binary, "binary").toString("base64");
}

function fromBase64(b64: string): Uint8Array {
  let binary: string;
  if (typeof globalThis.atob === "function") {
    binary = globalThis.atob(b64);
  } else {
    binary = Buffer.from(b64, "base64").toString("binary");
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
