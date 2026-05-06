import {
  compareWindows,
  initialInsightsState,
  insightsReducer,
  insightsTelemetryEventFor,
  type InsightsAction,
  type InsightsState,
  type SummaryPayload,
  type TopProductsPayload,
} from "../../../src/screens/insights/state";

const STUB_SUMMARY: SummaryPayload = {
  period: "month",
  anchor: "2026-04-30",
  current: {
    from_date: "2026-04-01",
    to_date: "2026-04-30",
    total: "412.50",
    vat_total: "79.20",
    receipt_count: 11,
  },
  previous: {
    from_date: "2026-03-01",
    to_date: "2026-03-31",
    total: "503.10",
    vat_total: "96.60",
    receipt_count: 14,
  },
  by_category: [{ category: "groceries", total: "210.30", receipt_count: 6 }],
  by_merchant: [],
};

const STUB_TOP: TopProductsPayload = {
  period: "month",
  anchor: "2026-04-30",
  from_date: "2026-04-01",
  to_date: "2026-04-30",
  products: [],
};

const EMPTY_SUMMARY: SummaryPayload = {
  ...STUB_SUMMARY,
  current: { ...STUB_SUMMARY.current, total: "0.00", receipt_count: 0 },
  by_category: [],
  by_merchant: [],
};

function step(state: InsightsState, action: InsightsAction): InsightsState {
  return insightsReducer(state, action);
}

describe("insightsReducer — DES-0003 transitions", () => {
  it("starts in idle, period defaults to month", () => {
    expect(initialInsightsState.status).toBe("idle");
    expect(initialInsightsState.period).toBe("month");
  });

  it("idle → loading on MOUNTED", () => {
    const next = step(initialInsightsState, { type: "MOUNTED" });
    expect(next.status).toBe("loading");
  });

  it("loading → loaded on LOAD_SUCCEEDED", () => {
    let s = step(initialInsightsState, { type: "MOUNTED" });
    s = step(s, {
      type: "LOAD_SUCCEEDED",
      summary: STUB_SUMMARY,
      topProducts: STUB_TOP,
    });
    expect(s.status).toBe("loaded");
    expect(s.summary).toBe(STUB_SUMMARY);
  });

  it("loading → empty when current.receipt_count is zero", () => {
    let s = step(initialInsightsState, { type: "MOUNTED" });
    s = step(s, {
      type: "LOAD_EMPTY",
      summary: EMPTY_SUMMARY,
      topProducts: STUB_TOP,
    });
    expect(s.status).toBe("empty");
  });

  it("loading → network_error on LOAD_FAILED_NETWORK", () => {
    let s = step(initialInsightsState, { type: "MOUNTED" });
    s = step(s, { type: "LOAD_FAILED_NETWORK" });
    expect(s.status).toBe("network_error");
    expect(s.errorCode).toBe("network");
  });

  it("loading → auth_error on LOAD_FAILED_AUTH", () => {
    let s = step(initialInsightsState, { type: "MOUNTED" });
    s = step(s, { type: "LOAD_FAILED_AUTH" });
    expect(s.status).toBe("auth_error");
  });

  it("auth_error is terminal — period change is a no-op", () => {
    let s = step(initialInsightsState, { type: "MOUNTED" });
    s = step(s, { type: "LOAD_FAILED_AUTH" });
    const before = s;
    s = step(s, { type: "PERIOD_CHANGED", period: "week" });
    expect(s).toBe(before);
  });

  it("PERIOD_CHANGED resets anchor and re-enters loading", () => {
    let s = step(initialInsightsState, { type: "MOUNTED" });
    s = step(s, {
      type: "LOAD_SUCCEEDED",
      summary: STUB_SUMMARY,
      topProducts: STUB_TOP,
    });
    s = step(s, { type: "PERIOD_CHANGED", period: "week" });
    expect(s.status).toBe("loading");
    expect(s.period).toBe("week");
    expect(s.anchor).toBeNull();
  });

  it("OFFLINE_DETECTED can fire from loaded; ONLINE_DETECTED resumes loading", () => {
    let s = step(initialInsightsState, { type: "MOUNTED" });
    s = step(s, {
      type: "LOAD_SUCCEEDED",
      summary: STUB_SUMMARY,
      topProducts: STUB_TOP,
    });
    s = step(s, { type: "OFFLINE_DETECTED" });
    expect(s.status).toBe("offline");
    s = step(s, { type: "ONLINE_DETECTED" });
    expect(s.status).toBe("loading");
  });

  it("RETRY returns loading from network_error / offline only", () => {
    let s = step(initialInsightsState, { type: "MOUNTED" });
    s = step(s, { type: "LOAD_FAILED_NETWORK" });
    s = step(s, { type: "RETRY" });
    expect(s.status).toBe("loading");

    const loaded = step(initialInsightsState, { type: "MOUNTED" });
    const after = step(loaded, { type: "RETRY" });
    expect(after).toBe(loaded);
  });
});

describe("insightsTelemetryEventFor — DES-0003 §6", () => {
  it("emits insights.opened on first MOUNTED", () => {
    const prev = initialInsightsState;
    const next = insightsReducer(prev, { type: "MOUNTED" });
    expect(insightsTelemetryEventFor(prev, next)).toBe("insights.opened");
  });

  it("emits insights.loaded.success with the period suffix", () => {
    const prev: InsightsState = { ...initialInsightsState, status: "loading" };
    const next = insightsReducer(prev, {
      type: "LOAD_SUCCEEDED",
      summary: STUB_SUMMARY,
      topProducts: STUB_TOP,
    });
    expect(insightsTelemetryEventFor(prev, next)).toBe(
      "insights.loaded.success:month"
    );
  });

  it("emits insights.period.changed for any period change", () => {
    const prev: InsightsState = { ...initialInsightsState, status: "loaded" };
    const next = insightsReducer(prev, {
      type: "PERIOD_CHANGED",
      period: "year",
    });
    expect(insightsTelemetryEventFor(prev, next)).toBe(
      "insights.period.changed:year"
    );
  });

  it("emits insights.offline.shown only on transition into offline", () => {
    const prev: InsightsState = { ...initialInsightsState, status: "loaded" };
    const next = insightsReducer(prev, { type: "OFFLINE_DETECTED" });
    expect(insightsTelemetryEventFor(prev, next)).toBe("insights.offline.shown");
  });
});

describe("compareWindows — DES-0003 §3.1", () => {
  it("decrease when current < previous", () => {
    expect(compareWindows("412.50", "503.10")).toEqual({
      kind: "decrease",
      pct: 18,
    });
  });

  it("increase when current > previous", () => {
    expect(compareWindows("110.00", "100.00")).toEqual({
      kind: "increase",
      pct: 10,
    });
  });

  it("none when previous is zero", () => {
    expect(compareWindows("110.00", "0.00")).toEqual({ kind: "none" });
  });

  it("none when both equal", () => {
    expect(compareWindows("110.00", "110.00")).toEqual({ kind: "none" });
  });

  it("none when totals are not parseable", () => {
    expect(compareWindows("abc", "100.00")).toEqual({ kind: "none" });
  });
});
