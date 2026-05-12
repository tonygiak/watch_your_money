/**
 * Greek e-receipt QR validators (mobile).
 *
 * `validateGrQrUrl` is the original e-invoicing.gr-only validator mirrored
 * from `backend/app/parsers/gr/einvoicing/url.py` (was `backend/app/parsers/gr/url.py`
 * pre-S-012) per ADR-0003 §3 defense-in-depth. It is preserved verbatim — its
 * regex source is pinned by `mobile/__tests__/parsers/gr.test.ts`.
 *
 * `validateGrQrCode` is the BLG-0032 / ADR-0014 §1 successor: a discriminated
 * union that recognises all three Greek receipt QR families documented in
 * ADR-0014 §3 (e-invoicing.gr Entersoft/SoftOne, AADE tameiakí, Epsilon Net)
 * plus the `unknown_code` placeholder branch for the Family C non-URL hex
 * codes awaiting BLG-0029 identification.
 *
 * Backend mirror status (S-012 close):
 *   - `einvoicing`: backend adapter ships today (`backend/app/parsers/gr/url.py`).
 *   - `aade`:        backend adapter gated on BLG-0030 spike (S-013+).
 *   - `epsilon`:     backend adapter gated on consented fixture (S-013+).
 *   - `unknown_code`: backend adapter gated on Family C identification (BLG-0029).
 *
 * Both validators MUST stay in sync with their backend counterparts. When you
 * change one, change the other (per ADR-0001 §5 + ADR-0014 §1).
 */

// ---------------------------------------------------------------------------
// Regex contracts — mirrored verbatim against the backend `can_parse` shape
// for each family.
// ---------------------------------------------------------------------------

/**
 * E-invoicing.gr viewer path regex. Mirrored verbatim against
 * `backend/app/parsers/gr/url.py::GR_VIEWER_PATH_REGEX`.
 *
 * Pinned by the existing test in `mobile/__tests__/parsers/gr.test.ts` —
 * any change to this constant breaks defense-in-depth and the test catches it.
 */
export const GR_VIEWER_PATH_REGEX =
  /^\/edocuments\/ViewInvoice\/-1\/[0-9a-fA-F-]+_[A-Za-z0-9]+$/;

export const GR_HOST = "e-invoicing.gr";

/**
 * AADE tameiakí signature URL pattern (Family A per ADR-0014 §3). The `SIG`
 * value is the per-receipt fiscal signature, used as `mark` on the backend.
 *
 * Future backend mirror: `backend/app/parsers/gr/aade/url.py` (BLG-0027).
 */
export const GR_AADE_HOST = "www1.aade.gr";
export const GR_AADE_PATH = "/tameiakes/myweb/q1.php";
export const GR_AADE_SIG_REGEX = /^[0-9A-Fa-f]+$/;

/**
 * Epsilon Net fiscal-doc viewer URL pattern (Family B per ADR-0014 §3). The
 * `<hash>:<n>` URL tail is used as `mark` on the backend.
 *
 * Future backend mirror: `backend/app/parsers/gr/epsilon/url.py` (BLG-0028).
 */
export const GR_EPSILON_HOST = "epsilondigital-3rdpartc.epsilonnet.gr";
export const GR_EPSILON_PATH_REGEX =
  /^\/fd\/(?<hash>[A-Za-z0-9]+):(?<index>[0-9]+)$/;

/**
 * Family C placeholder regex — a plain hex string of plausible fiscal-code
 * length, with no URL prefix. Only matched AFTER `new URL()` parsing fails,
 * so anything resembling a URL can never fall into this branch. The lower
 * bound is 12 hex chars (the known example `45C07BD642067E5` is 15 chars) to
 * avoid false-positives on short blobs. Awaiting BLG-0029 identification.
 */
export const GR_UNKNOWN_HEX_CODE_REGEX = /^[0-9A-Fa-f]{12,64}$/;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GrQrFamily = "einvoicing" | "aade" | "epsilon" | "unknown_code";

export type GrQrValidationOk =
  | {
      ok: true;
      family: "einvoicing";
      raw: string;
      uuid: string;
      token: string;
    }
  | {
      ok: true;
      family: "aade";
      raw: string;
      sig: string;
    }
  | {
      ok: true;
      family: "epsilon";
      raw: string;
      hash: string;
      index: string;
    }
  | {
      ok: true;
      family: "unknown_code";
      raw: string;
    };

export type GrQrValidationFail = {
  ok: false;
  reason: "scheme" | "host" | "path" | "malformed";
};

