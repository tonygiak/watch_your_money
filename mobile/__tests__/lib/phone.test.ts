import { isValidGrPhone, normalizeGrPhone } from "../../src/lib/phone";

describe("normalizeGrPhone — DES-0002 §7", () => {
  it("normalizes a 10-digit Greek mobile to +30…", () => {
    expect(normalizeGrPhone("6912345678")).toEqual({ e164: "+306912345678" });
  });

  it("strips spaces, dashes, parentheses, and dots", () => {
    expect(normalizeGrPhone("(691) 234-56.78")).toEqual({ e164: "+306912345678" });
    expect(normalizeGrPhone("6912 345 678")).toEqual({ e164: "+306912345678" });
  });

  it("strips non-breaking spaces", () => {
    expect(normalizeGrPhone("6912\u00a0345\u00a0678")).toEqual({
      e164: "+306912345678",
    });
  });

  it("accepts a +30 prefix as-is", () => {
    expect(normalizeGrPhone("+306912345678")).toEqual({ e164: "+306912345678" });
  });

  it("accepts a non-Greek E.164 international number", () => {
    expect(normalizeGrPhone("+447911123456")).toEqual({ e164: "+447911123456" });
  });

  it("rejects inputs that contain letters", () => {
    expect(normalizeGrPhone("69abc34567")).toBeNull();
  });

  it("rejects too-short inputs", () => {
    expect(normalizeGrPhone("6912345")).toBeNull();
    expect(normalizeGrPhone("+30691")).toBeNull();
  });

  it("rejects too-long inputs", () => {
    expect(normalizeGrPhone("69123456789")).toBeNull();
    expect(normalizeGrPhone("+3069123456789012")).toBeNull();
  });

  it("rejects local Greek numbers that don't start with 6 (mobile rule)", () => {
    expect(normalizeGrPhone("2101234567")).toBeNull();
  });

  it("rejects E.164 numbers that start with a leading 0", () => {
    expect(normalizeGrPhone("+0306912345678")).toBeNull();
  });

  it("rejects null / undefined / empty / non-string inputs", () => {
    expect(normalizeGrPhone(null)).toBeNull();
    expect(normalizeGrPhone(undefined)).toBeNull();
    expect(normalizeGrPhone("")).toBeNull();
    expect(normalizeGrPhone("    ")).toBeNull();
  });

  it("isValidGrPhone mirrors normalizeGrPhone non-null result", () => {
    expect(isValidGrPhone("6912345678")).toBe(true);
    expect(isValidGrPhone("not a number")).toBe(false);
    expect(isValidGrPhone(null)).toBe(false);
  });
});
