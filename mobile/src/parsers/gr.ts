/**
 * Greek e-invoice QR validator (mobile).
 *
 * Mirrored from `backend/app/parsers/gr/url.py` so the on-device check and the
 * server check are guaranteed to agree (ADR-0003 §3, defense in depth).
 *
 * Both validators MUST stay in sync. When you change one, change the other.
 */

export const GR_VIEWER_PATH_REGEX =
  /^\/edocuments\/ViewInvoice\/-1\/[0-9a-fA-F-]+_[A-Za-z0-9]+$/;

export const GR_HOST = "e-invoicing.gr";

export type ValidationResult =
  | { ok: true; uuid: string; token: string }
  | { ok: false; reason: "scheme" | "host" | "path" | "malformed" };

/**
 * Validate a QR URL on-device BEFORE any network call (ADR-0003 §3).
 *
 * Returns a discriminated union so callers can branch on the failure reason
 * for telemetry — no exceptions on the hot path.
 */
export function validateGrQrUrl(qrUrl: string): ValidationResult {
  if (typeof qrUrl !== "string" || qrUrl.length === 0 || qrUrl.length > 2048) {
    return { ok: false, reason: "malformed" };
  }
  let parsed: URL;
  try {
    parsed = new URL(qrUrl);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "scheme" };
  }
  if (parsed.host !== GR_HOST) {
    return { ok: false, reason: "host" };
  }
  const match = GR_VIEWER_PATH_REGEX.exec(parsed.pathname);
  if (!match) {
    return { ok: false, reason: "path" };
  }
  // Extract uuid and token for telemetry-free debugging only — never logged.
  const tail = parsed.pathname.slice("/edocuments/ViewInvoice/-1/".length);
  const sep = tail.lastIndexOf("_");
  if (sep === -1) {
    return { ok: false, reason: "path" };
  }
  return {
    ok: true,
    uuid: tail.slice(0, sep),
    token: tail.slice(sep + 1),
  };
}