export type GrQrValidation = GrQrValidationOk | GrQrValidationFail;

/**
 * Backwards-compat shape from before BLG-0032. Kept exported because
 * `mobile/src/api/receipts.ts` and `mobile/src/screens/ScannerScreen.tsx`
 * historically destructured `{ ok, uuid, token, reason }` directly. New
 * callers should prefer `GrQrValidation` + `validateGrQrCode`.
 */
export type ValidationResult =
  | { ok: true; uuid: string; token: string }
  | { ok: false; reason: "scheme" | "host" | "path" | "malformed" };

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const MAX_INPUT_LEN = 2048;

/**
 * Validate a Greek e-receipt QR payload on-device BEFORE any network call
 * (ADR-0003 §3). Returns a discriminated union: the `family` discriminator on
 * success tells the scanner whether to forward the value to the backend
 * directly (e-invoicing / AADE / Epsilon URLs) or to surface a clearer
 * "unsupported yet" message (`unknown_code` for Family C).
 *
 * No exceptions on the hot path — callers branch on `result.ok` and then on
 * `result.family` for telemetry / routing.
 */
export function validateGrQrCode(input: string): GrQrValidation {
  if (typeof input !== "string" || input.length === 0 || input.length > MAX_INPUT_LEN) {
    return { ok: false, reason: "malformed" };
  }

  // Try every URL-shaped family first. `new URL()` will throw on plain hex
  // codes, falling through to the `unknown_code` check below.
  let parsed: URL | null = null;
  try {
    parsed = new URL(input);
  } catch {
    parsed = null;
  }

  if (parsed) {
    if (parsed.protocol !== "https:") {
      return { ok: false, reason: "scheme" };
    }

    // Family A: e-invoicing.gr (Entersoft / SoftOne) — existing path regex.
    if (parsed.host === GR_HOST) {
      const match = GR_VIEWER_PATH_REGEX.exec(parsed.pathname);
      if (!match) return { ok: false, reason: "path" };
      const tail = parsed.pathname.slice("/edocuments/ViewInvoice/-1/".length);
      const sep = tail.lastIndexOf("_");
      if (sep === -1) return { ok: false, reason: "path" };
      return {
        ok: true,
        family: "einvoicing",
        raw: input,
        uuid: tail.slice(0, sep),
        token: tail.slice(sep + 1),
      };
    }

    // Family B: AADE tameiakí signature URL.
    if (parsed.host === GR_AADE_HOST) {
      if (parsed.pathname !== GR_AADE_PATH) {
        return { ok: false, reason: "path" };
      }
      const sig = parsed.searchParams.get("SIG");
      if (sig === null || !GR_AADE_SIG_REGEX.test(sig)) {
        return { ok: false, reason: "path" };
      }
      return { ok: true, family: "aade", raw: input, sig };
    }

    // Family C: Epsilon Net fiscal-doc viewer.
    if (parsed.host === GR_EPSILON_HOST) {
      const match = GR_EPSILON_PATH_REGEX.exec(parsed.pathname);
      const hash = match?.groups?.hash;
      const index = match?.groups?.index;
      if (!match || hash === undefined || index === undefined) {
        return { ok: false, reason: "path" };
      }
      return {
        ok: true,
        family: "epsilon",
        raw: input,
        hash,
        index,
      };
    }

    return { ok: false, reason: "host" };
  }

  // Non-URL input: check the Family C hex-code placeholder shape.
  if (GR_UNKNOWN_HEX_CODE_REGEX.test(input)) {
    return { ok: true, family: "unknown_code", raw: input };
  }

  return { ok: false, reason: "malformed" };
}

/**
 * E-invoicing.gr-only validator (pre-BLG-0032 shape). Implemented as a
 * delegate to `validateGrQrCode` so the regex contract stays in one place;
 * the return shape is unchanged so every existing caller stays type-safe.
 *
 * Non-`einvoicing` families are surfaced as `{ ok: false, reason: "host" }`
 * here — that is intentional: this function exists for code paths that
 * specifically need an e-invoicing.gr URL (`mobile/src/api/receipts.ts`
 * defense-in-depth before `POST /receipts/parse`, which today only knows
 * the e-invoicing.gr backend adapter).
 */
export function validateGrQrUrl(qrUrl: string): ValidationResult {
  const result = validateGrQrCode(qrUrl);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  if (result.family === "einvoicing") {
    return { ok: true, uuid: result.uuid, token: result.token };
  }
  return { ok: false, reason: "host" };
}
