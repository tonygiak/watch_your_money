/**
 * Cache repository interface (ADR-0006 §6).
 *
 * Mirrors the architecture used by `BaseReceiptParser`, `ReceiptStorage`
 * (backend), and `InsightsRepository` (backend): an interface, an
 * `InMemoryCacheRepository` for tests + local dev, and an
 * `EncryptedAsyncStorageCacheRepository` for production.
 *
 * Screens (Home, ReceiptDetail, Insights, Scanner) consume the interface,
 * never the concrete class. This lets tests run without `@noble/ciphers`,
 * `expo-secure-store`, or `@react-native-async-storage/async-storage` —
 * keeping the gate green in `node` and the production deps reviewed only
 * inside `EncryptedAsyncStorageCacheRepository.ts`.
 */

/** Numeric cache fields are decimals-as-strings (ADR-0006 §5 / ADR-0005 §5). */
export type CacheableReceiptItem = {
  id: string;
  ean: string;
  description: string;
  unit: string;
  quantity: string;
  unit_price: string;
  pre_discount_value: string;
  discount: string;
  vat_rate: string;
  total_value: string;
  inferred_category: string | null;
};

export type CacheableReceipt = {
  id: string;
  country_code: string;
  merchant_name: string;
  merchant_afm: string;
  merchant_address: string;
  document_number: string;
  mark: string;
  issue_date: string;
  transmission_timestamp: string | null;
  payment_method: string;
  provider: string;
  subtotal: string;
  discount: string;
  surcharge: string;
  total: string;
  net_value: string;
  vat_total: string;
  is_business_expense: boolean;
  business_category: string | null;
  notes: string | null;
  created_at: string;
  items: CacheableReceiptItem[];
};

/**
 * Stored alongside the receipt blob; ``last_seen_at`` is the LRU sort key
 * (ADR-0006 §3) and is refreshed every cache hit.
 */
export type CacheIndexEntry = {
  id: string;
  issue_date: string;
  last_seen_at: string;
};

/** Hard cap per ADR-0006 §3. */
export const CACHE_LRU_CAP = 200;

/** Storage layout key namespaces (ADR-0006 §2). */
export const CACHE_RECEIPT_KEY_PREFIX = "wym.cache.receipt.";
export const CACHE_INDEX_KEY = "wym.cache.index";
export const CACHE_VERSION_KEY = "wym.cache.version";
export const CACHE_VERSION = 1;
export const CACHE_KEY_NAMESPACE = "wym.cache.aes-256-gcm.v1";

export interface CacheRepository {
  /** Return the cached receipt by id (or `null` if absent / index miss). */
  getById(id: string): Promise<CacheableReceipt | null>;

  /** Return up to ``limit`` cached receipts, newest-first by ``issue_date``. */
  getList(limit?: number): Promise<CacheableReceipt[]>;

  /**
   * Insert / refresh a receipt. Sanitization is performed inside the
   * implementation (default-deny on unknown fields per ADR-0006 §5);
   * callers may pass an unknown-shaped object — only the documented
   * cacheable subset survives. LRU eviction triggered when count > cap.
   */
  put(receipt: unknown, now?: Date): Promise<void>;

  /** Bulk variant of ``put`` for receipt-list reads. */
  putMany(receipts: unknown[], now?: Date): Promise<void>;

  /**
   * Refresh ``last_seen_at`` on the index entry for ``id``. Called by the
   * Receipt-detail screen on open per ADR-0006 §4.
   */
  touch(id: string, now?: Date): Promise<void>;

  /** Drop everything (`Καθαρισμός cache`). */
  clear(): Promise<void>;
}
