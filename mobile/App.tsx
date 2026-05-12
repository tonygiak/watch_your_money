/**
 * Root component — wires together authentication, tab navigation, and all
 * screens per AGENTS.md §5.5.2.
 *
 * Navigation is implemented as a React state machine (no `@react-navigation/
 * bottom-tabs` dep required) so the bundle stays lean.  The NavigationContainer
 * from `@react-navigation/native` is still included to activate
 * `react-native-screens` and `react-native-safe-area-context` correctly.
 *
 * Environment config is read from `EXPO_PUBLIC_*` vars (SDK 54 standard)
 * which are inlined by Metro at bundle time from `.env`.
 */

import { NavigationContainer } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";

import { getSupabaseClient } from "./src/api/auth";
import { getReceiptById } from "./src/api/receipts";
import type { CacheableReceipt } from "./src/cache/types";
import { t } from "./src/lib/i18n";
import HomeScreen from "./src/screens/HomeScreen";
import InsightsScreen from "./src/screens/insights/InsightsScreen";
import LoginScreen from "./src/screens/login/LoginScreen";
import ProfileScreen from "./src/screens/profile/ProfileScreen";
import ReceiptDetailScreen from "./src/screens/receipt/ReceiptDetailScreen";
import ScannerScreen from "./src/screens/ScannerScreen";

// ---------------------------------------------------------------------------
// Config — EXPO_PUBLIC_ vars are inlined by Metro at bundle time (SDK 54).
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_API_URL ?? "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tab = "home" | "scanner" | "insights" | "profile";

type Session = {
  accessToken: string;
  userId: string;
  phone: string | null;
  isFreelancer: boolean;
  afm: string | null;
  lastSignInAt: string | null;
};

type AppState = "loading" | "unauthenticated" | "authenticated";

