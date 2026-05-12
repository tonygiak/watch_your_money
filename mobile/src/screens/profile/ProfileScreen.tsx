/**
 * Profile screen (DES-0004 / BLG-0017).
 *
 * Renders the four sections of the profile page (identity, freelancer,
 * ΑΦΜ, sign-out) on top of the `profileReducer` from `./state`. Export
 * PDF (DES-0004 §3.4) is wired in BLG-0019; this file leaves a
 * disabled-with-help placeholder so the section is reachable in render
 * tests today.
 *
 * Side-effects (`PATCH /users/me`, sign-out, cache key rotation,
 * navigation on `auth_error`) live here. The reducer is pure and tested
 * separately.
 */

import React, { useCallback, useEffect, useReducer } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { exportBusinessExpenses } from "../../api/exports";
import { patchMe } from "../../api/users";
import { rotateCacheKeyOnSignOut } from "../../cache/rotate";
import { t } from "../../lib/i18n";
import { defaultShareImpl } from "../../lib/share";
import DateField from "./DateField";
import {
  AFM_MAX_INPUT_LEN,
  initialProfileState,
  maskPhone,
  profileReducer,
} from "./state";

export type ProfileScreenProps = {
  userId: string;
  phone: string | null;
  lastSignInAt: string | null;
  initialIsFreelancer: boolean;
  initialAfm: string | null;

  bearerToken: string;
  backendUrl: string;

  /** Called on `signOut` completion or `auth_error` — host navigates to Login. */
  onSignOut: () => void;
  /** Plug-in for `supabase.auth.signOut()`. Default = no-op for tests. */
  signOutImpl?: () => Promise<void>;

  /** Plug-in for the share sheet. Receives the base64 PDF bytes + the
   *  suggested filename. When omitted, the screen falls back to
   *  `defaultShareImpl` from ``mobile/src/lib/share.ts``, which composes
   *  ``expo-file-system.writeAsStringAsync`` + ``expo-sharing.shareAsync``
   *  (BLG-0020). Tests inject a fake to keep the native deps off the test
   *  path. */
  shareImpl?: (args: {
    base64: string;
    filename: string;
  }) => Promise<void>;

  /** Disabled = `isOffline` per ADR-0006 §7 / DES-0004 §8.1. */
  isOffline?: boolean;
};

