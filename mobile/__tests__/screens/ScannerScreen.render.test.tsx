/**
 * Render-level smoke check for ScannerScreen (BLG-0012 closing the gate
 * carve-out). The full reducer transition table lives in
 * `__tests__/screens/scanner/state.test.ts`; this file just proves the
 * Expo runtime tree is wired up and the screen mounts under the jest-expo
 * preset.
 *
 * `expo-camera` is mocked because tests run in a jsdom-like environment
 * with no native module bridge.
 */

import React from "react";
import { render } from "@testing-library/react-native";

import ScannerScreen from "../../src/screens/ScannerScreen";
import { setLocale } from "../../src/lib/i18n";

jest.mock("expo-camera", () => {
  const React = require("react");
  return {
    CameraView: (props: { style?: unknown }) =>
      React.createElement("CameraView", props),
    useCameraPermissions: () => [
      { granted: true, canAskAgain: true, status: "granted" },
      jest.fn(async () => ({
        granted: true,
        canAskAgain: true,
        status: "granted",
      })),
    ],
  };
});

beforeEach(() => {
  setLocale("el");
});

describe("ScannerScreen", () => {
  it("mounts with the Greek scanning header when permission is granted", () => {
    const { getByText } = render(
      <ScannerScreen
        bearerToken="t"
        backendUrl="http://localhost:9999"
        onSuccess={() => {}}
        onAuthError={() => {}}
        onClose={() => {}}
      />
    );
    expect(getByText("Στοχεύστε στο QR του παραστατικού")).toBeTruthy();
  });
});
