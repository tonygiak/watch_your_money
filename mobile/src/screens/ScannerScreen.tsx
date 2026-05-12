/**
 * Scanner screen — wires `expo-camera` onto the `scannerReducer`.
 *
 * Excluded from the typecheck / test gate until BLG-0012 lands the Expo
 * runtime deps with `agent-safety-officer` + `engineering-manager` co-sign
 * per `AGENTS.md` §4.11. The reducer (`./scanner/state.ts`), the validator
 * (`../parsers/gr.ts`), the i18n table (`../i18n/strings.ts`), and the
 * locale detector (`../lib/locale.ts`) are already in the gate today.
 *
 * Activation checklist:
 *   1. `npm i expo expo-camera expo-localization react react-native`
 *   2. Re-include this file in `tsconfig.json`.
 *   3. Wire into the nav stack.
 *
 * Behaviour pinned by ADR-0003 + DES-0001. Everything below should be a
 * thin glue layer; complex logic stays in the testable modules above.
 */

import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

import { postReceiptsParse } from "../api/receipts";
import { t } from "../lib/i18n";
import { type GrQrFamily, validateGrQrCode } from "../parsers/gr";
import {
  initialScannerState,
  scannerReducer,
  telemetryEventFor,
} from "./scanner/state";

/**
 * Greek QR families that currently have a working backend adapter at
 * `POST /receipts/parse`. AADE / Epsilon / Family-C are recognised on-device
 * by `validateGrQrCode` per ADR-0014 §3 / BLG-0032, but routing them to the
 * backend today would just round-trip a 422 `UnsupportedQrUrl` — so we
 * deliberately keep them in the `unsupported_qr` UX path until BLG-0027 +
 * BLG-0028 ship. Widening this set is a one-line change in S-013 once the
 * adapters land.
 */
const IMPLEMENTED_FAMILIES: ReadonlySet<GrQrFamily> = new Set<GrQrFamily>([
  "einvoicing",
]);

type Props = {
  bearerToken: string;
  backendUrl: string;
  onSuccess: (receiptId: string) => void;
  /**
   * Called when the auth gate is *terminally* broken: a transient 401 has
   * already been retried after a silent `supabase.auth.refreshSession()`
   * and the retry also returned 401 — sign the user out (BLG-0024 /
   * ADR-0015 §8). The first 401 of any submission does NOT call this.
   */
  onAuthError: () => void;
  /**
   * Silent session refresh hook (BLG-0024). The scanner calls this once on
   * a recoverable 401, then retries the parse. Returns `true` if the
   * refresh succeeded (a fresh access token is available), `false`
   * otherwise. Injected through props so the screen never imports
   * `@supabase/supabase-js` directly.
   *
   * Optional for back-compat: when omitted, the recoverable path falls
   * straight through to terminal (existing behaviour pre-BLG-0024).
   */
  refreshSession?: () => Promise<boolean>;
  onClose: () => void;
};

