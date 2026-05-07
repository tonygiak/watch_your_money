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

// ---------------------------------------------------------------------------
// POST /receipts/{id}/tag — tag-as-business (ADR-0008 / BLG-0018)
// ---------------------------------------------------------------------------

export type TagResultOk = {
  kind: "ok";
  receipt: TaggedReceipt;
};

export type TagResultError = {
  kind: "error";
  status: 401 | 404 | 422 | "network" | "timeout" | "generic";
  field?: "category" | "notes";
  trace_id?: string;
};

export type TagResult = TagResultOk | TagResultError;

/** Slim post-tag receipt shape — what the mobile UI actually needs after a
 *  tag operation. Mirrors the `ReceiptResponse` body but only carries the
 *  fields the inline-tag flow consumes. The full shape is available too — we
 *  pass it through unchanged so the receipt-detail screen can refresh. */
export type TaggedReceipt = {
  id: string;
  is_business_expense: boolean;
  business_category: string | null;
  notes: string | null;
};

const TAG_TIMEOUT_MS = 10_000;

export async function tagReceipt(args: {
  receiptId: string;
  isBusiness: boolean;
  category?: string;
  notes?: string;
  bearerToken: string;
  backendUrl: string;
  signal?: AbortSignal;
}): Promise<TagResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TAG_TIMEOUT_MS);
  if (args.signal) {
    if (args.signal.aborted) controller.abort();
    args.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  // Body shape exactly per ADR-0008 §2 — only the fields the server expects.
  const body: Record<string, unknown> = { is_business: args.isBusiness };
  if (args.isBusiness) {
    if (args.category !== undefined) body.category = args.category;
    if (args.notes !== undefined && args.notes.length > 0) {
      body.notes = args.notes;
    }
  }

  try {
    const response = await fetch(
      `${args.backendUrl}/receipts/${args.receiptId}/tag`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.bearerToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    if (response.status === 200) {
      const json = await response.json();
      return {
        kind: "ok",
        receipt: {
          id: String(json.id),
          is_business_expense: Boolean(json.is_business_expense),
          business_category: json.business_category ?? null,
          notes: json.notes ?? null,
        },
      };
    }

    const errorBody = await tryParseProblem(response);
    if (response.status === 401) {
      return { kind: "error", status: 401, trace_id: errorBody?.trace_id };
    }
    if (response.status === 404) {
      return { kind: "error", status: 404, trace_id: errorBody?.trace_id };
    }
    if (response.status === 422) {
      return { kind: "error", status: 422, trace_id: errorBody?.trace_id };
    }
    return { kind: "error", status: "generic", trace_id: errorBody?.trace_id };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return { kind: "error", status: "timeout" };
    }
    return { kind: "error", status: "network" };
  } finally {
    clearTimeout(timeout);
  }
}
