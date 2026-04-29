import { detectLocale } from "../../src/lib/locale";

describe("detectLocale — Greek-first per ADR-0003 §5", () => {
  it("returns 'el' for el-* device locales", () => {
    expect(detectLocale("el")).toBe("el");
    expect(detectLocale("el-GR")).toBe("el");
    expect(detectLocale("EL-CY")).toBe("el");
  });

  it("returns 'en' for en-* device locales", () => {
    expect(detectLocale("en")).toBe("en");
    expect(detectLocale("en-US")).toBe("en");
    expect(detectLocale("en-GB")).toBe("en");
  });

  it("returns 'el' for any other device locale (Greek-first default)", () => {
    expect(detectLocale("de-DE")).toBe("el");
    expect(detectLocale("fr-FR")).toBe("el");
    expect(detectLocale("ja-JP")).toBe("el");
  });

  it("returns 'el' for empty / null / undefined input", () => {
    expect(detectLocale("")).toBe("el");
    expect(detectLocale(null)).toBe("el");
    expect(detectLocale(undefined)).toBe("el");
  });
});
