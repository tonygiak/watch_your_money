/**
 * Greek ΑΦΜ (Tax Identification Number) MOD-11 checksum validator.
 *
 * The Greek ΑΦΜ is a 9-digit number where the 9th digit is a check digit
 * computed from the first 8 by the MOD-11 algorithm:
 *
 *   1. Multiply each of the first 8 digits by its weight: d[i] * 2^(8-i)
 *      (i.e. d1*256, d2*128, d3*64, d4*32, d5*16, d6*8, d7*4, d8*2).
 *   2. Sum the weighted values.
 *   3. Take the sum modulo 11.
 *   4. If the result is 10, the check digit must be 0; otherwise it must
 *      equal the result.
 *
 * The all-zeros "000000000" is technically a checksum match (sum=0,
 * mod=0, check=0) but is rejected as a sentinel — no real ΑΦΜ uses it
 * (DES-0004 §3.3, BLG-0017 acceptance "all-zeros" case).
 *
 * Pure-TS, framework-free, no dependencies. Lives in `lib/` so it can be
 * consumed by the Profile screen reducer, the form validators, and any
 * future export-side display logic.
 */

export type AfmValidationResult =
  | { ok: true; afm: string }
  | { ok: false; reason: AfmValidationError };

export type AfmValidationError =
  | "empty"
  | "non_numeric"
  | "wrong_length"
  | "all_zeros"
  | "checksum";

/**
 * Validate a Greek ΑΦΜ. Trims surrounding whitespace; rejects anything that
 * is not exactly 9 ASCII digits **and** does not pass the MOD-11 checksum.
 *
 * The function does NOT log or print the input — ΑΦΜ is identifying data
 * (DES-0004 §3.3 / §7).
 */
export function validateAfm(input: string | null | undefined): AfmValidationResult {
  if (input === null || input === undefined) {
    return { ok: false, reason: "empty" };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (!/^[0-9]+$/.test(trimmed)) {
    return { ok: false, reason: "non_numeric" };
  }
  if (trimmed.length !== 9) {
    return { ok: false, reason: "wrong_length" };
  }
  if (trimmed === "000000000") {
    return { ok: false, reason: "all_zeros" };
  }

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const digit = trimmed.charCodeAt(i) - 48; // ASCII '0' = 48
    sum += digit * Math.pow(2, 8 - i);
  }
  const mod = sum % 11;
  const expectedCheck = mod === 10 ? 0 : mod;
  const actualCheck = trimmed.charCodeAt(8) - 48;
  if (expectedCheck !== actualCheck) {
    return { ok: false, reason: "checksum" };
  }
  return { ok: true, afm: trimmed };
}

/** Convenience boolean — useful in JSX `disabled={!isValidAfm(...)}` cases. */
export function isValidAfm(input: string | null | undefined): boolean {
  return validateAfm(input).ok;
}
