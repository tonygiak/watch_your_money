/**
 * Scanner state machine (DES-0001 + ADR-0003).
 *
 * Pure-TS reducer with no React, no React-Native, no Expo imports — so it's
 * unit-testable in jest's node environment without rendering anything. The
 * actual `ScannerScreen.tsx` is a thin wrapper that wires `expo-camera`,
 * `Linking.openSettings()`, `AbortController`, and the backend client onto
 * this reducer.
 *
 * Every state and every transition listed in DES-0001 §"State machine" has
 * exactly one named state node and one named action.
 */

export type ScannerStatus =
  | "idle"
  | "permission_check"
  | "permission_denied"
  | "permission_blocked"
  | "scanning"
  | "unsupported_qr"
  | "validating_url"
  | "submitting"
  | "success_new"
  | "success_duplicate"
  | "auth_error_recoverable"
  | "auth_error_terminal"
  | "parse_error_user"
  | "network_error"
  | "parser_drift"
  | "generic_error"
  | "camera_error";

export type ScannerErrorCode =
  | "unsupported_url"
  | "auth"
  | "parse_error"
  | "network"
  | "drift"
  | "generic"
  | "camera";

/** Receipt id returned by the backend on success (`201` or `200`). */
export type ReceiptRef = { receiptId: string; isDuplicate: boolean };

export type ScannerState = {
  status: ScannerStatus;
  /** The most recently scanned QR URL (for retry). Cleared on success / cancel. */
  qrUrl: string | null;
  /** The receipt id returned by the backend on success. */
  receipt: ReceiptRef | null;
  /** Last error code surfaced to the user (drives copy + telemetry). */
  errorCode: ScannerErrorCode | null;
  /** Number of retries on the same `qrUrl` (capped externally if desired). */
  retries: number;
  /**
   * Whether we have already attempted a silent `supabase.auth.refreshSession()`
   * + retry for the current `qrUrl` (BLG-0024 / ADR-0015 §8). Reset on
   * `USER_CANCELLED` and on any non-401 outcome. A second 401 on the same
   * submission goes to `auth_error_terminal` and signs the user out.
   */
  hasAttemptedAuthRefresh: boolean;
};

export const initialScannerState: ScannerState = {
  status: "idle",
  qrUrl: null,
  receipt: null,
  errorCode: null,
  retries: 0,
  hasAttemptedAuthRefresh: false,
};

// ---------------------------------------------------------------------------
// Actions (one per transition in DES-0001)
// ---------------------------------------------------------------------------

