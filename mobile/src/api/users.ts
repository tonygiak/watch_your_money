/**
 * Backend client for the ``PATCH /users/me`` endpoint (DES-0004 §4 /
 * BLG-0017).
 *
 * Mirrors ``mobile/src/api/receipts.ts`` — `Result`-style return type so
 * the caller never has to `try / catch` around fetch failures, an explicit
 * 10-second timeout, and an `AbortController` so cancellation is clean.
 */

export type PatchMeResultOk = {
  kind: "ok";
  user: PatchedUser;
};

export type PatchMeResultError = {
  kind: "error";
  status: 401 | 404 | 422 | "network" | "timeout" | "generic";
  /** Server-side validation reason for ΑΦΜ failures, when the backend
   * returns a structured ``invalid_afm`` envelope. */
  reason?: "checksum" | "wrong_length" | "non_numeric" | "all_zeros" | "empty";
  trace_id?: string;
};

export type PatchMeResult = PatchMeResultOk | PatchMeResultError;

export type PatchedUser = {
  id: string;
  afm: string | null;
  email: string | null;
  is_freelancer: boolean;
};

const PATCH_TIMEOUT_MS = 10_000;

export async function patchMe(args: {
  isFreelancer?: boolean;
  /** Pass ``null`` to clear; pass a string to set; omit to leave untouched. */
  afm?: string | null;
  bearerToken: string;
  backendUrl: string;
  signal?: AbortSignal;
}): Promise<PatchMeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PATCH_TIMEOUT_MS);
  if (args.signal) {
    if (args.signal.aborted) controller.abort();
    args.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  const body: Record<string, unknown> = {};
  if (args.isFreelancer !== undefined) body.is_freelancer = args.isFreelancer;
  if (args.afm !== undefined) body.afm = args.afm;

  try {
    const response = await fetch(`${args.backendUrl}/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.bearerToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 200) {
      const json = await response.json();
      return {
        kind: "ok",
        user: {
          id: String(json.id),
          afm: json.afm ?? null,
          email: json.email ?? null,
          is_freelancer: Boolean(json.is_freelancer),
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
      return {
        kind: "error",
        status: 422,
        trace_id: errorBody?.trace_id,
      };
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

async function tryParseProblem(
  response: Response
): Promise<{ trace_id?: string } | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
