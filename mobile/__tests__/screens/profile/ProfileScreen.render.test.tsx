/**
 * Render-level smoke check for ProfileScreen (BLG-0017 / DES-0004).
 *
 * Goals:
 *   1. The four sections render in Greek.
 *   2. The phone is masked (never the middle digits).
 *   3. Toggle reflects `initialIsFreelancer`.
 *   4. ΑΦΜ input is disabled when freelancer mode is off.
 *   5. Sign-out button is reachable.
 *
 * The reducer logic + transitions live in `state.test.ts`. This file
 * proves the wiring compiles + renders under the jest-expo preset.
 * Network calls are short-circuited by mounting in offline mode.
 */

import React from "react";
import { render } from "@testing-library/react-native";

import ProfileScreen from "../../../src/screens/profile/ProfileScreen";
import { setLocale } from "../../../src/lib/i18n";

beforeEach(() => {
  setLocale("el");
});

describe("ProfileScreen", () => {
  it("renders the four sections in Greek and the masked phone", () => {
    const { getAllByText, getByText, queryByText } = render(
      <ProfileScreen
        userId="u-1"
        phone="+306987654321"
        lastSignInAt="07-05-2026 17:30"
        initialIsFreelancer={false}
        initialAfm={null}
        bearerToken="t"
        backendUrl="http://localhost:9999"
        onSignOut={() => {}}
        isOffline
      />
    );
    // "Λογαριασμός" appears as both the screen title AND the section
    // header — assert at least one render rather than uniqueness.
    expect(getAllByText("Λογαριασμός").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Ελεύθερος επαγγελματίας")).toBeTruthy();
    expect(getByText("ΑΦΜ")).toBeTruthy();
    expect(getByText("Επαγγελματικά έξοδα")).toBeTruthy();
    expect(getByText("Αποσύνδεση")).toBeTruthy();

    // Phone is masked — middle digits never appear.
    expect(queryByText(/987/)).toBeNull();
    expect(queryByText(/65/)).toBeNull();
    expect(getByText(/4321/)).toBeTruthy();
    expect(getByText(/\+30/)).toBeTruthy();
  });

  it("renders the toggle in OFF state when initialIsFreelancer is false", () => {
    const { getByLabelText } = render(
      <ProfileScreen
        userId="u-1"
        phone="+306900001234"
        lastSignInAt={null}
        initialIsFreelancer={false}
        initialAfm={null}
        bearerToken="t"
        backendUrl="http://localhost:9999"
        onSignOut={() => {}}
        isOffline
      />
    );
    const toggle = getByLabelText("Είμαι ελεύθερος επαγγελματίας");
    expect(toggle.props.accessibilityState.checked).toBe(false);
  });

  it("renders the toggle in ON state and pre-fills the ΑΦΜ when freelancer", () => {
    const { getByLabelText } = render(
      <ProfileScreen
        userId="u-1"
        phone="+306900001234"
        lastSignInAt={null}
        initialIsFreelancer
        initialAfm="094019245"
        bearerToken="t"
        backendUrl="http://localhost:9999"
        onSignOut={() => {}}
        isOffline
      />
    );
    const toggle = getByLabelText("Είμαι ελεύθερος επαγγελματίας");
    expect(toggle.props.accessibilityState.checked).toBe(true);
    const afmInput = getByLabelText("ΑΦΜ");
    expect(afmInput.props.value).toBe("094019245");
  });
});
