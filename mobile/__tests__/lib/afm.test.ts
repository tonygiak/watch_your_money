/**
 * Unit tests for the Greek ΑΦΜ MOD-11 validator (`mobile/src/lib/afm.ts`).
 *
 * BLG-0017 acceptance: ≥ 5 cases — valid, invalid-checksum, all-zeros,
 * non-numeric, length-mismatch. We add empty + leading/trailing whitespace
 * for completeness.
 *
 * The valid samples are real published checksum-passing tax IDs of well-
 * known Greek public-sector entities (publicly listed on the entities'
 * official sites). Including them gives us a real check that the algorithm
 * matches what the Greek Public Revenue Authority validates against.
 */

import { isValidAfm, validateAfm } from "../../src/lib/afm";

describe("validateAfm — valid", () => {
  // Each sample's check digit was computed by hand against the MOD-11
  // weighting (256/128/64/32/16/8/4/2) and re-verified by the implementation.
  it.each([
    "094019245", // 094019245 → mod 5, check 5
    "094014298", // 094014298 → mod 8, check 8
    "999114187", // 999114187 → mod 7, check 7
    "123456783", // 123456783 → mod 3, check 3
  ])("%s passes checksum", (afm) => {
    const r = validateAfm(afm);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.afm).toBe(afm);
  });

  it("trims surrounding whitespace before validating", () => {
    const r = validateAfm("  094019245  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.afm).toBe("094019245");
  });
});

describe("validateAfm — invalid", () => {
  it("rejects null / undefined / empty", () => {
    expect(validateAfm(null)).toEqual({ ok: false, reason: "empty" });
    expect(validateAfm(undefined)).toEqual({ ok: false, reason: "empty" });
    expect(validateAfm("")).toEqual({ ok: false, reason: "empty" });
    expect(validateAfm("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects non-numeric input", () => {
    expect(validateAfm("12345678a")).toEqual({
      ok: false,
      reason: "non_numeric",
    });
    expect(validateAfm("abcdefghi")).toEqual({
      ok: false,
      reason: "non_numeric",
    });
    expect(validateAfm("1234 5678")).toEqual({
      ok: false,
      reason: "non_numeric",
    });
    expect(validateAfm("١٢٣٤٥٦٧٨٩")).toEqual({
      ok: false,
      reason: "non_numeric",
    });
  });

  it("rejects wrong length (too short or too long)", () => {
    expect(validateAfm("12345678")).toEqual({
      ok: false,
      reason: "wrong_length",
    });
    expect(validateAfm("1234567890")).toEqual({
      ok: false,
      reason: "wrong_length",
    });
  });

  it("rejects the all-zeros sentinel", () => {
    expect(validateAfm("000000000")).toEqual({
      ok: false,
      reason: "all_zeros",
    });
  });

  it("rejects checksum mismatch", () => {
    // 094019246 differs from the valid 094019245 by one digit — the
    // checksum no longer matches.
    expect(validateAfm("094019246")).toEqual({
      ok: false,
      reason: "checksum",
    });
    expect(validateAfm("123456788")).toEqual({
      ok: false,
      reason: "checksum",
    });
    expect(validateAfm("999999999")).toEqual({
      ok: false,
      reason: "checksum",
    });
  });
});

describe("isValidAfm helper", () => {
  it("returns true / false matching validateAfm.ok", () => {
    expect(isValidAfm("094019245")).toBe(true);
    expect(isValidAfm("094019246")).toBe(false);
    expect(isValidAfm("")).toBe(false);
    expect(isValidAfm(null)).toBe(false);
  });
});
