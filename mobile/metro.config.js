/**
 * Metro bundler config (Expo SDK 54).
 *
 * `unstable_enablePackageExports` is enabled by default in SDK 54, which
 * causes Metro to use the `exports` field over the `react-native` field
 * during module resolution. `@supabase/supabase-js` does not declare a
 * `react-native` condition in its `exports`, so the resolver falls back to
 * the Node entry, which imports `ws` → `stream` (a Node stdlib module that
 * is not available in the React Native runtime).
 *
 * Disabling package exports restores the prior behavior: Metro consults the
 * `react-native` package.json field, which `@supabase/supabase-js` declares,
 * and resolves to a build that does not depend on `ws` / `stream`.
 *
 * This is the documented workaround from Supabase + Expo until upstream
 * adds the missing `react-native` export condition.
 */
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = false;

module.exports = config;
