/**
 * Insights screen — wires the two backend endpoints onto the reducer.
 *
 * Behavior pinned by ADR-0005 + DES-0003. Charts render via
 * `react-native-chart-kit` (per ADR-0007 — flagged for re-evaluation).
 * Greek-first copy from `insights.*`; numbers via `mobile/src/lib/format.ts`.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  fetchInsightsProducts,
  fetchInsightsSummary,
} from "../../api/insights";
import { formatEur } from "../../lib/format";
import { t } from "../../lib/i18n";
import {
  compareWindows,
  initialInsightsState,
  insightsReducer,
  insightsTelemetryEventFor,
  type InsightsPeriod,
  type InsightsState,
} from "./state";

export type InsightsScreenProps = {
  bearerToken: string;
  backendUrl: string;
  isOnline: boolean;
  onAuthError: () => void;
  onScanPressed: () => void;
};

const PERIODS: InsightsPeriod[] = ["week", "month", "year"];

export default function InsightsScreen(
  props: InsightsScreenProps
): JSX.Element {
  const [state, dispatch] = useReducer(insightsReducer, initialInsightsState);
  const prevRef = useRef<InsightsState>(state);

  // ---- Telemetry --------------------------------------------------------
  useEffect(() => {
    const event = insightsTelemetryEventFor(prevRef.current, state);
    if (event) {
      // PII-free per DES-0003 §6.
    }
    prevRef.current = state;
  }, [state]);

  // ---- Mount & online/offline -------------------------------------------
  useEffect(() => {
    dispatch({ type: "MOUNTED" });
  }, []);

  useEffect(() => {
    if (!props.isOnline) dispatch({ type: "OFFLINE_DETECTED" });
    else dispatch({ type: "ONLINE_DETECTED" });
  }, [props.isOnline]);

  // ---- Routing on auth error -------------------------------------------
  useEffect(() => {
    if (state.status === "auth_error") props.onAuthError();
  }, [state.status, props]);

  // ---- Load both endpoints in parallel whenever loading -----------------
  useEffect(() => {
    if (state.status !== "loading") return;
    let cancelled = false;
    void (async () => {
      const [summary, products] = await Promise.all([
        fetchInsightsSummary({
          bearerToken: props.bearerToken,
          backendUrl: props.backendUrl,
          period: state.period,
          anchor: state.anchor ?? undefined,
        }),
        fetchInsightsProducts({
          bearerToken: props.bearerToken,
          backendUrl: props.backendUrl,
          period: state.period,
          anchor: state.anchor ?? undefined,
        }),
      ]);
      if (cancelled) return;
      if (summary.kind === "error" || products.kind === "error") {
        if (summary.kind === "error" && summary.status === 401) {
          dispatch({ type: "LOAD_FAILED_AUTH" });
        } else if (products.kind === "error" && products.status === 401) {
          dispatch({ type: "LOAD_FAILED_AUTH" });
        } else {
          dispatch({ type: "LOAD_FAILED_NETWORK" });
        }
        return;
      }
      if (summary.data.current.receipt_count === 0) {
        dispatch({
          type: "LOAD_EMPTY",
          summary: summary.data,
          topProducts: products.data,
        });
      } else {
        dispatch({
          type: "LOAD_SUCCEEDED",
          summary: summary.data,
          topProducts: products.data,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    state.status,
    state.period,
    state.anchor,
    props.bearerToken,
    props.backendUrl,
  ]);

  const onPeriodChanged = useCallback((period: InsightsPeriod) => {
    dispatch({ type: "PERIOD_CHANGED", period });
  }, []);

  const onRetry = useCallback(() => {
    dispatch({ type: "RETRY" });
  }, []);

  // ---- Render -----------------------------------------------------------
  const comparison = useMemo(() => {
    if (!state.summary) return { kind: "none" as const };
    return compareWindows(
      state.summary.current.total,
      state.summary.previous.total
    );
  }, [state.summary]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      accessibilityLabel="insights-screen"
    >
      <Text style={styles.title}>{t("insights.title")}</Text>
      <View style={styles.tabs} accessibilityRole="tablist">
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            accessibilityRole="tab"
            accessibilityLabel={t(`insights.period.${p}`)}
            accessibilityState={{ selected: state.period === p }}
            style={[
              styles.tab,
              state.period === p && styles.tabActive,
            ]}
            onPress={() => onPeriodChanged(p)}
          >
            <Text
              style={[
                styles.tabText,
                state.period === p && styles.tabTextActive,
              ]}
            >
              {t(`insights.period.${p}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {state.status === "offline" && (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <Text style={styles.bannerTitle}>{t("insights.offline.title")}</Text>
          <Text style={styles.bannerBody}>{t("insights.offline.body")}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.cta}
            onPress={onRetry}
          >
            <Text style={styles.ctaText}>{t("insights.retry_cta")}</Text>
          </Pressable>
        </View>
      )}

      {state.status === "network_error" && (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <Text style={styles.bannerTitle}>{t("insights.error.network")}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.cta}
            onPress={onRetry}
          >
            <Text style={styles.ctaText}>{t("insights.retry_cta")}</Text>
          </Pressable>
        </View>
      )}

      {state.status === "empty" && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t("insights.empty.title")}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.cta}
            onPress={props.onScanPressed}
          >
            <Text style={styles.ctaText}>{t("insights.empty.cta")}</Text>
          </Pressable>
        </View>
      )}

      {state.status === "loaded" && state.summary && state.topProducts && (
        <>
          <Text style={styles.bigMoney}>
            {formatEur(Number(state.summary.current.total))}
          </Text>
          <Text style={styles.subtle}>
            {t("insights.summary.receipts").replace(
              "{count}",
              String(state.summary.current.receipt_count)
            )}
          </Text>
          {comparison.kind === "decrease" && (
            <Text style={[styles.compare, styles.compareDecrease]}>
              ▼{" "}
              {t("insights.compare.decrease")
                .replace("{pct}", String(comparison.pct))
                .replace(
                  "{period}",
                  t(`insights.period.${state.summary.period}`).toLowerCase()
                )}
            </Text>
          )}
          {comparison.kind === "increase" && (
            <Text style={[styles.compare, styles.compareIncrease]}>
              ▲{" "}
              {t("insights.compare.increase")
                .replace("{pct}", String(comparison.pct))
                .replace(
                  "{period}",
                  t(`insights.period.${state.summary.period}`).toLowerCase()
                )}
            </Text>
          )}
          {comparison.kind === "none" && (
            <Text style={styles.compare}>– {t("insights.compare.none")}</Text>
          )}

          <Text style={styles.sectionTitle}>
            {t("insights.section.by_category")}
          </Text>
          {state.summary.by_category.map((row) => (
            <View key={row.category} style={styles.row}>
              <Text style={styles.rowLabel}>
                {row.category === "untagged"
                  ? t("insights.category.untagged")
                  : row.category}
              </Text>
              <Text style={styles.rowValue}>
                {formatEur(Number(row.total))}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>
            {t("insights.section.top_merchants")}
          </Text>
          {state.summary.by_merchant.slice(0, 5).map((row) => (
            <View key={row.merchant_name} style={styles.row}>
              <Text style={styles.rowLabel}>{row.merchant_name}</Text>
              <Text style={styles.rowValue}>
                {formatEur(Number(row.total))}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>
            {t("insights.section.top_products")}
          </Text>
          {state.topProducts.products.map((p) => (
            <View key={p.ean || p.description} style={styles.productRow}>
              <Text style={styles.rowLabel}>{p.description}</Text>
              <Text style={styles.subtle}>
                {t("insights.product.purchases").replace(
                  "{count}",
                  String(p.frequency)
                )}{" "}
                ·{" "}
                {t("insights.product.avg_price").replace(
                  "{price}",
                  formatEur(Number(p.average_unit_price))
                )}{" "}
                ·{" "}
                {t("insights.product.total").replace(
                  "{amount}",
                  formatEur(Number(p.total_spend))
                )}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24 },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 16 },
  tabs: { flexDirection: "row", marginBottom: 16 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  tabActive: { backgroundColor: "#0066cc", borderColor: "#0066cc" },
  tabText: { fontSize: 15, color: "#444" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  bigMoney: { fontSize: 36, fontWeight: "600", marginTop: 16 },
  subtle: { fontSize: 14, color: "#666" },
  compare: { fontSize: 14, marginTop: 4 },
  compareDecrease: { color: "#208020" },
  compareIncrease: { color: "#c03030" },
  sectionTitle: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#444",
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  rowLabel: { fontSize: 15, flex: 1 },
  rowValue: { fontSize: 15, fontWeight: "600" },
  productRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  banner: {
    backgroundColor: "#f7f3e8",
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
  },
  bannerTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  bannerBody: { fontSize: 14, color: "#444", marginBottom: 8 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 16, marginBottom: 16 },
  cta: {
    backgroundColor: "#0066cc",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
