/**
 * Insights screen state machine (DES-0003 §2 + ADR-0005).
 *
 * Pure-TS reducer. Mirrors the same pattern as the scanner / login reducers
 * so the full transition table is unit-testable without rendering anything.
 *
 * The screen consumes the two endpoint shapes from ADR-0005 §4
 * (``/insights/summary`` and ``/insights/products``) — both are loaded in
 * parallel and merged into the `loaded` state's payload.
 */

export type InsightsPeriod = "week" | "month" | "year";

export type InsightsStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "empty"
  | "offline"
  | "network_error"
  | "auth_error";

export type InsightsErrorCode = "network" | "auth";

/**
 * Wire-shape for the `summary` response (subset the screen needs).
 * Money fields are decimal-as-string (ADR-0005 §5).
 */
export type SummaryWindow = {
  from_date: string;
  to_date: string;
  total: string;
  vat_total: string;
  receipt_count: number;
};

export type SummaryCategory = {
  category: string;
  total: string;
  receipt_count: number;
};

export type SummaryMerchant = {
  merchant_name: string;
  total: string;
  receipt_count: number;
};

export type SummaryPayload = {
  period: InsightsPeriod;
  anchor: string;
  current: SummaryWindow;
  previous: SummaryWindow;
  by_category: SummaryCategory[];
  by_merchant: SummaryMerchant[];
};

export type TopProduct = {
  ean: string;
  description: string;
  frequency: number;
  total_spend: string;
  average_unit_price: string;
};

export type TopProductsPayload = {
  period: InsightsPeriod;
  anchor: string;
  from_date: string;
  to_date: string;
  products: TopProduct[];
};

export type InsightsState = {
  status: InsightsStatus;
  period: InsightsPeriod;
  /** ISO date or null when "today" should be used. */
  anchor: string | null;
  summary: SummaryPayload | null;
  topProducts: TopProductsPayload | null;
  errorCode: InsightsErrorCode | null;
};

export const initialInsightsState: InsightsState = {
  status: "idle",
  period: "month",
  anchor: null,
  summary: null,
  topProducts: null,
  errorCode: null,
};

export type InsightsAction =
  | { type: "MOUNTED" }
  | { type: "PERIOD_CHANGED"; period: InsightsPeriod }
  | { type: "OFFLINE_DETECTED" }
  | { type: "ONLINE_DETECTED" }
  | {
      type: "LOAD_SUCCEEDED";
      summary: SummaryPayload;
      topProducts: TopProductsPayload;
    }
  | { type: "LOAD_EMPTY"; summary: SummaryPayload; topProducts: TopProductsPayload }
  | { type: "LOAD_FAILED_NETWORK" }
  | { type: "LOAD_FAILED_AUTH" }
  | { type: "RETRY" };

export function insightsReducer(
  state: InsightsState,
  action: InsightsAction
): InsightsState {
  switch (action.type) {
    case "MOUNTED": {
      if (state.status !== "idle") return state;
      return { ...state, status: "loading", errorCode: null };
    }

    case "PERIOD_CHANGED": {
      if (state.status === "auth_error") return state;
      // Period change always re-anchors to today and reloads.
      return {
        ...state,
        status: "loading",
        period: action.period,
        anchor: null,
        errorCode: null,
      };
    }

    case "OFFLINE_DETECTED": {
      if (state.status === "auth_error") return state;
      return { ...state, status: "offline", errorCode: null };
    }

    case "ONLINE_DETECTED": {
      if (state.status !== "offline") return state;
      return { ...state, status: "loading", errorCode: null };
    }

    case "LOAD_SUCCEEDED": {
      if (state.status !== "loading") return state;
      return {
        ...state,
        status: "loaded",
        summary: action.summary,
        topProducts: action.topProducts,
        errorCode: null,
      };
    }

    case "LOAD_EMPTY": {
      if (state.status !== "loading") return state;
      return {
        ...state,
        status: "empty",
        summary: action.summary,
        topProducts: action.topProducts,
        errorCode: null,
      };
    }

    case "LOAD_FAILED_NETWORK": {
      if (state.status !== "loading") return state;
      return { ...state, status: "network_error", errorCode: "network" };
    }

    case "LOAD_FAILED_AUTH": {
      if (state.status !== "loading") return state;
      return { ...state, status: "auth_error", errorCode: "auth" };
    }

    case "RETRY": {
      if (state.status !== "network_error" && state.status !== "offline") {
        return state;
      }
      return { ...state, status: "loading", errorCode: null };
    }

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Telemetry (counts only, per DES-0003 §6)
// ---------------------------------------------------------------------------

export type InsightsTelemetryEvent =
  | "insights.opened"
  | `insights.period.changed:${InsightsPeriod}`
  | `insights.loaded.success:${InsightsPeriod}`
  | "insights.loaded.empty"
  | "insights.loaded.failed.network"
  | "insights.loaded.failed.auth"
  | "insights.offline.shown";

export function insightsTelemetryEventFor(
  prev: InsightsState,
  next: InsightsState
): InsightsTelemetryEvent | null {
  if (prev.status === "idle" && next.status === "loading") {
    return "insights.opened";
  }
  if (prev.period !== next.period) {
    return `insights.period.changed:${next.period}`;
  }
  if (prev.status === "loading" && next.status === "loaded") {
    return `insights.loaded.success:${next.period}`;
  }
  if (prev.status === "loading" && next.status === "empty") {
    return "insights.loaded.empty";
  }
  if (prev.status === "loading" && next.status === "network_error") {
    return "insights.loaded.failed.network";
  }
  if (prev.status === "loading" && next.status === "auth_error") {
    return "insights.loaded.failed.auth";
  }
  if (prev.status !== "offline" && next.status === "offline") {
    return "insights.offline.shown";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers — used by the screen to render the vs-previous indicator
// ---------------------------------------------------------------------------

export type Comparison =
  | { kind: "decrease"; pct: number }
  | { kind: "increase"; pct: number }
  | { kind: "none" };

/**
 * Compute the vs-previous comparison percentage from two decimal-as-string
 * money values. Returns ``{ kind: "none" }`` when the previous window had
 * zero spend (no baseline → no comparison) per DES-0003 §3.1.
 */
export function compareWindows(
  currentTotal: string,
  previousTotal: string
): Comparison {
  const cur = Number(currentTotal);
  const prev = Number(previousTotal);
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) {
    return { kind: "none" };
  }
  if (cur === prev) return { kind: "none" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct < 0) return { kind: "decrease", pct: Math.abs(pct) };
  return { kind: "increase", pct };
}
