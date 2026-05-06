/**
 * Login screen state machine (DES-0002 §2 + ADR-0004).
 *
 * Pure-TS reducer with no React, no React-Native, no Expo, no Supabase
 * imports. Same pattern as `mobile/src/screens/scanner/state.ts` so the
 * full transition table is unit-testable without rendering anything.
 *
 * The actual `LoginScreen.tsx` is a thin wrapper that wires
 * `@supabase/supabase-js` (`signInWithOtp`, `verifyOtp`), `NetInfo`, and
 * `expo-secure-store` onto this reducer.
 */

export type LoginStatus =
  | "idle"
  | "entering_phone"
  | "submitting_phone"
  | "awaiting_otp"
  | "verifying_otp"
  | "wrong_otp"
  | "expired_otp"
  | "cooldown"
  | "network_error"
  | "rate_limited"
  | "success";

export type LoginErrorCode =
  | "invalid_phone"
  | "wrong_otp"
  | "expired_otp"
  | "rate_limited"
  | "network";

export type LoginState = {
  status: LoginStatus;
  /** The free-form phone-input field value (still being typed). */
  phoneInput: string;
  /** The E.164 phone Supabase received the OTP for; cleared on `back`. */
  phoneE164: string | null;
  /** The 6-digit OTP being typed. Cleared on every state-changing action. */
  otpInput: string;
  /** Last error code surfaced to the user (drives copy + telemetry). */
  errorCode: LoginErrorCode | null;
  /** Cooldown remaining in seconds (computed by the host on `tick`). */
  cooldownSeconds: number;
};

