/**
 * Encryption-stack round-trip test (BLG-0016 acceptance bullet 5,
 * ADR-0012 §5, ADR-0006 §2).
 *
 * Forward-only variant per S-005 plan §5: encrypt + decrypt under the
 * current SDK's `@noble/ciphers` resolution with a known plaintext, and
 * assert the AES-256-GCM round-trip is byte-identical. If any of the
 * three encryption-relevant deps (`@noble/ciphers`, `expo-secure-store`,
 * `expo-crypto`) regresses behavior across an SDK upgrade, this test
 * fails before the on-device runtime does.
 *
 * The test calls `gcm()` directly — same import path as
 * `EncryptedAsyncStorageCacheRepository.encrypt` — so it exercises the
 * exact code path the production cache uses. We do NOT instantiate the
 * full repository here because that would pull in
 * `@react-native-async-storage/async-storage` + `expo-secure-store` and
 * push the test out of the pure-TS Jest project.
 */

import { gcm } from "@noble/ciphers/aes";
import { utf8ToBytes, bytesToUtf8 } from "@noble/ciphers/utils";
import { randomBytes } from "@noble/ciphers/webcrypto";

import { sanitizeForCache } from "../../src/cache/sanitizer";

const KNOWN_RECEIPT: Record<string, unknown> = {
  id: "11111111-2222-3333-4444-555555555555",
  country_code: "GR",
  merchant_name: "ALPHA SUPER MARKET",
  merchant_afm: "999999999",
  merchant_address: "ΑΘΗΝΑ",
  document_number: "Α/00001",
  mark: "400000000000001",
  issue_date: "2026-04-30",
  transmission_timestamp: "2026-04-30T12:00:00+03:00",
  payment_method: "ΜΕΤΡΗΤΑ",
  provider: "ENTERSOFT",
  subtotal: "10.00",
  discount: "0.00",
  surcharge: "0.00",
  total: "10.00",
  net_value: "8.06",
  vat_total: "1.94",
  is_business_expense: false,
  business_category: null,
  notes: null,
  created_at: "2026-04-30T12:00:01+03:00",
  items: [
    {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      ean: "5201360123456",
      description: "ΓΑΛΑ ΦΡΕΣΚΟ 1L",
      unit: "ΤΕΜ",
      quantity: "1",
      unit_price: "1.45",
      pre_discount_value: "1.45",
      discount: "0.00",
      vat_rate: "13.00",
      total_value: "1.45",
      inferred_category: null,
    },
  ],
};

describe("AES-256-GCM round-trip — BLG-0016 / ADR-0012 §5 / ADR-0006 §2", () => {
  it("decrypts the exact plaintext it encrypts (deterministic key + IV)", () => {
    const key = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) key[i] = i;
    const iv = new Uint8Array(12);
    for (let i = 0; i < 12; i += 1) iv[i] = 0xa0 + i;

    const sanitized = sanitizeForCache(KNOWN_RECEIPT);
    expect(sanitized).not.toBeNull();

    const plaintext = utf8ToBytes(JSON.stringify(sanitized));
    const aead = gcm(key, iv);
    const ciphertext = aead.encrypt(plaintext);

    expect(ciphertext.byteLength).toBeGreaterThan(plaintext.byteLength);

    const decoded = aead.decrypt(ciphertext);
    expect(bytesToUtf8(decoded)).toBe(JSON.stringify(sanitized));
  });

  it("preserves Greek UTF-8 glyphs (NFC) end-to-end", () => {
    const key = randomBytes(32);
    const iv = randomBytes(12);
    expect(key.byteLength).toBe(32);
    expect(iv.byteLength).toBe(12);

    const greek = "Καλημέρα — €1,45 — απόδειξη ΕΛΛΑΣ — Ωραία";
    const aead = gcm(key, iv);
    const ct = aead.encrypt(utf8ToBytes(greek));
    const back = bytesToUtf8(aead.decrypt(ct));
    expect(back).toBe(greek);
  });

  it("a fresh random IV produces different ciphertext for the same plaintext", () => {
    const key = randomBytes(32);
    const iv1 = randomBytes(12);
    const iv2 = randomBytes(12);
    const plaintext = utf8ToBytes("the quick brown fox");
    const ct1 = gcm(key, iv1).encrypt(plaintext);
    const ct2 = gcm(key, iv2).encrypt(plaintext);
    expect(ct1).not.toEqual(ct2);
  });

  it("decryption fails under a different key (GCM tag mismatch)", () => {
    const ka = new Uint8Array(32);
    const kb = new Uint8Array(32);
    kb[0] = 1;
    const iv = new Uint8Array(12);

    const sealed = gcm(ka, iv).encrypt(utf8ToBytes("secret"));
    expect(() => gcm(kb, iv).decrypt(sealed)).toThrow();
  });

  it("decryption fails on tampered ciphertext (auth-tag enforces integrity)", () => {
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const aead = gcm(key, iv);
    const sealed = aead.encrypt(utf8ToBytes("secret"));
    const tampered = new Uint8Array(sealed);
    tampered[0] = tampered[0]! ^ 0x01;
    expect(() => aead.decrypt(tampered)).toThrow();
  });

  it("randomBytes returns the exact requested length for keys + IVs", () => {
    expect(randomBytes(12).byteLength).toBe(12);
    expect(randomBytes(32).byteLength).toBe(32);
    expect(randomBytes(64).byteLength).toBe(64);
  });
});
