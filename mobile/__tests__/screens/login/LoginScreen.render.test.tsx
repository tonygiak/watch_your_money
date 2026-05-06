/**
 * Render-level smoke check for LoginScreen (BLG-0005 / DES-0002).
 *
 * Goals (kept narrow on purpose — full reducer behavior is in
 * `state.test.ts`):
 *   1. The phone stage renders Greek-first copy.
 *   2. The CTA is disabled until the phone normalizer accepts the input.
 *   3. Typing a valid Greek mobile enables the CTA.
 *
 * `@supabase/supabase-js` is mocked so this test never reaches a network.
 */

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import LoginScreen from "../../../src/screens/login/LoginScreen";
import { resetSupabaseClientForTests } from "../../../src/api/auth";
import { setLocale } from "../../../src/lib/i18n";

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithOtp: jest.fn(async () => ({ error: null })),
      verifyOtp: jest.fn(async () => ({
        data: { session: { access_token: "a", refresh_token: "r" } },
        error: null,
      })),
    },
  })),
}));

const SUPABASE = { url: "https://example.supabase.co", anonKey: "anon" };

beforeEach(() => {
  resetSupabaseClientForTests();
  setLocale("el");
});

describe("LoginScreen", () => {
  it("renders the Greek phone-entry stage on first mount", () => {
    const { getByLabelText, getByText } = render(
      <LoginScreen supabase={SUPABASE} onSuccess={() => {}} />
    );
    expect(getByLabelText("login-phone")).toBeTruthy();
    expect(getByText("Καλώς ήρθατε")).toBeTruthy();
  });

  it("disables the continue CTA until the phone normalizer accepts the input", () => {
    const { getByLabelText } = render(
      <LoginScreen supabase={SUPABASE} onSuccess={() => {}} />
    );
    const cta = getByLabelText("Συνέχεια");
    expect(cta.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true })
    );

    fireEvent.changeText(getByLabelText("Αριθμός κινητού"), "6912345678");
    expect(cta.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false })
    );
  });

  it("falls back to English copy when locale is set to en", () => {
    setLocale("en");
    const { getByText } = render(
      <LoginScreen supabase={SUPABASE} onSuccess={() => {}} />
    );
    expect(getByText("Welcome")).toBeTruthy();
  });
});