export const initialLoginState: LoginState = {
  status: "idle",
  phoneInput: "",
  phoneE164: null,
  otpInput: "",
  errorCode: null,
  cooldownSeconds: 0,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type LoginAction =
  | { type: "PHONE_TYPED"; value: string }
  | { type: "SUBMIT_PHONE"; e164: string }
  | { type: "PHONE_INVALID" }
  | { type: "OTP_SENT" }
  | { type: "OTP_TYPED"; value: string }
  | { type: "SUBMIT_OTP" }
  | { type: "OTP_VERIFIED" }
  | { type: "OTP_WRONG" }
  | { type: "OTP_EXPIRED" }
  | { type: "RESEND_REQUESTED"; cooldownSeconds: number }
  | { type: "COOLDOWN_TICK"; remaining: number }
  | { type: "COOLDOWN_ENDED" }
  | { type: "NETWORK_ERROR" }
  | { type: "RATE_LIMITED"; cooldownSeconds: number }
  | { type: "BACK_TO_PHONE" }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function loginReducer(state: LoginState, action: LoginAction): LoginState {
  switch (action.type) {
    case "PHONE_TYPED": {
      // From idle / entering_phone / network_error: any keystroke moves us
      // back to entering_phone with the new value (network_error retains
      // the last-typed value per DES-0002 §2 transitions).
      if (
        state.status !== "idle" &&
        state.status !== "entering_phone" &&
        state.status !== "network_error" &&
        state.status !== "expired_otp"
      ) {
        return state;
      }
      return {
        ...state,
        status: "entering_phone",
        phoneInput: action.value,
        errorCode: null,
      };
    }

    case "SUBMIT_PHONE": {
      if (state.status !== "entering_phone") return state;
      return {
        ...state,
        status: "submitting_phone",
        phoneE164: action.e164,
        errorCode: null,
      };
    }

    case "PHONE_INVALID": {
      // Defensive: only fires if the host pre-disable fails to catch an
      // invalid value. Keep the user on entering_phone with an error.
      if (state.status !== "submitting_phone") return state;
      return { ...state, status: "entering_phone", errorCode: "invalid_phone" };
    }

    case "OTP_SENT": {
      if (state.status !== "submitting_phone") return state;
      return {
        ...state,
        status: "awaiting_otp",
        otpInput: "",
        errorCode: null,
        cooldownSeconds: 0,
      };
    }

    case "OTP_TYPED": {
      if (
        state.status !== "awaiting_otp" &&
        state.status !== "wrong_otp" &&
        state.status !== "cooldown"
      ) {
        return state;
      }
      // Wrong-otp + new keystroke: clear the error and accept the input.
      const nextStatus = state.status === "wrong_otp" ? "awaiting_otp" : state.status;
      return {
        ...state,
        status: nextStatus,
        otpInput: action.value,
        errorCode: null,
      };
    }

    case "SUBMIT_OTP": {
      if (state.status !== "awaiting_otp" && state.status !== "cooldown") {
        return state;
      }
      if (state.otpInput.length !== 6) return state;
      return { ...state, status: "verifying_otp", errorCode: null };
    }

    case "OTP_VERIFIED": {
      if (state.status !== "verifying_otp") return state;
      return { ...state, status: "success", errorCode: null };
    }

    case "OTP_WRONG": {
      if (state.status !== "verifying_otp") return state;
      return {
        ...state,
        status: "wrong_otp",
        otpInput: "",
        errorCode: "wrong_otp",
      };
    }

    case "OTP_EXPIRED": {
      if (state.status !== "verifying_otp") return state;
      // Expired OTP → bounce back to phone entry with the old phoneE164
      // cleared so the user re-confirms the phone before a new send.
      return {
        ...state,
        status: "expired_otp",
        otpInput: "",
        errorCode: "expired_otp",
      };
    }

    case "RESEND_REQUESTED": {
      if (state.status !== "awaiting_otp" && state.status !== "wrong_otp") {
        return state;
      }
      return {
        ...state,
        status: "cooldown",
        cooldownSeconds: action.cooldownSeconds,
        errorCode: null,
      };
    }

    case "COOLDOWN_TICK": {
      if (state.status !== "cooldown") return state;
      return { ...state, cooldownSeconds: Math.max(0, action.remaining) };
    }

    case "COOLDOWN_ENDED": {
      if (state.status !== "cooldown") return state;
      return { ...state, status: "awaiting_otp", cooldownSeconds: 0 };
    }

    case "NETWORK_ERROR": {
      // Only meaningful while a request is in flight.
      if (state.status !== "submitting_phone" && state.status !== "verifying_otp") {
        return state;
      }
      return { ...state, status: "network_error", errorCode: "network" };
    }

    case "RATE_LIMITED": {
      if (state.status !== "submitting_phone") return state;
      return {
        ...state,
        status: "rate_limited",
        cooldownSeconds: action.cooldownSeconds,
        errorCode: "rate_limited",
      };
    }

    case "BACK_TO_PHONE": {
      // Available from awaiting_otp / wrong_otp / expired_otp / cooldown
      // / rate_limited / network_error — everywhere except the in-flight
      // submitting_phone / verifying_otp and the terminal success.
      if (
        state.status === "submitting_phone" ||
        state.status === "verifying_otp" ||
        state.status === "success"
      ) {
        return state;
      }
      return {
        ...state,
        status: "entering_phone",
        otpInput: "",
        phoneE164: null,
        errorCode: null,
        cooldownSeconds: 0,
      };
    }

    case "RESET": {
      return { ...initialLoginState };
    }

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Telemetry (counts only, no PII per ADR-0003 §7 / DES-0002 §6)
// ---------------------------------------------------------------------------

export type LoginTelemetryEvent =
  | "login.submit_phone.attempted"
  | "login.submit_phone.succeeded"
  | "login.submit_phone.failed.network"
  | "login.submit_phone.failed.rate_limited"
  | "login.verify_otp.attempted"
  | "login.verify_otp.succeeded"
  | "login.verify_otp.failed.wrong"
  | "login.verify_otp.failed.expired"
  | "login.verify_otp.failed.network"
  | "login.resend_otp.attempted"
  | "login.cooldown.entered";

export function loginTelemetryEventFor(
  prev: LoginStatus,
  next: LoginStatus
): LoginTelemetryEvent | null {
  if (prev === "entering_phone" && next === "submitting_phone") {
    return "login.submit_phone.attempted";
  }
  if (prev === "submitting_phone" && next === "awaiting_otp") {
    return "login.submit_phone.succeeded";
  }
  if (prev === "submitting_phone" && next === "network_error") {
    return "login.submit_phone.failed.network";
  }
  if (prev === "submitting_phone" && next === "rate_limited") {
    return "login.submit_phone.failed.rate_limited";
  }
  if ((prev === "awaiting_otp" || prev === "cooldown") && next === "verifying_otp") {
    return "login.verify_otp.attempted";
  }
  if (prev === "verifying_otp" && next === "success") {
    return "login.verify_otp.succeeded";
  }
  if (prev === "verifying_otp" && next === "wrong_otp") {
    return "login.verify_otp.failed.wrong";
  }
  if (prev === "verifying_otp" && next === "expired_otp") {
    return "login.verify_otp.failed.expired";
  }
  if (prev === "verifying_otp" && next === "network_error") {
    return "login.verify_otp.failed.network";
  }
  if (
    (prev === "awaiting_otp" || prev === "wrong_otp") &&
    next === "cooldown"
  ) {
    return "login.cooldown.entered";
  }
  return null;
}
