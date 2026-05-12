/**
 * Receipt detail screen.
 *
 * Renders the structured receipt (header → tag panel → line items → totals)
 * per `AGENTS.md` §5.5.2. The tag panel inline-edits per ADR-0008 / DES-0005;
 * everything else (line items, totals) is read-only render of the
 * `CacheableReceipt` shape.
 *
 * The screen is **purely a rendering surface** — telemetry, navigation, and
 * API calls live in the `TagPanel` and the host navigator.
 */

import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { CacheableReceipt } from "../../cache/types";
import { formatEur, formatGreekDate } from "../../lib/format";
import { t } from "../../lib/i18n";
import TagPanel from "./TagPanel";

export type ReceiptDetailScreenProps = {
  receipt: CacheableReceipt;
  bearerToken: string;
  backendUrl: string;
  onAuthError: () => void;
  isOffline?: boolean;
};

export default function ReceiptDetailScreen(
  props: ReceiptDetailScreenProps
): React.JSX.Element {
  const { receipt } = props;
  const [toastKey, setToastKey] = useState<string | null>(null);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      accessibilityLabel="receipt-detail"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.merchantName} numberOfLines={2}>
          {receipt.merchant_name}
        </Text>
        <Text style={styles.metadata}>
          {receipt.merchant_afm
            ? `ΑΦΜ ${receipt.merchant_afm} · `
            : ""}
          {formatGreekDate(receipt.issue_date)} ·{" "}
          {formatEur(parseFloat(receipt.total))}
        </Text>
      </View>

      {/* Tag-as-business inline panel (DES-0005) */}
      <View style={styles.tagSection}>
        <TagPanel
          receiptId={receipt.id}
          initialTagged={receipt.is_business_expense}
          initialCategory={receipt.business_category}
          initialNotes={receipt.notes}
          bearerToken={props.bearerToken}
          backendUrl={props.backendUrl}
          onAuthError={props.onAuthError}
          onToast={setToastKey}
          isOffline={props.isOffline}
        />
      </View>

      {/* Line items */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t("receipt.items")}</Text>
        {receipt.items.length === 0 ? (
          <Text style={styles.empty}>{t("receipt.no_items")}</Text>
        ) : (
          receipt.items.map((item) => (
            <View key={item.id} style={styles.lineItem}>
              <Text style={styles.lineDescription} numberOfLines={2}>
                {item.description || item.ean}
              </Text>
              <View style={styles.lineMetaRow}>
                <Text style={styles.lineMeta}>
                  {item.quantity} {item.unit} · {formatEur(parseFloat(item.unit_price))}
                </Text>
                <Text style={styles.lineTotal}>
                  {formatEur(parseFloat(item.total_value))}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Totals */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t("receipt.totals")}</Text>
        <TotalRow label={t("receipt.subtotal")} value={receipt.subtotal} />
        <TotalRow label={t("receipt.discount")} value={receipt.discount} />
        <TotalRow label={t("receipt.vat")} value={receipt.vat_total} />
        <TotalRow
          label={t("receipt.total")}
          value={receipt.total}
          emphasized
        />
        {receipt.payment_method && (
          <Text style={styles.paymentMethod}>
            {t("receipt.payment_method")}: {receipt.payment_method}
          </Text>
        )}
      </View>

      {/* Toast — non-blocking, dismisses on the next interaction. The screen
          owns the surface so multiple panels (tag, future delete, etc.) can
          share it. */}
      {toastKey !== null && (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>{t(toastKey)}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function TotalRow(props: {
  label: string;
  value: string;
  emphasized?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, props.emphasized && styles.totalEmphasized]}>
        {props.label}
      </Text>
      <Text style={[styles.totalValue, props.emphasized && styles.totalEmphasized]}>
        {formatEur(parseFloat(props.value))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  header: { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  merchantName: { fontSize: 20, fontWeight: "600", color: "#222" },
  metadata: { fontSize: 13, color: "#555", marginTop: 4 },
  tagSection: {
    marginTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  empty: { fontSize: 14, color: "#888", fontStyle: "italic" },
  lineItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  lineDescription: { fontSize: 14, color: "#222" },
  lineMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  lineMeta: { fontSize: 12, color: "#666" },
  lineTotal: { fontSize: 14, fontWeight: "600", color: "#222" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  totalLabel: { fontSize: 14, color: "#444" },
  totalValue: { fontSize: 14, color: "#222" },
  totalEmphasized: { fontSize: 16, fontWeight: "700" },
  paymentMethod: { fontSize: 13, color: "#666", marginTop: 12 },
  toast: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "#222",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  toastText: { color: "#fff", fontSize: 14 },
});
