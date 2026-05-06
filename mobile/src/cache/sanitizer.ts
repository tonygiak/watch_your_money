/**
 * Sanitizer — the security boundary for the offline cache (ADR-0006 §5).
 *
 * Default-deny: every field outside the documented cacheable subset is
 * dropped silently. The sanitizer runs **before** encryption so that a bug
 * in any new field, a typo, or an upstream schema addition cannot leak data
 * into AsyncStorage.
 *
 * Explicitly NEVER cached:
 *   - `raw_html` (server-only).
 *   - The Bearer JWT or refresh token (those live in `expo-secure-store`).
 *   - Any field added in the future without an explicit ADR sign-off.
 */

import type { CacheableReceipt, CacheableReceiptItem } from "./types";

/**
 * Sanitize a receipt-shaped object into the cacheable subset.
 *
 * Returns `null` when the input cannot be coerced into a usable cacheable
 * receipt (missing `id`, missing `merchant_name`, etc.). The screen layer
 * uses the null result to skip the cache write — never to surface an error.
 */
export function sanitizeForCache(input: unknown): CacheableReceipt | null {
  if (!isObject(input)) return null;
  const record = input as Record<string, unknown>;

  const id = readString(record.id);
  const merchantName = readString(record.merchant_name);
  const issueDate = readString(record.issue_date);
  if (!id || !merchantName || !issueDate) return null;

  const items = readArray(record.items)
    .map(sanitizeItem)
    .filter((item): item is CacheableReceiptItem => item !== null);

  return {
    id,
    country_code: readString(record.country_code) || "GR",
    merchant_name: merchantName,
    merchant_afm: readString(record.merchant_afm),
    merchant_address: readString(record.merchant_address),
    document_number: readString(record.document_number),
    mark: readString(record.mark),
    issue_date: issueDate,
    transmission_timestamp:
      readString(record.transmission_timestamp) || null,
    payment_method: readString(record.payment_method),
    provider: readString(record.provider),
    subtotal: readMoneyString(record.subtotal),
    discount: readMoneyString(record.discount),
    surcharge: readMoneyString(record.surcharge),
    total: readMoneyString(record.total),
    net_value: readMoneyString(record.net_value),
    vat_total: readMoneyString(record.vat_total),
    is_business_expense: readBoolean(record.is_business_expense),
    business_category: readString(record.business_category) || null,
    notes: readString(record.notes) || null,
    created_at: readString(record.created_at) || new Date(0).toISOString(),
    items,
  };
}

function sanitizeItem(input: unknown): CacheableReceiptItem | null {
  if (!isObject(input)) return null;
  const record = input as Record<string, unknown>;
  const id = readString(record.id);
  const description = readString(record.description);
  if (!id || !description) return null;

  return {
    id,
    ean: readString(record.ean),
    description,
    unit: readString(record.unit),
    quantity: readMoneyString(record.quantity),
    unit_price: readMoneyString(record.unit_price),
    pre_discount_value: readMoneyString(record.pre_discount_value),
    discount: readMoneyString(record.discount),
    vat_rate: readMoneyString(record.vat_rate),
    total_value: readMoneyString(record.total_value),
    inferred_category: readString(record.inferred_category) || null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function readMoneyString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  return "0.00";
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