// ---------------------------------------------------------------------------
// TabButton helper
// ---------------------------------------------------------------------------
function TabButton(props: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ selected: props.active }}
      style={[styles.tabButton, props.active && styles.tabButtonActive]}
      onPress={props.onPress}
    >
      <Text
        style={[styles.tabLabel, props.active && styles.tabLabelActive]}
        numberOfLines={1}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App(): React.JSX.Element {
  const [appState, setAppState] = useState<AppState>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [detailReceipt, setDetailReceipt] = useState<CacheableReceipt | null>(
    null
  );
  const [isFetchingReceipt, setIsFetchingReceipt] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const supabaseConfig = useRef({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });

  // ---- Network listener ---------------------------------------------------
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false);
    });
    return unsub;
  }, []);

  // ---- Session restore + auth state listener ------------------------------
  useEffect(() => {
    const supabase = getSupabaseClient(supabaseConfig.current);

    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (s) {
        setSession({
          accessToken: s.access_token,
          userId: s.user.id,
          phone: s.user.phone ?? null,
          isFreelancer: false,
          afm: null,
          lastSignInAt: s.user.last_sign_in_at ?? null,
        });
        setAppState("authenticated");
      } else {
        setAppState("unauthenticated");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) {
        setSession((prev) => ({
          accessToken: s.access_token,
          userId: s.user.id,
          phone: s.user.phone ?? null,
          isFreelancer: prev?.isFreelancer ?? false,
          afm: prev?.afm ?? null,
          lastSignInAt: s.user.last_sign_in_at ?? null,
        }));
        setAppState("authenticated");
      } else {
        setSession(null);
        setDetailReceipt(null);
        setActiveTab("home");
        setAppState("unauthenticated");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ---- Handlers -----------------------------------------------------------
  const handleSignOut = useCallback(() => {
    setSession(null);
    setDetailReceipt(null);
    setActiveTab("home");
    setAppState("unauthenticated");
  }, []);

  const handleScanSuccess = useCallback(
    async (receiptId: string) => {
      if (!session) return;
      setActiveTab("home");
      setIsFetchingReceipt(true);
      const result = await getReceiptById({
        receiptId,
        bearerToken: session.accessToken,
        backendUrl: BACKEND_URL,
      });
      setIsFetchingReceipt(false);
      if (result.kind === "ok") {
        setDetailReceipt(result.receipt);
      }
    },
    [session]
  );

  const handleAuthError = useCallback(() => {
    setSession(null);
    setDetailReceipt(null);
    setActiveTab("home");
    setAppState("unauthenticated");
  }, []);

  /**
   * Silent session refresh (BLG-0024 / ADR-0015 §8). The scanner (and any
   * other screen that hits the backend) calls this on a recoverable 401,
   * before falling through to `handleAuthError`. Returns `true` when a
   * fresh access token is available; otherwise `false` and the caller is
   * expected to sign the user out.
   *
   * Token / refresh-token / phone never logged
   * (agent-runtime-security.md §3 + ADR-0004 §5 + ADR-0016).
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    const supabase = getSupabaseClient(supabaseConfig.current);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) return false;
      setSession((prev) => ({
        accessToken: data.session!.access_token,
        userId: data.session!.user.id,
        phone: data.session!.user.phone ?? null,
        isFreelancer: prev?.isFreelancer ?? false,
        afm: prev?.afm ?? null,
        lastSignInAt:
          data.session!.user.last_sign_in_at ?? prev?.lastSignInAt ?? null,
      }));
      return true;
    } catch {
      return false;
    }
  }, []);

  // ---- Loading ------------------------------------------------------------
  if (appState === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  // ---- Not authenticated --------------------------------------------------
  if (appState === "unauthenticated" || !session) {
    return (
      <NavigationContainer>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          <LoginScreen
            supabase={supabaseConfig.current}
            onSuccess={() => {
              // onAuthStateChange sets the session; nothing more needed here.
            }}
          />
        </SafeAreaView>
      </NavigationContainer>
    );
  }

  // ---- Fetching receipt after scan ----------------------------------------
  if (isFetchingReceipt) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>{t("common.loading")}</Text>
      </View>
    );
  }

  // ---- Receipt detail overlay (shown after successful scan or list tap) ---
  if (detailReceipt) {
    return (
      <NavigationContainer>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          <View style={styles.navBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              style={styles.backButton}
              onPress={() => setDetailReceipt(null)}
            >
              <Text style={styles.backText}>{"← " + t("home.title")}</Text>
            </Pressable>
          </View>
          <ReceiptDetailScreen
            receipt={detailReceipt}
            bearerToken={session.accessToken}
            backendUrl={BACKEND_URL}
            onAuthError={handleAuthError}
            isOffline={!isOnline}
          />
        </SafeAreaView>
      </NavigationContainer>
    );
  }

  // ---- Scanner tab: fullscreen, no bottom bar ----------------------------
  if (activeTab === "scanner") {
    return (
      <NavigationContainer>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <ScannerScreen
            bearerToken={session.accessToken}
            backendUrl={BACKEND_URL}
            onSuccess={(id) => void handleScanSuccess(id)}
            onAuthError={handleAuthError}
            refreshSession={refreshSession}
            onClose={() => setActiveTab("home")}
          />
        </SafeAreaView>
      </NavigationContainer>
    );
  }

  // ---- Main tabs with bottom bar -----------------------------------------
  return (
    <NavigationContainer>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        <View style={styles.content}>
          {activeTab === "home" && <HomeScreen />}

          {activeTab === "insights" && (
            <InsightsScreen
              bearerToken={session.accessToken}
              backendUrl={BACKEND_URL}
              isOnline={isOnline}
              onAuthError={handleAuthError}
              onScanPressed={() => setActiveTab("scanner")}
            />
          )}

          {activeTab === "profile" && (
            <ProfileScreen
              userId={session.userId}
              phone={session.phone}
              lastSignInAt={session.lastSignInAt}
              initialIsFreelancer={session.isFreelancer}
              initialAfm={session.afm}
              bearerToken={session.accessToken}
              backendUrl={BACKEND_URL}
              onSignOut={handleSignOut}
              signOutImpl={async () => {
                const supabase = getSupabaseClient(supabaseConfig.current);
                await supabase.auth.signOut();
              }}
              isOffline={!isOnline}
            />
          )}
        </View>

        <View style={styles.tabBar} accessibilityRole="tablist">
          <TabButton
            label={t("home.title")}
            active={activeTab === "home"}
            onPress={() => setActiveTab("home")}
            accessibilityLabel={t("home.title")}
          />
          <TabButton
            label={t("scanner.cta")}
            active={activeTab === "scanner"}
            onPress={() => setActiveTab("scanner")}
            accessibilityLabel={t("scanner.cta")}
          />
          <TabButton
            label={t("insights.title")}
            active={activeTab === "insights"}
            onPress={() => setActiveTab("insights")}
            accessibilityLabel={t("insights.title")}
          />
          <TabButton
            label={t("profile.title")}
            active={activeTab === "profile"}
            onPress={() => setActiveTab("profile")}
            accessibilityLabel={t("profile.title")}
          />
        </View>
      </SafeAreaView>
    </NavigationContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#666",
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    backgroundColor: "#fff",
    paddingBottom: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  tabButtonActive: {
    borderTopWidth: 2,
    borderTopColor: "#0066cc",
  },
  tabLabel: {
    fontSize: 11,
    color: "#888",
    textAlign: "center",
  },
  tabLabelActive: {
    color: "#0066cc",
    fontWeight: "600",
  },
  navBar: {
    height: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  backButton: {
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  backText: {
    fontSize: 15,
    color: "#0066cc",
  },
});