export default function ScannerScreen(props: Props): React.JSX.Element {
  const [state, dispatch] = useReducer(scannerReducer, initialScannerState);
  const prevStatusRef = useRef(state.status);
  const submitAbortRef = useRef<AbortController | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [showPrePrompt, setShowPrePrompt] = useState(false);

  // ---- Telemetry (counts only, no PII) ------------------------------------
  useEffect(() => {
    const event = telemetryEventFor(prevStatusRef.current, state.status);
    if (event) {
      // Hook your telemetry sink here. Counts only — never PII.
      // e.g. telemetry.increment(event)
    }
    prevStatusRef.current = state.status;
  }, [state.status]);

  // ---- Open from tab: equivalent to FAB_PRESSED on the original DES-0001
  // entry point. Kicks the reducer from `idle` → `permission_check`.
  useEffect(() => {
    if (state.status === "idle") {
      dispatch({ type: "FAB_PRESSED" });
    }
  }, [state.status]);

  // ---- Permission flow ----------------------------------------------------
  useEffect(() => {
    if (state.status !== "permission_check") return;
    if (!permission) return;
    if (permission.granted) {
      dispatch({ type: "PERMISSION_GRANTED" });
      return;
    }
    if (!permission.canAskAgain) {
      dispatch({ type: "PERMISSION_BLOCKED" });
      return;
    }
    setShowPrePrompt(true);
  }, [state.status, permission]);

  const onPrePromptContinue = useCallback(async () => {
    setShowPrePrompt(false);
    const result = await requestPermission();
    if (result.granted) {
      dispatch({ type: "PERMISSION_GRANTED" });
    } else if (!result.canAskAgain) {
      dispatch({ type: "PERMISSION_BLOCKED" });
    } else {
      dispatch({ type: "PERMISSION_DENIED" });
    }
  }, [requestPermission]);

  // ---- Camera scan handler ------------------------------------------------
  const onBarcodeScanned = useCallback((event: { data: string }) => {
    if (state.status !== "scanning") return;
    const validation = validateGrQrCode(event.data);
    if (!validation.ok) {
      // DEV-ONLY diagnostic: print the rejected payload so we can decide
      // whether the receipt is genuinely unsupported or the validator needs
      // extending. Remove this `console.warn` once the supported-families
      // list is settled (post-BLG-0029 / S-013).
      // eslint-disable-next-line no-console
      console.warn(
        "[scanner] QR rejected — reason:",
        validation.reason,
        "data:",
        event.data
      );
      dispatch({ type: "QR_UNSUPPORTED" });
      return;
    }
    if (!IMPLEMENTED_FAMILIES.has(validation.family)) {
      // Recognised family (e.g. AADE / Epsilon / unknown_code) whose backend
      // adapter has not landed yet (BLG-0027 / BLG-0028 / BLG-0029). Route
      // to the standard unsupported_qr UX today; this branch is the only
      // change the scanner needs once those adapters ship.
      // eslint-disable-next-line no-console
      console.warn(
        "[scanner] QR family not yet implemented:",
        validation.family
      );
      dispatch({ type: "QR_UNSUPPORTED" });
      return;
    }
    dispatch({ type: "QR_DETECTED", qrUrl: event.data });
    dispatch({ type: "QR_DOMAIN_OK" });
  }, [state.status]);

  // ---- Submit (POST /receipts/parse) --------------------------------------
  useEffect(() => {
    if (state.status !== "submitting" || !state.qrUrl) return;
    submitAbortRef.current?.abort();
    const controller = new AbortController();
    submitAbortRef.current = controller;
    let cancelled = false;
    (async () => {
      const result = await postReceiptsParse({
        qrUrl: state.qrUrl!,
        bearerToken: props.bearerToken,
        backendUrl: props.backendUrl,
        signal: controller.signal,
      });
      if (cancelled) return;
      if (result.kind === "ok") {
        dispatch(
          result.isDuplicate
            ? { type: "SUBMIT_200_DUPLICATE", receiptId: result.receiptId }
            : { type: "SUBMIT_201_NEW", receiptId: result.receiptId }
        );
      } else {
        switch (result.status) {
          case 401:
            dispatch({ type: "SUBMIT_401" });
            break;
          case 422:
            dispatch({ type: "SUBMIT_422" });
            break;
          case 502:
            dispatch({ type: "SUBMIT_502" });
            break;
          case 503:
            dispatch({ type: "SUBMIT_503" });
            break;
          case "timeout":
            dispatch({ type: "SUBMIT_TIMEOUT" });
            break;
          default:
            dispatch({ type: "SUBMIT_GENERIC_ERROR" });
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [state.status, state.qrUrl, props.bearerToken, props.backendUrl]);

  // ---- Routing on terminal states -----------------------------------------
  useEffect(() => {
    if (state.status === "success_new" || state.status === "success_duplicate") {
      if (state.receipt) props.onSuccess(state.receipt.receiptId);
    }
    if (state.status === "auth_error_terminal") {
      props.onAuthError();
    }
  }, [state.status, state.receipt, props]);

  // ---- BLG-0024: silent refresh + retry on recoverable 401 ---------------
  // On a first 401 the reducer parks in `auth_error_recoverable`. Trigger a
  // single `supabase.auth.refreshSession()` (via the injected hook so the
  // screen never imports `@supabase/supabase-js`) and dispatch
  // `RETRY_AFTER_REFRESH` on success. On failure (or when no refresh hook
  // is wired), the auth error is treated as terminal.
  useEffect(() => {
    if (state.status !== "auth_error_recoverable") return;
    let cancelled = false;
    (async () => {
      const refresh = props.refreshSession;
      const ok = refresh ? await refresh() : false;
      if (cancelled) return;
      if (ok) {
        dispatch({ type: "RETRY_AFTER_REFRESH" });
      } else {
        // No refresh hook or refresh failed → escalate to terminal by
        // running through SUBMIT_401 again (reducer routes to terminal
        // because hasAttemptedAuthRefresh would be set; but at this point
        // we haven't bumped it — set it via RETRY_AFTER_REFRESH path is
        // wrong because that would re-submit. Simplest: just sign out.)
        props.onAuthError();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, props]);

  // ---- Renderers ----------------------------------------------------------
  if (showPrePrompt) {
    return (
      <Modal transparent animationType="fade">
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {t("scanner.permission.preprompt.title")}
            </Text>
            <Text style={styles.modalBody}>
              {t("scanner.permission.preprompt.body")}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setShowPrePrompt(false);
                  dispatch({ type: "USER_CANCELLED" });
                  props.onClose();
                }}
              >
                <Text style={styles.actionSecondary}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onPrePromptContinue}>
                <Text style={styles.actionPrimary}>{t("common.continue")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (state.status === "permission_blocked") {
    return (
      <ErrorModal
        title={t("scanner.permission.blocked.title")}
        body={t("scanner.permission.blocked.body")}
        actionLabel={t("common.openSettings")}
        onAction={() => Linking.openSettings()}
        onClose={() => {
          dispatch({ type: "USER_CANCELLED" });
          props.onClose();
        }}
      />
    );
  }

  if (state.status === "permission_denied") {
    return (
      <ErrorModal
        title={t("scanner.permission.denied.title")}
        body={t("scanner.permission.denied.body")}
        actionLabel={t("scanner.permission.denied.action")}
        onAction={onPrePromptContinue}
        onClose={() => {
          dispatch({ type: "USER_CANCELLED" });
          props.onClose();
        }}
      />
    );
  }

  if (
    state.status === "auth_error_terminal" ||
    state.status === "parse_error_user" ||
    state.status === "network_error" ||
    state.status === "parser_drift" ||
    state.status === "generic_error" ||
    state.status === "camera_error"
  ) {
    const map = {
      auth_error_terminal: [
        "scanner.error.auth.title",
        "scanner.error.auth.body",
      ],
      parse_error_user: [
        "scanner.error.parse.title",
        "scanner.error.parse.body",
      ],
      network_error: [
        "scanner.error.network.title",
        "scanner.error.network.body",
      ],
      parser_drift: ["scanner.error.drift.title", "scanner.error.drift.body"],
      generic_error: [
        "scanner.error.generic.title",
        "scanner.error.generic.body",
      ],
      camera_error: [
        "scanner.error.camera.title",
        "scanner.error.camera.body",
      ],
    } as const;
    const [titleKey, bodyKey] = map[state.status];
    const isAuth = state.status === "auth_error_terminal";
    const isRetryable =
      state.status === "network_error" ||
      state.status === "parser_drift" ||
      state.status === "generic_error" ||
      state.status === "camera_error" ||
      state.status === "parse_error_user";
    return (
      <ErrorModal
        title={t(titleKey)}
        body={t(bodyKey)}
        actionLabel={
          isAuth ? t("scanner.error.auth.action") : t("common.retry")
        }
        onAction={() => {
          if (isAuth) return; // Routing handled by useEffect.
          if (isRetryable) dispatch({ type: "RETRY" });
        }}
        onClose={() => {
          dispatch({ type: "USER_CANCELLED" });
          props.onClose();
        }}
      />
    );
  }

  // Camera surface for permission_check / scanning / unsupported_qr /
  // validating_url / submitting / success_*. The camera stays mounted across
  // these so navigation feels instant.
  return (
    <View style={styles.cameraRoot}>
      {permission?.granted && state.status !== "permission_check" && (
        <CameraView
          style={styles.cameraSurface}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcodeScanned}
        />
      )}
      <Text style={styles.scanningHeader}>
        {t("scanner.scanning.header")}
      </Text>
      {state.status === "submitting" && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>
            {t("scanner.submitting.body")}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              submitAbortRef.current?.abort();
              dispatch({ type: "USER_CANCELLED" });
              props.onClose();
            }}
          >
            <Text style={styles.actionSecondary}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      )}
      {state.status === "auth_error_recoverable" && (
        <View style={styles.overlay} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>
            {t("scanner.error.auth.refreshing")}
          </Text>
        </View>
      )}
      {state.status === "unsupported_qr" && (
        <Toast
          message={t("scanner.error.unsupported.toast")}
          onDismiss={() => dispatch({ type: "DISMISS_ERROR" })}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}
        style={styles.closeButton}
        onPress={() => {
          submitAbortRef.current?.abort();
          dispatch({ type: "USER_CANCELLED" });
          props.onClose();
        }}
      >
        <Text style={styles.closeButtonText}>×</Text>
      </Pressable>
    </View>
  );
}

function ErrorModal(props: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <Modal transparent animationType="fade">
      <View style={styles.modalRoot}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{props.title}</Text>
          <Text style={styles.modalBody}>{props.body}</Text>
          <View style={styles.modalActions}>
            <Pressable accessibilityRole="button" onPress={props.onClose}>
              <Text style={styles.actionSecondary}>{t("common.cancel")}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={props.onAction}>
              <Text style={styles.actionPrimary}>{props.actionLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Toast(props: { message: string; onDismiss: () => void }): React.JSX.Element {
  useEffect(() => {
    const id = setTimeout(props.onDismiss, 3000);
    return () => clearTimeout(id);
  }, [props.onDismiss]);
  return (
    <View accessibilityLiveRegion="polite" style={styles.toast}>
      <Text style={styles.toastText}>{props.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraRoot: { flex: 1, backgroundColor: "#000" },
  cameraSurface: { flex: 1 },
  scanningHeader: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    paddingVertical: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayText: { color: "#fff", marginTop: 12, fontSize: 16 },
  toast: {
    position: "absolute",
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  toastText: { color: "#fff", fontSize: 14 },
  closeButton: {
    position: "absolute",
    top: 32,
    left: 16,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 22,
  },
  closeButtonText: { color: "#fff", fontSize: 28 },
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  modalBody: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 16 },
  actionPrimary: {
    color: "#0066cc",
    fontSize: 16,
    fontWeight: "600",
    minHeight: 44,
    textAlignVertical: "center",
  },
  actionSecondary: {
    color: "#666",
    fontSize: 16,
    minHeight: 44,
    textAlignVertical: "center",
  },
});