export default function ProfileScreen(props: ProfileScreenProps): React.JSX.Element {
  const [state, dispatch] = useReducer(
    profileReducer,
    {
      userId: props.userId,
      phone: props.phone,
      lastSignInAt: props.lastSignInAt,
      isFreelancer: props.initialIsFreelancer,
      afm: props.initialAfm,
    },
    initialProfileState
  );

  // ---- Effect: PATCH on freelancer toggle ------------------------------
  useEffect(() => {
    if (state.status !== "editing_freelancer") return;
    if (state.pendingFreelancer === null) return;
    let cancelled = false;
    const target = state.pendingFreelancer;
    void (async () => {
      const result = await patchMe({
        isFreelancer: target,
        bearerToken: props.bearerToken,
        backendUrl: props.backendUrl,
      });
      if (cancelled) return;
      if (result.kind === "ok") {
        dispatch({
          type: "FREELANCER_PATCH_OK",
          isFreelancer: result.user.is_freelancer,
          afm: result.user.afm,
        });
      } else if (result.status === 401) {
        dispatch({ type: "AUTH_ERROR" });
        props.onSignOut();
      } else {
        dispatch({ type: "FREELANCER_PATCH_NETWORK_ERROR" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, state.pendingFreelancer, props]);

  // ---- Effect: PATCH on AFM save ---------------------------------------
  useEffect(() => {
    if (state.status !== "editing_afm") return;
    let cancelled = false;
    const candidate = state.afmInput.trim();
    void (async () => {
      const result = await patchMe({
        afm: candidate,
        bearerToken: props.bearerToken,
        backendUrl: props.backendUrl,
      });
      if (cancelled) return;
      if (result.kind === "ok") {
        dispatch({ type: "AFM_PATCH_OK", afm: result.user.afm });
      } else if (result.status === 401) {
        dispatch({ type: "AUTH_ERROR" });
        props.onSignOut();
      } else if (result.status === 422) {
        dispatch({
          type: "AFM_PATCH_VALIDATION_ERROR",
          messageKey: "profile.afm.invalid",
        });
      } else {
        dispatch({ type: "AFM_PATCH_NETWORK_ERROR" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, state.afmInput, props]);

  // ---- Effect: GET /export/business-expenses --------------------------
  useEffect(() => {
    if (state.status !== "exporting") return;
    let cancelled = false;
    void (async () => {
      const result = await exportBusinessExpenses({
        fromDate: state.exportFromDate,
        toDate: state.exportToDate,
        bearerToken: props.bearerToken,
        backendUrl: props.backendUrl,
      });
      if (cancelled) return;
      if (result.kind === "ok") {
        const shareFn = props.shareImpl ?? defaultShareImpl;
        try {
          await shareFn({
            base64: result.base64,
            filename: result.filename,
          });
        } catch {
          // Share dismissal / failure isn't a hard error — the export
          // succeeded server-side.
        }
        if (!cancelled) dispatch({ type: "EXPORT_DONE" });
      } else if (result.status === 401) {
        dispatch({ type: "AUTH_ERROR" });
        props.onSignOut();
      } else if (result.status === 422) {
        dispatch({
          type: "EXPORT_VALIDATION_ERROR",
          field: "to_date",
          messageKey: "profile.export.range_invalid",
        });
      } else {
        dispatch({ type: "EXPORT_NETWORK_ERROR" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, state.exportFromDate, state.exportToDate, props]);

  // ---- Effect: sign-out (cache key rotation + supabase.auth.signOut) ---
  useEffect(() => {
    if (state.status !== "signing_out") return;
    let cancelled = false;
    void (async () => {
      // Per DES-0004 §3.5: rotate the encryption key BEFORE we call sign-out
      // so a crash mid-flow still leaves the next user with a fresh key.
      try {
        await rotateCacheKeyOnSignOut();
      } catch {
        // Best-effort: swallow so the user still signs out (the auth-side
        // is the security primitive — Supabase revokes the JWT regardless
        // of whether we successfully wiped the cache).
      }
      try {
        if (props.signOutImpl) {
          await props.signOutImpl();
        }
      } catch {
        // Same — ignore so the navigator advances to Login anyway.
      }
      if (!cancelled) props.onSignOut();
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, props]);

  // ---- Handlers --------------------------------------------------------
  const onFreelancerToggle = useCallback(() => {
    if (props.isOffline) return;
    dispatch({ type: "FREELANCER_TOGGLE_TAPPED" });
  }, [props.isOffline]);

  const onAfmChanged = useCallback((value: string) => {
    dispatch({ type: "AFM_INPUT_CHANGED", value });
  }, []);

  const onAfmSave = useCallback(() => {
    if (props.isOffline) return;
    dispatch({ type: "AFM_SAVE_TAPPED" });
  }, [props.isOffline]);

  const onExportFromChanged = useCallback((value: string) => {
    dispatch({ type: "EXPORT_FROM_CHANGED", value });
  }, []);

  const onExportToChanged = useCallback((value: string) => {
    dispatch({ type: "EXPORT_TO_CHANGED", value });
  }, []);

  const onExportPressed = useCallback(() => {
    if (props.isOffline) return;
    dispatch({ type: "EXPORT_GENERATE_TAPPED" });
  }, [props.isOffline]);

  const onSignOutPressed = useCallback(() => {
    dispatch({ type: "SIGN_OUT_TAPPED" });
  }, []);

  // ---- Render ----------------------------------------------------------
  const isFreelancerVisible =
    state.pendingFreelancer ?? state.isFreelancer;
  const freelancerSaving = state.status === "editing_freelancer";
  const afmSaving = state.status === "editing_afm";
  const signingOut = state.status === "signing_out";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      accessibilityLabel="profile"
    >
      <Text style={styles.screenTitle}>{t("profile.title")}</Text>

      {/* §3.1 Account */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t("profile.section.account")}</Text>
        <Text style={styles.bodyText}>
          {t("profile.account.phone_label")}: {maskPhone(state.phone)}
        </Text>
        {state.lastSignInAt && (
          <Text style={styles.subText}>
            {t("profile.account.last_signin").replace(
              "{datetime}",
              state.lastSignInAt
            )}
          </Text>
        )}
      </View>

      {/* §3.2 Freelancer */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>
          {t("profile.section.freelancer")}
        </Text>
        <View style={styles.toggleRow}>
          <Switch
            accessibilityRole="switch"
            accessibilityLabel={t("profile.freelancer.toggle_label")}
            accessibilityState={{
              checked: isFreelancerVisible,
              disabled: !!props.isOffline || freelancerSaving,
            }}
            value={isFreelancerVisible}
            disabled={!!props.isOffline || freelancerSaving}
            onValueChange={onFreelancerToggle}
          />
          <Text style={styles.toggleLabel}>
            {t("profile.freelancer.toggle_label")}
          </Text>
          {freelancerSaving && <ActivityIndicator style={styles.spinner} />}
        </View>
        <Text style={styles.helpText}>{t("profile.freelancer.help")}</Text>
        {state.networkError?.surface === "freelancer" && (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {t(state.networkError.messageKey)}
          </Text>
        )}
      </View>

      {/* §3.3 ΑΦΜ */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t("profile.section.afm")}</Text>
        <TextInput
          accessibilityLabel="ΑΦΜ"
          accessibilityHint="Εννέα ψηφία"
          style={[
            styles.input,
            state.validationError?.field === "afm" && styles.inputError,
          ]}
          placeholder={t("profile.afm.placeholder")}
          value={state.afmInput}
          onChangeText={onAfmChanged}
          maxLength={AFM_MAX_INPUT_LEN}
          keyboardType="number-pad"
          editable={!props.isOffline && state.isFreelancer && !afmSaving}
        />
        {state.validationError?.field === "afm" && (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {t(state.validationError.messageKey)}
          </Text>
        )}
        {state.networkError?.surface === "afm" && (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {t(state.networkError.messageKey)}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("profile.afm.save")}
          accessibilityState={{
            disabled:
              !!props.isOffline || !state.isFreelancer || afmSaving,
          }}
          style={[
            styles.cta,
            (!!props.isOffline || !state.isFreelancer || afmSaving) &&
              styles.ctaDisabled,
          ]}
          disabled={!!props.isOffline || !state.isFreelancer || afmSaving}
          onPress={onAfmSave}
        >
          {afmSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>{t("profile.afm.save")}</Text>
          )}
        </Pressable>
      </View>

      {/* §3.4 Export */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t("profile.section.export")}</Text>
        <Text style={styles.bodyText}>{t("profile.export.title")}</Text>
        <Text style={styles.helpText}>
          {state.isFreelancer
            ? t("profile.export.help")
            : t("profile.export.disabled_no_freelancer")}
        </Text>

        {state.isFreelancer && (
          <>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>
                  {t("profile.export.from_label")}
                </Text>
                <DateField
                  value={state.exportFromDate}
                  onChange={onExportFromChanged}
                  accessibilityLabel={t("profile.export.from_label")}
                  editable={
                    !props.isOffline && state.status !== "exporting"
                  }
                  errorMessage={
                    state.validationError?.field === "from_date"
                      ? t(state.validationError.messageKey)
                      : undefined
                  }
                />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>
                  {t("profile.export.to_label")}
                </Text>
                <DateField
                  value={state.exportToDate}
                  onChange={onExportToChanged}
                  accessibilityLabel={t("profile.export.to_label")}
                  editable={
                    !props.isOffline && state.status !== "exporting"
                  }
                  errorMessage={
                    state.validationError?.field === "to_date"
                      ? t(state.validationError.messageKey)
                      : undefined
                  }
                />
              </View>
            </View>

            {state.validationError &&
              (state.validationError.field === "from_date" ||
                state.validationError.field === "to_date") && (
                <Text
                  style={styles.errorText}
                  accessibilityLiveRegion="polite"
                >
                  {t(state.validationError.messageKey)}
                </Text>
              )}
            {state.networkError?.surface === "export" && (
              <Text style={styles.errorText} accessibilityLiveRegion="polite">
                {t(state.networkError.messageKey)}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.export.cta")}
              accessibilityState={{
                disabled:
                  !!props.isOffline || state.status === "exporting",
              }}
              style={[
                styles.cta,
                (!!props.isOffline || state.status === "exporting") &&
                  styles.ctaDisabled,
              ]}
              onPress={onExportPressed}
              disabled={!!props.isOffline || state.status === "exporting"}
            >
              {state.status === "exporting" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>
                  {t("profile.export.cta")}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      {/* §3.5 Sign out */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("profile.signout.cta")}
        accessibilityHint="Θα σας μεταφέρει στην οθόνη εισόδου"
        style={[styles.signOutCta, signingOut && styles.ctaDisabled]}
        onPress={onSignOutPressed}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator color="#c00" />
        ) : (
          <Text style={styles.signOutText}>{t("profile.signout.cta")}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  screenTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
    marginBottom: 16,
  },
  section: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  bodyText: { fontSize: 16, color: "#222" },
  subText: { fontSize: 13, color: "#555", marginTop: 4 },
  helpText: { fontSize: 13, color: "#666", marginTop: 8 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    gap: 12,
  },
  toggleLabel: { fontSize: 16, color: "#222", flex: 1 },
  spinner: { marginLeft: 8 },
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
  inputError: { borderColor: "#c00" },
  errorText: { fontSize: 13, color: "#c00", marginTop: 4 },
  cta: {
    backgroundColor: "#0066cc",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    marginTop: 12,
  },
  ctaDisabled: { backgroundColor: "#aac9e6" },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  signOutCta: {
    marginTop: 32,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#c00",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  signOutText: { color: "#c00", fontSize: 16, fontWeight: "600" },
  dateRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  dateField: { flex: 1 },
  dateLabel: { fontSize: 12, color: "#666", marginBottom: 4 },
});
