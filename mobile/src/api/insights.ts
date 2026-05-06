/**
 * Backend client for the insights endpoints (ADR-0005 §4).
 *
 * Same shape as `mobile/src/api/receipts.ts`: returns an `ok` / `error`
 * tagged outcome the Insights reducer can dispatch on without ever seeing
 * the raw `fetch` response.
 */

import type {
  InsightsPeriod,
  SummaryPayload,
  TopProductsPayload,
} from "../screens/insights/state";

export type FetchOutcome<T> =
  | { kind: "ok"; data: T }
  | { kind: "error"; status: 401 | "network" | "generic" };

const TIMEOUT_MS = 8_000;

export async function fetchInsightsSummary(args: {
  bearerToken: string;
  backendUrl: string;
  period: InsightsPeriod;
  anchor?: string;
}): Promise<FetchOutcome<SummaryPayload>> {
  return fetchJson<SummaryPayload>(
    `${args.backendUrl}/insights/summary?${queryString({
      period: args.period,
      anchor: args.anchor,
    })}`,
    args.bearerToken
  );
}

export async function fetchInsightsProducts(args: {
  bearerToken: string;
  backendUrl: string;
  period: InsightsPeriod;
  anchor?: string;
  limit?: number;
}): Promise<FetchOutcome<TopProductsPayload>> {
  return fetchJson<TopProductsPayload>(
    `${args.backendUrl}/insights/products?${queryString({
      period: args.period,
      anchor: args.anchor,
      limit: args.limit ? String(args.limit) : undefined,
    })}`,
    args.bearerToken
  );
}

async function fetchJson<T>(
  url: string,
  bearerToken: string
): Promise<FetchOutcome<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      signal: controller.signal,
    });
    if (response.status === 401) return { kind: "error", status: 401 };
    if (!response.ok) return { kind: "error", status: "generic" };
    const body = (await response.json()) as T;
    return { kind: "ok", data: body };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return { kind: "error", status: "network" };
    }
    return { kind: "error", status: "network" };
  } finally {
    clearTimeout(timeout);
  }
}

function queryString(params: Record<string, string | undefined>): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v.length > 0) {
      out.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return out.join("&");
}
