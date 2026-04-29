import { GR_VIEWER_PATH_REGEX, validateGrQrUrl } from "../../src/parsers/gr";

describe("validateGrQrUrl", () => {
  it("accepts a valid e-invoicing.gr viewer URL", () => {
    const url =
      "https://e-invoicing.gr/edocuments/ViewInvoice/-1/" +
      "11111111-2222-3333-4444-555555555555_TOKENABC";
    const result = validateGrQrUrl(url);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.uuid).toBe("11111111-2222-3333-4444-555555555555");
      expect(result.token).toBe("TOKENABC");
    }
  });

  it("rejects http (not https)", () => {
    const result = validateGrQrUrl(
      "http://e-invoicing.gr/edocuments/ViewInvoice/-1/abc_TOKEN"
    );
    expect(result).toEqual({ ok: false, reason: "scheme" });
  });

  it("rejects a different host", () => {
    const result = validateGrQrUrl(
      "https://attacker.example/edocuments/ViewInvoice/-1/abc_TOKEN"
    );
    expect(result).toEqual({ ok: false, reason: "host" });
  });

  it("rejects an unexpected path shape", () => {
    const result = validateGrQrUrl("https://e-invoicing.gr/some/other/path");
    expect(result).toEqual({ ok: false, reason: "path" });
  });

  it("rejects an empty / oversized URL", () => {
    expect(validateGrQrUrl("")).toEqual({ ok: false, reason: "malformed" });
    expect(validateGrQrUrl("x".repeat(3000))).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects an unparseable URL", () => {
    expect(validateGrQrUrl("not-a-url")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("regex source matches the backend (defense in depth)", () => {
    // Mirror of `backend/app/parsers/gr/url.py::GR_VIEWER_PATH_REGEX`.
    expect(GR_VIEWER_PATH_REGEX.source).toBe(
      "^\\/edocuments\\/ViewInvoice\\/-1\\/[0-9a-fA-F-]+_[A-Za-z0-9]+$"
    );
  });
});
