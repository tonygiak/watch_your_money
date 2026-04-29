/**
 * Bootstrap Jest config. Tests pure TS helpers (format, i18n).
 * Expo / React Native renderer wiring is a follow-up sprint.
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
};
