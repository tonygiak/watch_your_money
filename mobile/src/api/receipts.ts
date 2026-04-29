/**
 * Backend client for the receipts endpoints.
 *
 * Excluded from the typecheck gate until BLG-0012 lands the runtime deps
 * (`@supabase/supabase-js`, RN `fetch`/`AbortController` polyfills if any
 * are needed). The shape here matches ADR-0002 §3.
 *
 * Activation checklist for BLG-0012:
 *   1. `npm i @supabase/supabase-js expo expo-camera expo-localization
 *      react react-native`.
 *   2. Re-include `src/api/**` and `src/screens/ScannerScreen.tsx` in
 *      `tsconfig.json`.
 *   3. Wire the screen into the navigation stack.
 *   4. Re-run `make check`.
 */

import { validateGrQrUrl } from "../parsers/gr";

export type ParseResultOk = {
  kind: "ok";
  receiptId: string;
  isDuplicate: boolean;
};

export type ParseResultError = {
  kind: "error";
  status: 401 | 422 | 502 | 503 | "timeout" | "generic";
  trace_id?: string;
};

export type ParseResult = ParseResultOk | ParseResultError;

const SUBMIT_TIMEOUT_MS = 10_000;

/**
 * POST /receipts/parse with a 10-second timeout, on-device domain validation
 * (defense in depth), and an `AbortController` so cancellation is clean.
 */
export async function postReceiptsParse(args: {
  qrUrl: string;
  bearerToken: string;
  backendUrl: string;
  signal?: AbortSignal;
}): Promise<ParseResult> {
  const validation = validateGrQrUrl(args.qrUrl);
  if (!validation.ok) {
    return { kind: "error", status: 422 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
  // If the caller passes a parent signal, abort our controller when it aborts.
  if (args.signal) {
    if (args.signal.aborted) controller.abort();
    args.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    const response = await fetch(`${args.backendUrl}/receipts/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.bearerToken}`,
      },
      body: JSON.stringify({ qr_url: args.qrUrl }),
      signal: controller.signal,
    });

    if (response.status === 201 || response.status === 200) {
      const body = await response.json();
      return {
        kind: "ok",
        receiptId: String(body.receipt.id),
        isDuplicate: Boolean(body.is_duplicate),
      };
    }

    const errorBody = await tryParseProblem(response);
    if (response.status === 401) {
      return { kind: "error", status: 401, trace_id: errorBody?.trace_id };
    }
    if (response.status === 422) {
      return { kind: "error", status: 422, trace_id: errorBody?.trace_id };
    }
    if (response.status === 502) {
      return { kind: "error", status: 502, trace_id: errorBody?.trace_id };
    }
    if (response.status === 503) {
      return { kind: "error", status: 503, trace_id: errorBody?.trace_id };
    }
    return { kind: "error", status: "generic", trace_id: errorBody?.trace_id };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return { kind: "error", status: "timeout" };
    }
    return { kind: "error", status: "generic" };
  } finally {
    clearTimeout(timeout);
  }
}

async function tryParseProblem(
  response: Response
): Promise<{ trace_id?: string } | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
