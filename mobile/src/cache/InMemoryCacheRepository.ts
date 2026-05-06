/**
 * In-memory cache repository (ADR-0006 §6).
 *
 * Tests + local dev. Mirrors the production
 * `EncryptedAsyncStorageCacheRepository` semantics — same sanitizer, same
 * LRU eviction, same touch behavior — minus the encryption layer. The
 * shared semantics are deliberate so screen code can be tested against
 * this fake without re-implementing the LRU + sanitizer in the encrypted
 * variant.
 */

import { sanitizeForCache } from "./sanitizer";
import type {
  CacheableReceipt,
  CacheIndexEntry,
  CacheRepository,
} from "./types";
import { CACHE_LRU_CAP } from "./types";

export class InMemoryCacheRepository implements CacheRepository {
  private receipts = new Map<string, CacheableReceipt>();
  private index = new Map<string, CacheIndexEntry>();

  async getById(id: string): Promise<CacheableReceipt | null> {
    return this.receipts.get(id) ?? null;
  }

  async getList(limit?: number): Promise<CacheableReceipt[]> {
    const entries = Array.from(this.index.values()).sort((a, b) =>
      compareIso(b.issue_date, a.issue_date)
    );
    const sliced = typeof limit === "number" ? entries.slice(0, limit) : entries;
    return sliced
      .map((entry) => this.receipts.get(entry.id))
      .filter((r): r is CacheableReceipt => r !== undefined);
  }

  async put(receipt: unknown, now: Date = new Date()): Promise<void> {
    const sanitized = sanitizeForCache(receipt);
    if (!sanitized) return;
    this.receipts.set(sanitized.id, sanitized);
    this.index.set(sanitized.id, {
      id: sanitized.id,
      issue_date: sanitized.issue_date,
      last_seen_at: now.toISOString(),
    });
    this.evictIfNeeded();
  }

  async putMany(receipts: unknown[], now: Date = new Date()): Promise<void> {
    for (const receipt of receipts) {
      await this.put(receipt, now);
    }
  }

  async touch(id: string, now: Date = new Date()): Promise<void> {
    const entry = this.index.get(id);
    if (!entry) return;
    this.index.set(id, { ...entry, last_seen_at: now.toISOString() });
  }

  async clear(): Promise<void> {
    this.receipts.clear();
    this.index.clear();
  }

  /**
   * Test-friendly accessor — counts entries in the live index. Production
   * code never reads this; kept on the in-memory class only to make LRU
   * tests readable.
   */
  size(): number {
    return this.index.size;
  }

  // -------------------------------------------------------------------------
  // LRU eviction (ADR-0006 §3) — drop the oldest-by-`last_seen_at` whenever
  // the cap is exceeded. Stable sort preserves insertion order on ties so
  // the eviction is deterministic across runs.
  // -------------------------------------------------------------------------
  private evictIfNeeded(): void {
    if (this.index.size <= CACHE_LRU_CAP) return;
    const ordered = Array.from(this.index.values()).sort((a, b) =>
      compareIso(a.last_seen_at, b.last_seen_at)
    );
    const dropCount = this.index.size - CACHE_LRU_CAP;
    for (let i = 0; i < dropCount; i += 1) {
      const victim = ordered[i];
      if (!victim) continue;
      this.index.delete(victim.id);
      this.receipts.delete(victim.id);
    }
  }
}

function compareIso(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
