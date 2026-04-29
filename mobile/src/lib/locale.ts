/**
 * Greek-first locale detection (ADR-0003 §5).
 *
 * Default order:
 *  - device locale `el-*`              → "el"
 *  - device locale `en-*`              → "en"
 *  - everything else (e.g. `de-DE`)    → "el"   (the app is Greek-first per §2.5)
 *
 * Pure function so it's testable without RN. The mobile app calls this with
 * the Expo `Localization.locale` value at boot.
 */

import type { Locale } from "../i18n/strings";

export function detectLocale(deviceLocale: string | null | undefined): Locale {
  if (typeof deviceLocale !== "string" || deviceLocale.length === 0) {
    return "el";
  }
  const normalized = deviceLocale.toLowerCase();
  if (normalized.startsWith("el")) return "el";
  if (normalized.startsWith("en")) return "en";
  return "el";
}
