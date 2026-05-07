/**
 * Backend client for the ``GET /export/business-expenses`` endpoint
 * (BLG-0019 / ADR-0009).
 *
 * Returns the PDF as a base64 string (so the screen can pass it to
 * ``expo-file-system``'s `writeAsStringAsync` without intermediate
 * conversion). Mirrors the `Result` style used by `api/receipts.ts` and
 * `api/users.ts`.
 *
 * Implementation note: React Native's `fetch` returns a Response whose
 * `arrayBuffer()` works on Hermes — we use it here to read the streamed
 * PDF bytes, then encode to base64. We don't call `Response.blob()`
 * because RN's Blob support is partial across platforms / SDK versions.
 */

export type ExportResultOk = {
  kind: "ok";
  base64: string;
  filename: string;
};

export type ExportResultError = {
  kind: "error";
  status: 401 | 422 | "network" | "timeout" | "generic";
  trace_id?: string;
};

export type ExportResult = ExportResultOk | ExportResultError;

const EXPORT_TIMEOUT_MS = 30_000;

export async function exportBusinessExpenses(args: {
  fromDate: string;
  toDate: string;
  bearerToken: string;
  backendUrl: string;
  signal?: AbortSignal;
}): Promise<ExportResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS);
  if (args.signal) {
    if (args.signal.aborted) controller.abort();
    args.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  const url =
    `${args.backendUrl}/export/business-expenses` +
    `?from_date=${encodeURIComponent(args.fromDate)}` +
    `&to_date=${encodeURIComponent(args.toDate)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${args.bearerToken}`,
      },
      signal: controller.signal,
    });

    if (response.status === 200) {
      const buffer = await response.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const filename = parseFilename(
        response.headers.get("content-disposition")
      );
      return { kind: "ok", base64, filename };
    }

    const errorBody = await tryParseProblem(response);
    if (response.status === 401) {
      return { kind: "error", status: 401, trace_id: errorBody?.trace_id };
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

async function tryParseProblem(
  response: Response
): Promise<{ trace_id?: string } | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** RFC-4648 base64 — RN doesn't ship `Buffer`, so this is a hand-rolled
 * encoder that runs anywhere. The PDF payload is small (a few hundred KB
 * at most for typical fiscal periods), so the per-byte loop is fine. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    result += BASE64_CHARS[a >> 2];
    result += BASE64_CHARS[((a & 0x03) << 4) | (b >> 4)];
    result += BASE64_CHARS[((b & 0x0f) << 2) | (c >> 6)];
    result += BASE64_CHARS[c & 0x3f];
  }
  if (i < bytes.length) {
    const a = bytes[i] ?? 0;
    const b = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    result += BASE64_CHARS[a >> 2];
    if (i + 1 < bytes.length) {
      result += BASE64_CHARS[((a & 0x03) << 4) | (b >> 4)];
      result += BASE64_CHARS[(b & 0x0f) << 2];
      result += "=";
    } else {
      result += BASE64_CHARS[(a & 0x03) << 4];
      result += "==";
    }
  }
  return result;
}

function parseFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return "business-expenses.pdf";
  const match = /filename="([^"]+)"/i.exec(contentDisposition);
  return match && match[1] ? match[1] : "business-expenses.pdf";
}
