/**
 * Greek-first string table.
 *
 * Source of truth for every user-facing string. Keys mirror the screen they
 * belong to (`scanner.*`, `home.*`, `common.*`, `errors.*`).
 *
 * Greek strings are normative per ADR-0003 §5 and DES-0001. English serves
 * as a fallback when the device locale is `en-*` (and never auto-falls
 * through for other locales — non-`el`, non-`en` users see Greek).
 */

export type Locale = "el" | "en";

export type StringTable = Record<string, string>;

export const STRINGS: Record<Locale, StringTable> = {
  el: {
    "app.name": "Έξυπνες Αποδείξεις",

    "home.title": "Οι αποδείξεις μου",
    "home.empty": "Καμία απόδειξη ακόμα — σαρώστε ένα QR.",

    "common.cancel": "Άκυρο",
    "common.continue": "Συνέχεια",
    "common.retry": "Επανάληψη",
    "common.tryAgain": "Δοκιμή ξανά",
    "common.openSettings": "Άνοιγμα Ρυθμίσεων",
    "common.close": "Κλείσιμο",
    "common.loading": "Φόρτωση…",
    "common.error.generic": "Κάτι πήγε στραβά. Δοκιμάστε ξανά.",

    "scanner.cta": "Σάρωση παραστατικού",

    "scanner.permission.preprompt.title": "Πρόσβαση στην κάμερα",
    "scanner.permission.preprompt.body":
      "Χρειαζόμαστε πρόσβαση στην κάμερα για να σαρώσουμε το QR code του παραστατικού. Δεν αποθηκεύουμε εικόνες — μόνο τη δομή του παραστατικού.",
    "scanner.permission.denied.title": "Δεν έχουμε πρόσβαση στην κάμερα",
    "scanner.permission.denied.body":
      "Για να σαρώσετε QR codes χρειαζόμαστε πρόσβαση στην κάμερα. Μπορείτε να το επιτρέψετε τώρα.",
    "scanner.permission.denied.action": "Επιτρέψτε",
    "scanner.permission.blocked.title": "Η πρόσβαση στην κάμερα είναι αποκλεισμένη",
    "scanner.permission.blocked.body":
      "Ανοίξτε τις Ρυθμίσεις και ενεργοποιήστε την πρόσβαση στην κάμερα για το idi8.",

    "scanner.scanning.header": "Στοχεύστε στο QR του παραστατικού",
    "scanner.validating.caption": "Έλεγχος…",
    "scanner.submitting.body": "Λήψη παραστατικού…",

    "scanner.success.new": "Παραστατικό αποθηκεύτηκε.",
    "scanner.success.duplicate": "Έχετε ήδη σαρώσει αυτό το παραστατικό.",

    "scanner.error.unsupported.toast":
      "Αυτός ο κωδικός QR δεν είναι ελληνικό e-παραστατικό.",
    "scanner.error.auth.title": "Η συνεδρία έληξε",
    "scanner.error.auth.body": "Παρακαλούμε συνδεθείτε ξανά για να συνεχίσετε.",
    "scanner.error.auth.action": "Σύνδεση",
    "scanner.error.parse.title": "Δεν μπορούμε να διαβάσουμε αυτό το παραστατικό",
    "scanner.error.parse.body":
      "Βεβαιωθείτε ότι το QR ανήκει σε ελληνικό e-παραστατικό από έναν υποστηριζόμενο εκδότη.",
    "scanner.error.network.title": "Πρόβλημα δικτύου",
    "scanner.error.network.body":
      "Δεν καταφέραμε να φέρουμε το παραστατικό. Δοκιμάστε ξανά.",
    "scanner.error.drift.title": "Προσωρινό τεχνικό πρόβλημα",
    "scanner.error.drift.body": "Έχουμε ειδοποιηθεί. Δοκιμάστε ξανά σε λίγο.",
    "scanner.error.generic.title": "Κάτι πήγε στραβά",
    "scanner.error.generic.body":
      "Δοκιμάστε ξανά. Αν συνεχίσει, ενημερώστε μας.",
    "scanner.error.camera.title": "Δεν μπορούμε να ανοίξουμε την κάμερα",
    "scanner.error.camera.body":
      "Κλείστε άλλες εφαρμογές που χρησιμοποιούν την κάμερα και δοκιμάστε ξανά.",
  },
  en: {
    "app.name": "Smart Receipts",

    "home.title": "My receipts",
    "home.empty": "No receipts yet — scan a QR.",

    "common.cancel": "Cancel",
    "common.continue": "Continue",
    "common.retry": "Retry",
    "common.tryAgain": "Try again",
    "common.openSettings": "Open Settings",
    "common.close": "Close",
    "common.loading": "Loading…",
    "common.error.generic": "Something went wrong. Please try again.",

    "scanner.cta": "Scan receipt",

    "scanner.permission.preprompt.title": "Camera access",
    "scanner.permission.preprompt.body":
      "We need camera access to scan the receipt QR code. We don't store any images — only the receipt structure.",
    "scanner.permission.denied.title": "We don't have camera access",
    "scanner.permission.denied.body":
      "To scan QR codes we need camera access. You can allow it now.",
    "scanner.permission.denied.action": "Allow",
    "scanner.permission.blocked.title": "Camera access is blocked",
    "scanner.permission.blocked.body":
      "Open Settings and enable camera access for idi8.",

    "scanner.scanning.header": "Aim at the receipt QR.",
    "scanner.validating.caption": "Validating…",
    "scanner.submitting.body": "Fetching receipt…",

    "scanner.success.new": "Receipt saved.",
    "scanner.success.duplicate": "You already scanned this receipt.",

    "scanner.error.unsupported.toast": "This QR is not a Greek e-receipt.",
    "scanner.error.auth.title": "Session expired",
    "scanner.error.auth.body": "Please sign in again to continue.",
    "scanner.error.auth.action": "Sign in",
    "scanner.error.parse.title": "We can't read this receipt",
    "scanner.error.parse.body":
      "Make sure the QR belongs to a Greek e-receipt from a supported issuer.",
    "scanner.error.network.title": "Network problem",
    "scanner.error.network.body":
      "We couldn't fetch the receipt. Please try again.",
    "scanner.error.drift.title": "Temporary technical issue",
    "scanner.error.drift.body": "We've been notified. Please try again shortly.",
    "scanner.error.generic.title": "Something went wrong",
    "scanner.error.generic.body":
      "Try again. If this keeps happening, let us know.",
    "scanner.error.camera.title": "We can't open the camera",
    "scanner.error.camera.body":
      "Close other apps using the camera and try again.",
  },
};
