import {
  GR_VIEWER_PATH_REGEX,
  validateGrQrCode,
  validateGrQrUrl,
} from "../../src/parsers/gr";

// ---------------------------------------------------------------------------
// Backwards-compat suite — `validateGrQrUrl` MUST keep its pre-BLG-0032
// shape so `mobile/src/api/receipts.ts` defense-in-depth and any other
// historical caller stay byte-identical.
// ---------------------------------------------------------------------------

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

  it("rejects a recognised non-einvoicing family as `host` (AADE)", () => {
    // AADE URL is a *valid* Greek QR family per ADR-0014 §3, but
    // `validateGrQrUrl` is the e-invoicing-only delegate — non-einvoicing
    // families must surface as `host` so the existing callers (notably
    // `postReceiptsParse`) still pre-flight-block them today.
    const result = validateGrQrUrl(
      "https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=DEADBEEFCAFEBABE"
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

// ---------------------------------------------------------------------------
// New BLG-0032 / ADR-0014 §1 suite — `validateGrQrCode` discriminated union.
// ---------------------------------------------------------------------------

describe("validateGrQrCode — Family A (e-invoicing.gr)", () => {
  it("accepts an e-invoicing.gr viewer URL", () => {
    const url =
      "https://e-invoicing.gr/edocuments/ViewInvoice/-1/" +
      "11111111-2222-3333-4444-555555555555_TOKENABC";
    const result = validateGrQrCode(url);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.family).toBe("einvoicing");
      if (result.family === "einvoicing") {
        expect(result.raw).toBe(url);
        expect(result.uuid).toBe("11111111-2222-3333-4444-555555555555");
        expect(result.token).toBe("TOKENABC");
      }
    }
  });

  it("rejects a malformed e-invoicing.gr path as `path`", () => {
    const url = "https://e-invoicing.gr/edocuments/ViewInvoice/-1/no-underscore";
    const result = validateGrQrCode(url);
    expect(result).toEqual({ ok: false, reason: "path" });
  });
});

describe("validateGrQrCode — Family B (AADE tameiakí)", () => {
  it("accepts an AADE signature URL with a hex SIG", () => {
    const url =
      "https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=45C07BD642067E5DEADBEEF0";
    const result = validateGrQrCode(url);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.family).toBe("aade");
      if (result.family === "aade") {
        expect(result.raw).toBe(url);
        expect(result.sig).toBe("45C07BD642067E5DEADBEEF0");
      }
    }
  });

  it("accepts an AADE URL with mixed-case hex", () => {
    const url =
      "https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=abcdefABCDEF0123456789";
    const result = validateGrQrCode(url);
    expect(result.ok).toBe(true);
    if (result.ok && result.family === "aade") {
      expect(result.sig).toBe("abcdefABCDEF0123456789");
    }
  });

  it("rejects an AADE URL with a non-hex SIG as `path`", () => {
    const url =
      "https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=NOT-HEX!!";
    const result = validateGrQrCode(url);
    expect(result).toEqual({ ok: false, reason: "path" });
  });

  it("rejects an AADE URL missing the SIG query param as `path`", () => {
    const url = "https://www1.aade.gr/tameiakes/myweb/q1.php";
    const result = validateGrQrCode(url);
    expect(result).toEqual({ ok: false, reason: "path" });
  });

  it("rejects an AADE URL on the wrong path as `path`", () => {
    const url = "https://www1.aade.gr/some/other/path?SIG=DEADBEEF";
    const result = validateGrQrCode(url);
    expect(result).toEqual({ ok: false, reason: "path" });
  });
});

describe("validateGrQrCode — Family C (Epsilon Net)", () => {
  it("accepts an Epsilon Net fiscal-doc URL", () => {
    const url =
      "https://epsilondigital-3rdpartc.epsilonnet.gr/fd/ABCdef123:42";
    const result = validateGrQrCode(url);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.family).toBe("epsilon");
      if (result.family === "epsilon") {
        expect(result.raw).toBe(url);
        expect(result.hash).toBe("ABCdef123");
        expect(result.index).toBe("42");
      }
    }
  });

  it("rejects an Epsilon URL without the colon-index suffix as `path`", () => {
    const url =
      "https://epsilondigital-3rdpartc.epsilonnet.gr/fd/ABCdef123";
    const result = validateGrQrCode(url);
    expect(result).toEqual({ ok: false, reason: "path" });
  });

  it("rejects an Epsilon URL with a non-numeric index as `path`", () => {
    const url =
      "https://epsilondigital-3rdpartc.epsilonnet.gr/fd/ABCdef123:NaN";
    const result = validateGrQrCode(url);
    expect(result).toEqual({ ok: false, reason: "path" });
  });

  it("rejects an Epsilon URL on the wrong path as `path`", () => {
    const url =
      "https://epsilondigital-3rdpartc.epsilonnet.gr/other/ABCdef:1";
    const result = validateGrQrCode(url);
    expect(result).toEqual({ ok: false, reason: "path" });
  });
});

describe("validateGrQrCode — Family D placeholder (unknown_code, awaiting BLG-0029)", () => {
  it("classifies a plain 15-hex-char string as `unknown_code`", () => {
    // The known example from the 2026-05-12 wallet sample (ADR-0014 §1).
    const code = "45C07BD642067E5";
    const result = validateGrQrCode(code);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.family).toBe("unknown_code");
      if (result.family === "unknown_code") {
        expect(result.raw).toBe(code);
      }
    }
  });

  it("classifies a longer hex blob as `unknown_code`", () => {
    const code = "DEADBEEFCAFEBABE0123456789ABCDEF";
    const result = validateGrQrCode(code);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.family).toBe("unknown_code");
  });

  it("rejects too-short hex blobs as `malformed`", () => {
    expect(validateGrQrCode("DEADBEEF")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects mixed-character blobs as `malformed`", () => {
    expect(validateGrQrCode("DEADBEEF-not-hex")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});

describe("validateGrQrCode — universal rejection paths", () => {
  it("rejects empty input as `malformed`", () => {
    expect(validateGrQrCode("")).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects oversized input as `malformed`", () => {
    expect(validateGrQrCode("x".repeat(3000))).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects http (not https) on a recognised host as `scheme`", () => {
    expect(
      validateGrQrCode("http://e-invoicing.gr/edocuments/ViewInvoice/-1/a_b")
    ).toEqual({ ok: false, reason: "scheme" });
  });

  it("rejects an unknown URL host as `host`", () => {
    expect(
      validateGrQrCode("https://attacker.example/edocuments/ViewInvoice/-1/a_b")
    ).toEqual({ ok: false, reason: "host" });
  });

  it("rejects a malformed URL falling through to non-hex text as `malformed`", () => {
    expect(validateGrQrCode("not-a-url-and-not-hex")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});

describe("validateGrQrCode — family disambiguation", () => {
  it("families are mutually exclusive at the host level", () => {
    const einvoicing =
      "https://e-invoicing.gr/edocuments/ViewInvoice/-1/abc-123_TOKEN";
    const aade =
      "https://www1.aade.gr/tameiakes/myweb/q1.php?SIG=DEADBEEF";
    const epsilon =
      "https://epsilondigital-3rdpartc.epsilonnet.gr/fd/abc:1";

    const r1 = validateGrQrCode(einvoicing);
    const r2 = validateGrQrCode(aade);
    const r3 = validateGrQrCode(epsilon);
    expect(r1.ok && r1.family).toBe("einvoicing");
    expect(r2.ok && r2.family).toBe("aade");
    expect(r3.ok && r3.family).toBe("epsilon");
  });
});
