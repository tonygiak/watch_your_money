/**
 * Login screen — wires Supabase native OTP onto the `loginReducer`.
 *
 * Behavior pinned by ADR-0004 + DES-0002. This file is a thin glue layer
 * around the reducer (`./state.ts`), the phone normalizer (`../../lib/phone`),
 * and the SDK helpers (`../../api/auth`). All complex logic stays in the
 * testable modules above; this screen owns the rendering surface only.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  getSupabaseClient,
  sendOtp,
  type SupabaseConfig,
  verifyOtp,
} from "../../api/auth";
import { t } from "../../lib/i18n";
import { isValidGrPhone, normalizeGrPhone } from "../../lib/phone";
import {
  initialLoginState,
  loginReducer,
  loginTelemetryEventFor,
} from "./state";

const RESEND_COOLDOWN_SECONDS = 30;

export type LoginScreenProps = {
  supabase: SupabaseConfig;
  onSuccess: (session: { accessToken: string; refreshToken: string }) => void;
  privacyPolicyUrl?: string;
};

export default function LoginScreen(props: LoginScreenProps): React.JSX.Element {
  const [state, dispatch] = useReducer(loginReducer, initialLoginState);
  const prevStatusRef = useRef(state.status);
  const supabase = useMemo(
    () => getSupabaseClient(props.supabase),
    [props.supabase]
  );

  // ---- Telemetry (counts only) ------------------------------------------
  useEffect(() => {
    const event = loginTelemetryEventFor(prevStatusRef.current, state.status);
    if (event) {
      // Hook your telemetry sink here. PII-free per DES-0002 §6.
      // e.g. telemetry.increment(event)
    }
    prevStatusRef.current = state.status;
  }, [state.status]);

  // ---- Phone submit -----------------------------------------------------
  useEffect(() => {
    if (state.status !== "submitting_phone") return;
    if (!state.phoneE164) return;
    let cancelled = false;
    void (async () => {
      const outcome = await sendOtp(supabase, state.phoneE164!);
      if (cancelled) return;
      if (outcome.kind === "ok") {
        dispatch({ type: "OTP_SENT" });
      } else if (outcome.kind === "rate_limited") {
        dispatch({
          type: "RATE_LIMITED",
          cooldownSeconds: outcome.retryAfterSeconds,
        });
      } else if (outcome.kind === "network") {
        dispatch({ type: "NETWORK_ERROR" });
      } else {
        dispatch({ type: "PHONE_INVALID" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, state.phoneE164, supabase]);

  // ---- OTP verify -------------------------------------------------------
  useEffect(() => {
    if (state.status !== "verifying_otp") return;
    if (!state.phoneE164) return;
    const code = state.otpInput;
    let cancelled = false;
    void (async () => {
      const outcome = await verifyOtp(supabase, state.phoneE164!, code);
      if (cancelled) return;
      if (outcome.kind === "ok") {
        dispatch({ type: "OTP_VERIFIED" });
        props.onSuccess({
          accessToken: outcome.accessToken,
          refreshToken: outcome.refreshToken,
        });
      } else if (outcome.kind === "wrong") {
        dispatch({ type: "OTP_WRONG" });
      } else if (outcome.kind === "expired") {
        dispatch({ type: "OTP_EXPIRED" });
      } else if (outcome.kind === "network") {
        dispatch({ type: "NETWORK_ERROR" });
      } else {
        dispatch({ type: "OTP_WRONG" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, state.phoneE164, state.otpInput, supabase, props]);

  // ---- Cooldown timer ---------------------------------------------------
  useEffect(() => {
    if (state.status !== "cooldown") return;
    if (state.cooldownSeconds <= 0) {
      dispatch({ type: "COOLDOWN_ENDED" });
      return;
    }
    const id = setTimeout(() => {
      dispatch({
        type: "COOLDOWN_TICK",
        remaining: state.cooldownSeconds - 1,
      });
    }, 1000);
    return () => clearTimeout(id);
  }, [state.status, state.cooldownSeconds]);

  // ---- Handlers ---------------------------------------------------------
  const onPhoneTyped = useCallback((value: string) => {
    dispatch({ type: "PHONE_TYPED", value });
  }, []);

  const onSubmitPhone = useCallback(() => {
    const normalized = normalizeGrPhone(state.phoneInput);
    if (!normalized) return;
    dispatch({ type: "SUBMIT_PHONE", e164: normalized.e164 });
  }, [state.phoneInput]);

  const onOtpTyped = useCallback((value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 6);
    dispatch({ type: "OTP_TYPED", value: sanitized });
  }, []);

  const onSubmitOtp = useCallback(() => {
    dispatch({ type: "SUBMIT_OTP" });
  }, []);

  const onResend = useCallback(() => {
    dispatch({
      type: "RESEND_REQUESTED",
      cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    });
    if (state.phoneE164) {
      void sendOtp(supabase, state.phoneE164);
    }
  }, [supabase, state.phoneE164]);

  const onBack = useCallback(() => {
    dispatch({ type: "BACK_TO_PHONE" });
  }, []);

  const onPrivacyTap = useCallback(() => {
    if (props.privacyPolicyUrl) Linking.openURL(props.privacyPolicyUrl);
  }, [props.privacyPolicyUrl]);

  // ---- Render -----------------------------------------------------------
  const showOtpStage =
    state.status === "awaiting_otp" ||
    state.status === "verifying_otp" ||
    state.status === "wrong_otp" ||
    state.status === "cooldown" ||
    state.status === "expired_otp";

  if (showOtpStage && state.phoneE164) {
    return (
      <View style={styles.root} accessibilityLabel="login-otp">
        <Text style={styles.title}>{t("login.otp_title")}</Text>
        <Text style={styles.subtitle}>
          {t("login.otp_subtitle").replace("{phone}", state.phoneE164)}
        </Text>
        <Text style={styles.fieldLabel}>{t("login.otp_label")}</Text>
        <TextInput
          accessibilityLabel={t("login.otp_label")}
          style={styles.input}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={6}
          value={state.otpInput}
          onChangeText={onOtpTyped}
          editable={state.status !== "verifying_otp"}
        />
        {state.errorCode === "wrong_otp" && (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {t("login.error_wrong_otp")}
          </Text>
        )}
        {state.errorCode === "expired_otp" && (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {t("login.error_expired_otp")}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("login.verify_cta")}
          accessibilityState={{ disabled: state.otpInput.length !== 6 }}
          style={[
            styles.cta,
            state.otpInput.length !== 6 && styles.ctaDisabled,
          ]}
          disabled={state.otpInput.length !== 6}
          onPress={onSubmitOtp}
        >
          {state.status === "verifying_otp" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>{t("login.verify_cta")}</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.secondaryCta}
          disabled={state.status === "cooldown"}
          onPress={onResend}
        >
          <Text style={styles.secondaryText}>
            {state.status === "cooldown"
              ? t("login.resend_cooldown").replace(
                  "{seconds}",
                  String(state.cooldownSeconds)
                )
              : t("login.resend_cta")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.secondaryCta}
          onPress={onBack}
        >
          <Text style={styles.secondaryText}>{t("login.back_cta")}</Text>
        </Pressable>
      </View>
    );
  }

  const phoneValid = isValidGrPhone(state.phoneInput);
  return (
    <View style={styles.root} accessibilityLabel="login-phone">
      <Text style={styles.title}>{t("login.title")}</Text>
      <Text style={styles.subtitle}>{t("login.subtitle")}</Text>
      <Text style={styles.fieldLabel}>{t("login.phone_label")}</Text>
      <Text style={styles.hint}>{t("login.country_code_hint")}</Text>
      <TextInput
        accessibilityLabel={t("login.phone_label")}
        style={styles.input}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder={t("login.phone_placeholder")}
        value={state.phoneInput}
        onChangeText={onPhoneTyped}
        editable={state.status !== "submitting_phone"}
      />
      <Text style={styles.smallNote}>
        {t("login.privacy_sms_provider")}
      </Text>
      {state.errorCode === "invalid_phone" && (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {t("login.error_invalid_phone")}
        </Text>
      )}
      {state.errorCode === "network" && (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {t("login.error_network")}
        </Text>
      )}
      {state.errorCode === "rate_limited" && (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {t("login.error_rate_limited")}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("login.continue_cta")}
        accessibilityState={{ disabled: !phoneValid }}
        style={[styles.cta, !phoneValid && styles.ctaDisabled]}
        disabled={!phoneValid}
        onPress={onSubmitPhone}
      >
        {state.status === "submitting_phone" ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText}>{t("login.continue_cta")}</Text>
        )}
      </Pressable>
      <View style={styles.privacyRow}>
        <Text style={styles.smallNote}>{t("login.privacy_short")}</Text>
        {props.privacyPolicyUrl && (
          <Pressable accessibilityRole="link" onPress={onPrivacyTap}>
            <Text style={styles.privacyLink}>{t("login.privacy_link")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#444", marginBottom: 24 },
  fieldLabel: { fontSize: 14, color: "#444", marginBottom: 4 },
  hint: { fontSize: 12, color: "#888", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    minHeight: 48,
  },
  smallNote: { fontSize: 12, color: "#888", marginTop: 8 },
  errorText: { fontSize: 14, color: "#c00", marginTop: 8 },
  cta: {
    backgroundColor: "#0066cc",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
    minHeight: 48,
    justifyContent: "center",
  },
  ctaDisabled: { backgroundColor: "#aac9e6" },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  secondaryCta: { paddingVertical: 14, alignItems: "center", marginTop: 8, minHeight: 44 },
  secondaryText: { color: "#0066cc", fontSize: 15 },
  privacyRow: { flexDirection: "row", marginTop: 16, alignItems: "center", gap: 4 },
  privacyLink: { color: "#0066cc", fontSize: 12, textDecorationLine: "underline" },
});
