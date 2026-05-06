/**
 * Greek-first string table.
 *
 * Source of truth for every user-facing string. Keys mirror the screen they
 * belong to (`scanner.*`, `home.*`, `login.*`, `insights.*`, `offline.*`,
 * `common.*`, `errors.*`).
 *
 * Greek strings are normative per ADR-0003 §5 and DES-0001 / DES-0002 /
 * DES-0003. English serves as a fallback when the device locale is `en-*`
 * (and never auto-falls through for other locales — non-`el`, non-`en`
 * users see Greek).
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

    // ----- Login (DES-0002 §3) ------------------------------------------------
    "login.title": "Καλώς ήρθατε",
    "login.subtitle": "Συνδεθείτε με τον αριθμό του κινητού σας.",
    "login.phone_label": "Αριθμός κινητού",
    "login.phone_placeholder": "6XXXXXXXXX",
    "login.country_code_hint": "Κωδικός χώρας: +30",
    "login.continue_cta": "Συνέχεια",
    "login.privacy_short":
      "Συνεχίζοντας, αποδέχεστε την Πολιτική Απορρήτου.",
    "login.privacy_link": "Διαβάστε περισσότερα",
    "login.privacy_sms_provider":
      "Το SMS αποστέλλεται μέσω παρόχου του Supabase.",
    "login.otp_title": "Εισαγάγετε τον κωδικό",
    "login.otp_subtitle": "Στείλαμε έναν 6ψήφιο κωδικό στο {phone}.",
    "login.otp_label": "Κωδικός επαλήθευσης",
    "login.verify_cta": "Επαλήθευση",
    "login.resend_cta": "Στείλτε ξανά",
    "login.resend_cooldown": "Στείλτε ξανά σε {seconds}s",
    "login.back_cta": "Λάθος αριθμός;",
    "login.error_invalid_phone": "Ελέγξτε τον αριθμό και δοκιμάστε ξανά.",
    "login.error_wrong_otp": "Λάθος κωδικός. Δοκιμάστε ξανά.",
    "login.error_expired_otp": "Ο κωδικός έληξε. Ζητήστε νέο.",
    "login.error_rate_limited": "Πολλές προσπάθειες. Δοκιμάστε σε λίγο.",
    "login.error_network": "Δεν υπάρχει σύνδεση. Δοκιμάστε ξανά.",
    "login.success_toast": "Είσοδος επιτυχής.",

    // ----- Insights (DES-0003 §4) ---------------------------------------------
    "insights.title": "Στατιστικά",
    "insights.period.week": "Εβδομάδα",
    "insights.period.month": "Μήνας",
    "insights.period.year": "Έτος",
    "insights.summary.receipts": "στις {count} αποδείξεις",
    "insights.compare.decrease":
      "{pct}% σε σχέση με τον/την προηγούμενο/η {period}",
    "insights.compare.increase":
      "{pct}% σε σχέση με τον/την προηγούμενο/η {period}",
    "insights.compare.none": "Δεν υπάρχει σύγκριση",
    "insights.section.by_category": "Ανά κατηγορία",
    "insights.section.top_merchants": "Κορυφαίοι έμποροι",
    "insights.section.top_products": "Κορυφαία προϊόντα",
    "insights.category.untagged": "Χωρίς κατηγορία",
    "insights.product.purchases": "{count} αγορές",
    "insights.product.avg_price": "{price} μ.ο.",
    "insights.product.total": "{amount} συνολικά",
    "insights.empty.title": "Ακόμα δεν έχετε σαρώσει αποδείξεις",
    "insights.empty.cta": "Σαρώστε την πρώτη απόδειξη",
    "insights.error.network": "Δεν υπάρχει σύνδεση. Δοκιμάστε ξανά.",
    "insights.offline.title": "Είστε εκτός σύνδεσης",
    "insights.offline.body": "Διαθέσιμο όταν είστε online.",
    "insights.retry_cta": "Δοκιμή ξανά",

    // ----- Offline UX (ADR-0006 §7) -------------------------------------------
    "offline.banner": "Είστε εκτός σύνδεσης",
    "offline.tooltip.tag_disabled": "Διαθέσιμο όταν είστε online",
    "offline.scanner.disabled": "Σαρώστε όταν είστε online",
    "offline.insights.body": "Διαθέσιμο όταν είστε online.",
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

    // ----- Login -------------------------------------------------------------
    "login.title": "Welcome",
    "login.subtitle": "Sign in with your mobile number.",
    "login.phone_label": "Mobile number",
    "login.phone_placeholder": "6XXXXXXXXX",
    "login.country_code_hint": "Country code: +30",
    "login.continue_cta": "Continue",
    "login.privacy_short": "By continuing, you accept the Privacy Policy.",
    "login.privacy_link": "Read more",
    "login.privacy_sms_provider":
      "The SMS is delivered via Supabase's provider.",
    "login.otp_title": "Enter the code",
    "login.otp_subtitle": "We sent a 6-digit code to {phone}.",
    "login.otp_label": "Verification code",
    "login.verify_cta": "Verify",
    "login.resend_cta": "Send again",
    "login.resend_cooldown": "Send again in {seconds}s",
    "login.back_cta": "Wrong number?",
    "login.error_invalid_phone": "Check the number and try again.",
    "login.error_wrong_otp": "Wrong code. Try again.",
    "login.error_expired_otp": "The code expired. Request a new one.",
    "login.error_rate_limited": "Too many attempts. Try again shortly.",
    "login.error_network": "No connection. Try again.",
    "login.success_toast": "Signed in.",

    // ----- Insights ----------------------------------------------------------
    "insights.title": "Insights",
    "insights.period.week": "Week",
    "insights.period.month": "Month",
    "insights.period.year": "Year",
    "insights.summary.receipts": "across {count} receipts",
    "insights.compare.decrease": "{pct}% vs the previous {period}",
    "insights.compare.increase": "{pct}% vs the previous {period}",
    "insights.compare.none": "No comparison available",
    "insights.section.by_category": "By category",
    "insights.section.top_merchants": "Top merchants",
    "insights.section.top_products": "Top products",
    "insights.category.untagged": "Untagged",
    "insights.product.purchases": "{count} purchases",
    "insights.product.avg_price": "{price} avg",
    "insights.product.total": "{amount} total",
    "insights.empty.title": "You haven't scanned any receipts yet",
    "insights.empty.cta": "Scan your first receipt",
    "insights.error.network": "No connection. Try again.",
    "insights.offline.title": "You are offline",
    "insights.offline.body": "Available when online.",
    "insights.retry_cta": "Retry",

    // ----- Offline UX --------------------------------------------------------
    "offline.banner": "You are offline",
    "offline.tooltip.tag_disabled": "Available when online",
    "offline.scanner.disabled": "Scan when online",
    "offline.insights.body": "Available when online.",
  },
};
