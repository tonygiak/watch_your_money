import { InMemoryCacheRepository } from "../../src/cache/InMemoryCacheRepository";
import { CACHE_LRU_CAP } from "../../src/cache/types";

function receiptOf(id: string, issueDate: string): Record<string, unknown> {
  return {
    id,
    country_code: "GR",
    merchant_name: "ALPHA",
    merchant_afm: "999999999",
    issue_date: issueDate,
    total: "10.00",
    items: [
      {
        id: `${id}-item-1`,
        description: "ΓΑΛΑ",
        ean: "",
      },
    ],
  };
}

describe("InMemoryCacheRepository — ADR-0006 §6", () => {
  it("put + getById round-trips a sanitized receipt", async () => {
    const cache = new InMemoryCacheRepository();
    await cache.put(receiptOf("a", "2026-04-30"));
    const out = await cache.getById("a");
    expect(out).not.toBeNull();
    expect(out!.merchant_name).toBe("ALPHA");
  });

  it("put silently drops invalid receipts", async () => {
    const cache = new InMemoryCacheRepository();
    await cache.put({ no: "id" });
    expect(await cache.getById("a")).toBeNull();
  });

  it("getList sorts newest-first by issue_date", async () => {
    const cache = new InMemoryCacheRepository();
    await cache.put(receiptOf("old", "2026-01-01"));
    await cache.put(receiptOf("mid", "2026-03-15"));
    await cache.put(receiptOf("new", "2026-04-30"));
    const list = await cache.getList();
    expect(list.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });

  it("getList honors the limit", async () => {
    const cache = new InMemoryCacheRepository();
    await cache.put(receiptOf("a", "2026-04-29"));
    await cache.put(receiptOf("b", "2026-04-30"));
    const list = await cache.getList(1);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe("b");
  });

  it("touch refreshes last_seen_at without changing receipt content", async () => {
    const cache = new InMemoryCacheRepository();
    await cache.put(receiptOf("a", "2026-04-30"), new Date("2026-04-01T00:00:00Z"));
    await cache.touch("a", new Date("2026-04-15T00:00:00Z"));
    const out = await cache.getById("a");
    expect(out!.merchant_name).toBe("ALPHA");
  });

  it("touch on a missing id is a no-op", async () => {
    const cache = new InMemoryCacheRepository();
    await cache.touch("nonexistent");
    expect(cache.size()).toBe(0);
  });

  it("clear empties everything", async () => {
    const cache = new InMemoryCacheRepository();
    await cache.put(receiptOf("a", "2026-04-30"));
    await cache.clear();
    expect(await cache.getById("a")).toBeNull();
    expect(await cache.getList()).toEqual([]);
  });

  it("LRU evicts the oldest-by-last_seen_at when count > cap", async () => {
    const cache = new InMemoryCacheRepository();
    // Seed cap entries with chronological last_seen_at.
    for (let i = 0; i < CACHE_LRU_CAP; i += 1) {
      const id = `r${i.toString().padStart(4, "0")}`;
      const ts = new Date(2026, 0, 1, 0, 0, i); // increases by seconds
      await cache.put(receiptOf(id, "2026-01-01"), ts);
    }
    expect(cache.size()).toBe(CACHE_LRU_CAP);

    // One more — must evict r0000 (oldest last_seen_at).
    await cache.put(
      receiptOf("rextra", "2026-04-30"),
      new Date(2026, 11, 31)
    );
    expect(cache.size()).toBe(CACHE_LRU_CAP);
    expect(await cache.getById("r0000")).toBeNull();
    expect(await cache.getById("rextra")).not.toBeNull();
  });

  it("touch promotes a receipt away from LRU eviction", async () => {
    const cache = new InMemoryCacheRepository();
    for (let i = 0; i < CACHE_LRU_CAP; i += 1) {
      const id = `r${i.toString().padStart(4, "0")}`;
      const ts = new Date(2026, 0, 1, 0, 0, i);
      await cache.put(receiptOf(id, "2026-01-01"), ts);
    }
    // Promote r0000 to "now".
    await cache.touch("r0000", new Date(2026, 11, 30));
    // Insert one more — r0001 should be evicted (oldest after promotion).
    await cache.put(
      receiptOf("rextra", "2026-04-30"),
      new Date(2026, 11, 31)
    );
    expect(await cache.getById("r0000")).not.toBeNull();
    expect(await cache.getById("r0001")).toBeNull();
  });

  it("putMany ignores invalid entries while keeping valid ones", async () => {
    const cache = new InMemoryCacheRepository();
    await cache.putMany([
      receiptOf("a", "2026-04-30"),
      { not: "valid" },
      receiptOf("b", "2026-04-29"),
    ]);
    expect(cache.size()).toBe(2);
  });
});
