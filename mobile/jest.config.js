/**
 * Jest config — `jest-expo` preset for Expo SDK 51 (ADR-0007 §5).
 *
 * Two project layouts are merged:
 *
 *  1. **Pure-TS suite** (node environment) — runs the existing 122 reducer /
 *     parser / cache / locale / i18n tests. They have no React-Native /
 *     Expo imports and don't need the jest-expo preset's transforms.
 *
 *  2. **React-Native suite** (jest-expo) — runs render tests for the
 *     screens. Added in S-004 alongside `LoginScreen.tsx`,
 *     `InsightsScreen.tsx`, and `ScannerScreen.tsx` as a smoke check on
 *     the wiring.
 */
module.exports = {
  projects: [
    {
      displayName: "ts",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/__tests__/lib/**/*.test.ts",
        "<rootDir>/__tests__/parsers/**/*.test.ts",
        "<rootDir>/__tests__/cache/**/*.test.ts",
        "<rootDir>/__tests__/screens/scanner/state.test.ts",
        "<rootDir>/__tests__/screens/login/state.test.ts",
        "<rootDir>/__tests__/screens/insights/state.test.ts",
      ],
      moduleFileExtensions: ["ts", "js"],
    },
    {
      displayName: "rn",
      preset: "jest-expo",
      testMatch: ["<rootDir>/__tests__/screens/**/*.render.test.tsx"],
      transformIgnorePatterns: [
        "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@noble/.+|@react-native-async-storage|@react-native-community/netinfo|@supabase/.*))",
      ],
    },
  ],
};
