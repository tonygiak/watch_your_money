/**
 * Minimal i18n with Greek as default and English as fallback.
 *
 * The string table lives in `src/i18n/strings.ts`; this module is the
 * runtime accessor (`t`, `setLocale`, `getLocale`).
 *
 * See `.agents/rules/localization-conventions.md` and ADR-0003 §5.
 */

import { type Locale, STRINGS } from "../i18n/strings";

export type { Locale };

let currentLocale: Locale = "el";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, locale: Locale = currentLocale): string {
  const table = STRINGS[locale];
  if (table[key] !== undefined) return table[key]!;
  const fallback = STRINGS.en[key];
  if (fallback !== undefined) return fallback;
  return key;
}
