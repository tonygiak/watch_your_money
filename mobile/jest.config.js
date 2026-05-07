/**
 * Jest config — `jest-expo` preset for Expo SDK 54 (ADR-0012 §9; supersedes
 * the SDK 51 layout from ADR-0007 §5).
 *
 * Two project layouts are merged:
 *
 *  1. **Pure-TS suite** (node environment) — runs the reducer / parser /
 *     cache / locale / i18n / encryption-roundtrip tests. They have no
 *     React-Native / Expo imports and don't need the jest-expo preset's
 *     transforms.
 *
 *  2. **React-Native suite** (jest-expo) — runs render tests for the
 *     screens. The transform allowlist is extended in S-007 to cover the
 *     SDK 54 expected matrix additions: `expo-sharing`, `expo-file-system`
 *     (BLG-0020) and `@react-native-community/datetimepicker` (BLG-0021).
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
        "<rootDir>/__tests__/screens/receipt/tag.state.test.ts",
        "<rootDir>/__tests__/screens/profile/state.test.ts",
      ],
      moduleFileExtensions: ["ts", "js"],
    },
    {
      displayName: "rn",
      preset: "jest-expo",
      testMatch: ["<rootDir>/__tests__/screens/**/*.render.test.tsx"],
      transformIgnorePatterns: [
        "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@noble/.+|@react-native-async-storage|@react-native-community/netinfo|@react-native-community/datetimepicker|@supabase/.*))",
      ],
    },
  ],
};