export type ScannerAction =
  | { type: "FAB_PRESSED" }
  | { type: "PERMISSION_GRANTED" }
  | { type: "PERMISSION_DENIED" }
  | { type: "PERMISSION_BLOCKED" }
  | { type: "QR_DETECTED"; qrUrl: string }
  | { type: "QR_UNSUPPORTED" }
  | { type: "QR_DOMAIN_OK" }
  | { type: "USER_CANCELLED" }
  | { type: "CAMERA_ERROR" }
  | { type: "SUBMIT_201_NEW"; receiptId: string }
  | { type: "SUBMIT_200_DUPLICATE"; receiptId: string }
  /**
   * Backend returned 401. The reducer routes to
   * `auth_error_recoverable` on the first 401 of this submission, or to
   * `auth_error_terminal` on a 401 *after* a `RETRY_AFTER_REFRESH` attempt
   * — see BLG-0024 / ADR-0015 §8.
   */
  | { type: "SUBMIT_401" }
  /**
   * Retry the parse after a successful silent `supabase.auth.refreshSession()`.
   * Only legal from `auth_error_recoverable`. Bumps `hasAttemptedAuthRefresh`.
   */
  | { type: "RETRY_AFTER_REFRESH" }
  | { type: "SUBMIT_422" }
  | { type: "SUBMIT_502" }
  | { type: "SUBMIT_503" }
  | { type: "SUBMIT_TIMEOUT" }
  | { type: "SUBMIT_GENERIC_ERROR" }
  | { type: "RETRY" }
  | { type: "DISMISS_ERROR" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function scannerReducer(
  state: ScannerState,
  action: ScannerAction
): ScannerState {
  switch (action.type) {
    case "FAB_PRESSED":
      // Only `idle` can start the flow (a stray FAB while we're already
      // scanning is a no-op; protects against double-tap regressions).
      if (state.status !== "idle") return state;
      return { ...state, status: "permission_check" };

    case "PERMISSION_GRANTED":
      if (state.status !== "permission_check") return state;
      return { ...state, status: "scanning" };

    case "PERMISSION_DENIED":
      if (state.status !== "permission_check") return state;
      return { ...state, status: "permission_denied" };

    case "PERMISSION_BLOCKED":
      if (state.status !== "permission_check") return state;
      return { ...state, status: "permission_blocked" };

    case "QR_DETECTED":
      if (state.status !== "scanning") return state;
      return {
        ...state,
        status: "validating_url",
        qrUrl: action.qrUrl,
        retries: 0,
      };

    case "QR_UNSUPPORTED":
      // Two entry points per DES-0001: from `scanning` (camera saw a non-GR
      // QR) and from `validating_url` (domain check failed). Both lead to a
      // non-blocking toast over the still-open camera so the user can scan
      // again without re-tapping the FAB (DES-0001 §"unsupported_qr").
      if (
        state.status !== "scanning" &&
        state.status !== "validating_url"
      ) {
        return state;
      }
      return {
        ...state,
        status: "unsupported_qr",
        errorCode: "unsupported_url",
      };

    case "QR_DOMAIN_OK":
      if (state.status !== "validating_url") return state;
      return { ...state, status: "submitting" };

    case "USER_CANCELLED":
      // From any state — closes back to idle.
      return { ...initialScannerState };

    case "CAMERA_ERROR":
      if (
        state.status !== "scanning" &&
        state.status !== "permission_check"
      ) {
        return state;
      }
      return { ...state, status: "camera_error", errorCode: "camera" };

    case "SUBMIT_201_NEW":
      if (state.status !== "submitting") return state;
      return {
        ...state,
        status: "success_new",
        receipt: { receiptId: action.receiptId, isDuplicate: false },
        errorCode: null,
        hasAttemptedAuthRefresh: false,
      };

    case "SUBMIT_200_DUPLICATE":
      if (state.status !== "submitting") return state;
      return {
        ...state,
        status: "success_duplicate",
        receipt: { receiptId: action.receiptId, isDuplicate: true },
        errorCode: null,
        hasAttemptedAuthRefresh: false,
      };

    case "SUBMIT_401":
      if (state.status !== "submitting") return state;
      // First 401 → recoverable: try a silent session refresh + one retry.
      // Second 401 (after `RETRY_AFTER_REFRESH`) → terminal: hard sign-out.
      // This composes with the BLG-0023 backend so a transient
      // JWKS-unreachable window does not sign the user out.
      if (state.hasAttemptedAuthRefresh) {
        return { ...state, status: "auth_error_terminal", errorCode: "auth" };
      }
      return { ...state, status: "auth_error_recoverable", errorCode: "auth" };

    case "RETRY_AFTER_REFRESH":
      // Legal only from the recoverable state. Bump the refresh-attempt
      // flag so any subsequent 401 routes straight to terminal.
      if (state.status !== "auth_error_recoverable") return state;
      if (state.qrUrl === null) return state;
      return {
        ...state,
        status: "submitting",
        errorCode: null,
        hasAttemptedAuthRefresh: true,
      };

    case "SUBMIT_422":
      if (state.status !== "submitting") return state;
      return {
        ...state,
        status: "parse_error_user",
        errorCode: "parse_error",
      };

    case "SUBMIT_502":
    case "SUBMIT_TIMEOUT":
      if (state.status !== "submitting") return state;
      return { ...state, status: "network_error", errorCode: "network" };

    case "SUBMIT_503":
      if (state.status !== "submitting") return state;
      return { ...state, status: "parser_drift", errorCode: "drift" };

    case "SUBMIT_GENERIC_ERROR":
      if (state.status !== "submitting") return state;
      return { ...state, status: "generic_error", errorCode: "generic" };

    case "RETRY":
      // Retry only makes sense when we have a URL on hand; otherwise a no-op.
      if (state.qrUrl === null) return state;
      if (
        state.status !== "network_error" &&
        state.status !== "parser_drift" &&
        state.status !== "generic_error"
      ) {
        return state;
      }
      return {
        ...state,
        status: "submitting",
        errorCode: null,
        retries: state.retries + 1,
      };

    case "DISMISS_ERROR":
      // Lighter than USER_CANCELLED: clears the error overlay back to camera.
      if (state.status === "unsupported_qr") {
        return { ...state, status: "scanning", errorCode: null };
      }
      return { ...state, status: "idle", errorCode: null };

    default: {
      // Exhaustiveness check — TypeScript will flag any new action type that
      // isn't handled above.
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Telemetry (counts only, no PII)
//
// Tiny module-local accumulator. Production wiring forwards these to whatever
// telemetry sink we end up using. Captured here so the reducer + telemetry
// shape can be unit-tested together.
// ---------------------------------------------------------------------------

export type TelemetryEvent =
  | "scanner_opened"
  | "qr_detected_supported"
  | "qr_detected_unsupported"
  | "submit_success_new"
  | "submit_success_duplicate"
  | "submit_auth_refresh_attempt"
  | `submit_failure_${ScannerErrorCode}`;

/** Map a state transition to the telemetry event it should emit (if any). */
export function telemetryEventFor(
  prev: ScannerStatus,
  next: ScannerStatus
): TelemetryEvent | null {
  if (prev === "idle" && next === "permission_check") return "scanner_opened";
  if (prev === "scanning" && next === "validating_url")
    return "qr_detected_supported";
  if (
    (prev === "scanning" || prev === "validating_url") &&
    next === "unsupported_qr"
  ) {
    return "qr_detected_unsupported";
  }
  if (prev === "submitting" && next === "success_new")
    return "submit_success_new";
  if (prev === "submitting" && next === "success_duplicate")
    return "submit_success_duplicate";
  if (prev === "submitting" && next === "auth_error_recoverable")
    return "submit_auth_refresh_attempt";
  if (prev === "submitting" && next === "auth_error_terminal")
    return "submit_failure_auth";
  if (prev === "submitting" && next === "parse_error_user")
    return "submit_failure_parse_error";
  if (prev === "submitting" && next === "network_error")
    return "submit_failure_network";
  if (prev === "submitting" && next === "parser_drift")
    return "submit_failure_drift";
  if (prev === "submitting" && next === "generic_error")
    return "submit_failure_generic";
  if (next === "camera_error") return "submit_failure_camera";
  return null;
}
