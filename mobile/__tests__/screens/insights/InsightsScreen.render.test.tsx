/**
 * Render-level smoke check for InsightsScreen (BLG-0006 / DES-0003).
 *
 * Goals:
 *   1. Greek-first title + period tabs render.
 *   2. Offline state renders the offline banner per DES-0003 §3.4.
 *
 * The heavy reducer logic + `compareWindows` math live in `state.test.ts`.
 * This file proves the wiring compiles + renders under the jest-expo
 * preset. Network calls are short-circuited by mounting in offline mode.
 */

import React from "react";
import { render } from "@testing-library/react-native";

import InsightsScreen from "../../../src/screens/insights/InsightsScreen";
import { setLocale } from "../../../src/lib/i18n";

beforeEach(() => {
  setLocale("el");
});

describe("InsightsScreen", () => {
  it("renders the Greek title and period tabs", () => {
    const { getByText, getByLabelText } = render(
      <InsightsScreen
        bearerToken="t"
        backendUrl="http://localhost:9999"
        isOnline={false}
        onAuthError={() => {}}
        onScanPressed={() => {}}
      />
    );
    expect(getByText("Στατιστικά")).toBeTruthy();
    expect(getByLabelText("Εβδομάδα")).toBeTruthy();
    expect(getByLabelText("Μήνας")).toBeTruthy();
    expect(getByLabelText("Έτος")).toBeTruthy();
  });

  it("renders the offline banner when offline", () => {
    const { getByText } = render(
      <InsightsScreen
        bearerToken="t"
        backendUrl="http://localhost:9999"
        isOnline={false}
        onAuthError={() => {}}
        onScanPressed={() => {}}
      />
    );
    expect(getByText("Είστε εκτός σύνδεσης")).toBeTruthy();
  });
});
