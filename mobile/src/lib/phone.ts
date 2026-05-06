/**
 * On-device E.164 phone-number normalizer (DES-0002 §7, ADR-0004 §5).
 *
 * Pure function — no React, no Expo, no platform APIs. Used by the Login
 * screen reducer to gate the "Συνέχεια" button and by `mobile/src/api/auth.ts`
 * to format the value passed to Supabase `signInWithOtp`.
 *
 * Greek `+30` is the only country code in MVP. International numbers prefixed
 * with `+` are accepted for forward compatibility but the Login screen does
 * not surface a country picker (DES-0002 §1).
 */

export type NormalizedPhone = {
  /** E.164 string ready for Supabase `signInWithOtp({ phone })`. */
  e164: string;
};

const DEFAULT_COUNTRY_PREFIX = "+30";

/**
 * Greek mobile numbers are exactly 10 digits and start with `6` (after the
 * country code) per the Greek numbering plan. We soft-validate this shape;
 * non-Greek `+...` inputs only need to satisfy the E.164 length window.
 */
const GR_MOBILE_LOCAL_LEN = 10;
const GR_MOBILE_LEADING_DIGIT = "6";

/**
 * E.164 caps the digit count between 8 and 15 inclusive (excluding the `+`).
 */
const E164_MIN_DIGITS = 8;
const E164_MAX_DIGITS = 15;

/**
 * Normalize a free-form phone string into E.164.
 *
 * - Strips spaces, dashes, parentheses, dots, and non-breaking spaces.
 * - Honors a leading `+` (international shape).
 * - Otherwise, prepends the Greek country code (`+30`) and validates the
 *   local part as a 10-digit Greek mobile starting with `6`.
 *
 * Returns ``null`` when the input cannot be normalized.
 */
export function normalizeGrPhone(input: string | null | undefined): NormalizedPhone | null {
  if (typeof input !== "string") return null;
  const stripped = stripSeparators(input);
  if (stripped.length === 0) return null;

  if (stripped.startsWith("+")) {
    const digits = stripped.slice(1);
    if (!isAllDigits(digits)) return null;
    if (digits.length < E164_MIN_DIGITS || digits.length > E164_MAX_DIGITS) return null;
    if (digits.startsWith("0")) return null;
    return { e164: `+${digits}` };
  }

  if (!isAllDigits(stripped)) return null;
  if (stripped.length !== GR_MOBILE_LOCAL_LEN) return null;
  if (stripped[0] !== GR_MOBILE_LEADING_DIGIT) return null;

  return { e164: `${DEFAULT_COUNTRY_PREFIX}${stripped}` };
}

/**
 * Cheap predicate used by the Login screen to enable / disable the
 * "Συνέχεια" CTA without surfacing the parsed value.
 */
export function isValidGrPhone(input: string | null | undefined): boolean {
  return normalizeGrPhone(input) !== null;
}

function stripSeparators(value: string): string {
  let out = "";
  for (const ch of value) {
    if (ch === " " || ch === "\t" || ch === "\u00a0") continue;
    if (ch === "-" || ch === "(" || ch === ")" || ch === ".") continue;
    out += ch;
  }
  return out;
}

function isAllDigits(value: string): boolean {
  if (value.length === 0) return false;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}
