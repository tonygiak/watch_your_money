/**
 * Inline tag-as-business panel for the Receipt detail screen.
 *
 * Renders DES-0005 §3 layouts (untagged-collapsed, editing-expanded,
 * tagged-summary) on top of the `tagReducer` from `./tag.state`. This file
 * is a thin glue layer — every behavior decision lives in the reducer.
 *
 * Accessibility (DES-0005 §5):
 *   - Toggle uses `accessibilityRole="switch"` with `accessibilityState`.
 *   - Inputs declare `accessibilityLabel` + `accessibilityHint`.
 *   - Touch targets ≥ 44×44 dp.
 */

import React, { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { tagReceipt as apiTagReceipt } from "../../api/receipts";
import { t } from "../../lib/i18n";
import {
  CATEGORY_MAX_LEN,
  NOTES_MAX_LEN,
  initialTagState,
  tagReducer,
  tagTelemetryEventFor,
} from "./tag.state";

export type TagPanelProps = {
  receiptId: string;
  initialTagged: boolean;
  initialCategory: string | null;
  initialNotes: string | null;

  bearerToken: string;
  backendUrl: string;

  /** Called when the server returns 401 — the screen should navigate to Login. */
  onAuthError: () => void;
  /** Called on transient toast events — the screen owns the toast surface. */
  onToast?: (key: string) => void;

  /** Called when offline; toggle should be disabled (per ADR-0006 §7 / DES-0005 §7.1). */
  isOffline?: boolean;
};

export default function TagPanel(props: TagPanelProps): React.JSX.Element {
  const [state, dispatch] = useReducer(
    tagReducer,
    {
      tagged: props.initialTagged,
      category: props.initialCategory,
      notes: props.initialNotes,
    },
    initialTagState
  );

  const prevStateRef = useRef(state);

  // Telemetry — counts only, no PII (DES-0005 §6).
  useEffect(() => {
    const event = tagTelemetryEventFor(prevStateRef.current, state);
    if (event) {
      // Hook your telemetry sink here. e.g. telemetry.increment(event.name)
    }
    prevStateRef.current = state;
  }, [state]);

  // ---- Effect: POST when entering `saving` -----------------------------
  useEffect(() => {
    if (state.status !== "saving") return;
    let cancelled = false;
    const trimmedCategory = state.categoryInput.trim();
    const trimmedNotes = state.notesInput.trim();
    void (async () => {
      const result = await apiTagReceipt({
        receiptId: props.receiptId,
        isBusiness: true,
        category: trimmedCategory,
        notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
        bearerToken: props.bearerToken,
        backendUrl: props.backendUrl,
      });
      if (cancelled) return;
      if (result.kind === "ok") {
        dispatch({
          type: "TAG_SAVED",
          category: result.receipt.business_category,
          notes: result.receipt.notes,
        });
        props.onToast?.("tag.toast.tagged");
      } else if (result.status === 401) {
        dispatch({ type: "AUTH_ERROR" });
        props.onAuthError();
      } else if (result.status === 422) {
        dispatch({
          type: "VALIDATION_ERROR",
          error: { field: "category", messageKey: "tag.category.too_long" },
        });
      } else {
        dispatch({ type: "NETWORK_ERROR" });
        props.onToast?.("tag.toast.error.network");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, props, state.categoryInput, state.notesInput]);

  // ---- Effect: POST when entering `untagging` --------------------------
  useEffect(() => {
    if (state.status !== "untagging") return;
    let cancelled = false;
    void (async () => {
      const result = await apiTagReceipt({
        receiptId: props.receiptId,
        isBusiness: false,
        bearerToken: props.bearerToken,
        backendUrl: props.backendUrl,
      });
      if (cancelled) return;
      if (result.kind === "ok") {
        dispatch({ type: "UNTAG_SAVED" });
        props.onToast?.("tag.toast.untagged");
      } else if (result.status === 401) {
        dispatch({ type: "AUTH_ERROR" });
        props.onAuthError();
      } else {
        dispatch({ type: "NETWORK_ERROR" });
        props.onToast?.("tag.toast.error.network");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, props]);

  // ---- Handlers --------------------------------------------------------
  const onTogglePressed = useCallback(() => {
    if (props.isOffline) return;
    dispatch({ type: "TOGGLE_TAPPED" });
  }, [props.isOffline]);

  const onSummaryRowPressed = useCallback(() => {
    if (props.isOffline) return;
    dispatch({ type: "ROW_TAPPED" });
  }, [props.isOffline]);

  const onCategoryTyped = useCallback((value: string) => {
    dispatch({ type: "CATEGORY_TYPED", value });
  }, []);

  const onNotesTyped = useCallback((value: string) => {
    dispatch({ type: "NOTES_TYPED", value });
  }, []);

  const onSavePressed = useCallback(() => {
    dispatch({ type: "SAVE_TAPPED" });
  }, []);

  const onCancelPressed = useCallback(() => {
    dispatch({ type: "CANCEL_TAPPED" });
  }, []);

  // ---- Render ----------------------------------------------------------
  const isTagged =
    state.status === "tagged_idle" ||
    state.status === "saving" ||
    state.status === "untagging";

  const showEditingPanel = state.status === "editing" || state.status === "saving";
  const showSummaryRow =
    (state.status === "tagged_idle" || state.status === "untagging") &&
    state.savedCategory !== null;

  const saveDisabled = useMemo(() => {
    return state.categoryInput.trim().length === 0 || state.status === "saving";
  }, [state.categoryInput, state.status]);

  return (
    <View style={styles.root} accessibilityLabel="tag-panel">
      <View style={styles.toggleRow}>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={t("tag.toggle_label")}
          accessibilityState={{ checked: isTagged, disabled: !!props.isOffline }}
          value={isTagged}
          disabled={!!props.isOffline}
          onValueChange={onTogglePressed}
        />
        <Text
          style={[styles.toggleLabel, props.isOffline && styles.disabledText]}
        >
          {t("tag.toggle_label")}
        </Text>
        {(state.status === "saving" || state.status === "untagging") && (
          <ActivityIndicator style={styles.spinner} />
        )}
      </View>

      {showSummaryRow && (
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t("tag.summary.edit_hint")}
          style={styles.summaryRow}
          onPress={onSummaryRowPressed}
          disabled={!!props.isOffline}
        >
          <Text style={styles.summaryText}>
            {t("tag.summary.connector")} {state.savedCategory}
          </Text>
          {state.savedNotes && (
            <Text style={styles.summaryNotes} numberOfLines={1}>
              {state.savedNotes}
            </Text>
          )}
        </Pressable>
      )}

      {showEditingPanel && (
        <View style={styles.panel} accessibilityLabel="tag-editing-panel">
          <Text style={styles.fieldLabel}>{t("tag.category.label")}</Text>
          <TextInput
            accessibilityLabel={t("tag.category.label")}
            accessibilityHint={t("tag.category.hint")}
            style={[
              styles.input,
              state.validationError?.field === "category" && styles.inputError,
            ]}
            placeholder={t("tag.category.placeholder")}
            value={state.categoryInput}
            onChangeText={onCategoryTyped}
            maxLength={CATEGORY_MAX_LEN * 2}
            editable={state.status === "editing"}
            autoCapitalize="none"
          />
          {state.validationError?.field === "category" && (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {t(state.validationError.messageKey)}
            </Text>
          )}

          <Text style={styles.fieldLabel}>{t("tag.notes.label")}</Text>
          <TextInput
            accessibilityLabel={t("tag.notes.label")}
            accessibilityHint={t("tag.notes.hint")}
            style={[
              styles.input,
              styles.notesInput,
              state.validationError?.field === "notes" && styles.inputError,
            ]}
            placeholder={t("tag.notes.placeholder")}
            value={state.notesInput}
            onChangeText={onNotesTyped}
            maxLength={NOTES_MAX_LEN * 2}
            editable={state.status === "editing"}
            multiline
            numberOfLines={3}
          />
          {state.validationError?.field === "notes" && (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {t(state.validationError.messageKey)}
            </Text>
          )}

          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("tag.save")}
              accessibilityState={{ disabled: saveDisabled }}
              style={[styles.cta, saveDisabled && styles.ctaDisabled]}
              onPress={onSavePressed}
              disabled={saveDisabled}
            >
              {state.status === "saving" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>{t("tag.save")}</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("tag.cancel")}
              style={styles.secondaryCta}
              onPress={onCancelPressed}
              disabled={state.status === "saving"}
            >
              <Text style={styles.secondaryText}>{t("tag.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: 12 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    gap: 12,
  },
  toggleLabel: { fontSize: 16, color: "#222", flex: 1 },
  disabledText: { color: "#888" },
  spinner: { marginLeft: 8 },
  summaryRow: {
    flexDirection: "column",
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  summaryText: { fontSize: 14, color: "#444" },
  summaryNotes: { fontSize: 12, color: "#666", marginTop: 2 },
  panel: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
  },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#444", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 44,
    backgroundColor: "#fff",
    marginTop: 4,
  },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
  inputError: { borderColor: "#c00" },
  errorText: { fontSize: 13, color: "#c00", marginTop: 4 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  cta: {
    flex: 1,
    backgroundColor: "#0066cc",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  ctaDisabled: { backgroundColor: "#aac9e6" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryCta: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  secondaryText: { color: "#0066cc", fontSize: 16 },
});
