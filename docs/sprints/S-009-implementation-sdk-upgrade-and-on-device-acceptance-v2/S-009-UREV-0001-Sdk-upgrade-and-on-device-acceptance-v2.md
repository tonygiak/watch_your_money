# Sprint S-009 — User review

## Where we are right now

Sprint **S-009 (`sdk-upgrade-and-on-device-acceptance-v2`)** closed 2026-05-09. The three-sprint Expo SDK 51 → 54 upgrade landed. ADR-0013 §3 pre-flight Step 3a (Windows CA bundle export via `NODE_EXTRA_CA_CERTS`) cleared the `UNABLE_TO_VERIFY_LEAF_SIGNATURE` blocker. `expo-doctor` reports 17/17 checks passed. `make check` green: 143 backend + 203 mobile = 346 tests across 21+ suites. The §2.8 MVP bullets 4 (on-device receipt scanning under stock Expo Go) and 9 (PDF export → native share sheet) are now reachable on a real Greek consumer's phone — the on-device verification step below is exactly that final reach.

## What changed

- `mobile/package.json` rewritten to the SDK 54 pin set: `expo@54.0.34`, `react@19.1.0`, `react-native@0.81.5`, `expo-camera@17.0.10`, `expo-crypto@15.0.9`, `expo-localization@17.0.8`, `expo-secure-store@15.0.8`, `expo-status-bar@3.0.9`, `react-native-safe-area-context@5.6.0`, `react-native-screens@4.16.0`, `react-native-svg@15.12.1`, `@react-native-async-storage/async-storage@2.2.0`, `@react-native-community/netinfo@11.4.1`, plus dev deps `jest-expo@54.0.17`, `typescript@5.9.2`, `@types/react@19.1.10`, `eslint-config-expo@10.0.0`, `@testing-library/react-native@13.2.0`, `react-test-renderer@19.1.0`. All exact-pinned per ADR-0007 §1.
- New direct deps for BLG-0020 + BLG-0021 runtime resolution: `expo-file-system@19.0.22`, `expo-sharing@14.0.8`, `@react-native-community/datetimepicker@8.4.4`. Lazy-require code from S-007 unchanged at the source level.
- Two devDependency promotions to satisfy SDK 54 + npm 10 hoisting: `babel-preset-expo@54.0.10`, `expo-modules-core@3.0.30` (both already in the lockfile as transitive deps; only their top-level visibility changed).
- `mobile/tsconfig.json`: removed the `moduleResolution: "node"` override (was an SDK 51 artifact) so SDK 54's `expo/tsconfig.base` flows through with `moduleResolution: "bundler"` + `customConditions: ["react-native"]`.
- 8 screen files migrated `: JSX.Element` → `: React.JSX.Element` for React 19 (the global `JSX` namespace was removed in React 19): HomeScreen, InsightsScreen, LoginScreen, DateField, ProfileScreen, ReceiptDetailScreen, TagPanel, ScannerScreen.
- `mobile/package-lock.json` fully regenerated under the v22 LTS Node.js + `NODE_EXTRA_CA_CERTS` host environment per ADR-0013 §3 Step 3a.

No new endpoints, no schema migration, no auth flow change, no new product feature. This sprint is the runtime-tree foundation for every on-device acceptance step that the §2.8 MVP definition-of-done requires.

## How to verify (before running on a phone)

The local-machine prerequisite is the ADR-0013 §3 Step 3a workflow — once per developer machine.

1. Confirm Node.js is on v22 LTS:

   ```powershell
   node --version
   ```

   Expected: `v22.x.x`. If lower, run `winget install OpenJS.NodeJS.LTS` (or download the .msi from `https://nodejs.org/en/download/`) and restart your shell.

2. Export the Windows CA bundle and set the env var (one-time, never committed):

   ```powershell
   $pem = (Get-ChildItem Cert:\LocalMachine\Root) | ForEach-Object {
     "-----BEGIN CERTIFICATE-----`n" +
     [Convert]::ToBase64String($_.RawData,'InsertLineBreaks') +
     "`n-----END CERTIFICATE-----"
   }
   $pem | Out-File "$env:USERPROFILE\ca-bundle.pem" -Encoding ascii
   $env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\ca-bundle.pem"
   ```

   To make `NODE_EXTRA_CA_CERTS` persist across PowerShell sessions, set it once via the System Environment Variables panel or:

   ```powershell
   [Environment]::SetEnvironmentVariable('NODE_EXTRA_CA_CERTS', "$env:USERPROFILE\ca-bundle.pem", 'User')
   ```

3. Confirm the install succeeds:

   ```powershell
   cd mobile
   npm install
   npx expo-doctor
   ```

   Expected: `Running 17 checks on your project... 17/17 checks passed. No issues detected!`.

## How to verify (the on-device acceptance — the actual sprint deliverable)

Run **both** scripts on a real phone with stock Expo Go (latest store version, iOS or Android — at least one of the two). This is the verification gate that S-005, S-006, S-007 all pre-recorded as gated on BLG-0016.

### Part A — `S-004` script (sign in → scan → Insights → offline → restore)

1. **Start the dev server.** From the workspace root:

   ```powershell
   $env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\ca-bundle.pem"
   make run-mobile
   ```

   Or directly: `cd mobile && npm run start`. Wait for the QR code in the terminal.

2. **Open Expo Go on your phone**, scan the QR code (Android: from inside Expo Go; iOS: from the Camera app). Wait for the bundle to load.

3. **Sign in.** On the Login screen, enter a Greek phone number (`+30 6XX XXX XXXX` or just `6XX XXX XXXX` — the E.164 normalizer adds `+30`). Tap `Στείλε κωδικό`. Receive the OTP via SMS, enter the 6-digit code. Tap `Σύνδεση`. Expected: lands on the Home tab.

4. **Scan a Greek e-invoice QR code.** Tap the FAB or the Scanner tab. Grant camera permission. Aim at any Greek e-invoice QR code (Entersoft- or SoftOne-issued). Expected: bundle loads, the receipt is fetched, parsed, stored. Within ~5 seconds the receipt detail screen renders with all line items in Greek.

5. **Verify Insights.** Tap the Insights tab. Pick the `Μήνας` period. Expected: the total spending, the vs-previous comparison, the by-category, by-merchant, and top-products sections all populate. Greek currency `X,XX €`. Greek dates `DD-MM-YYYY`.

6. **Offline path.** Put the phone in airplane mode. Reopen the app. Expected: the cached receipts still render from the encrypted offline cache (per ADR-0006 §2). The offline banner appears at the top.

7. **Restore.** Take the phone off airplane mode. Pull-to-refresh on Home. Expected: any new receipts arrive; the offline banner disappears.

### Part B — `S-006` freelancer-mode script (sign in → scan → tag as business → Insights → Profile → ΑΦΜ → export PDF → share)

Continue from Part A or sign in fresh.

1. **Tag a receipt as a business expense.** Open the receipt from Part A (or any receipt in Home). Tap the `Tag as business` (Greek: `Επαγγελματικό έξοδο`) switch. Add a category (e.g. `materials`). Optionally add notes. Expected: the panel switches to the "tagged" layout; the receipt is now tagged in the backend.

2. **Open Profile.** Tap the Profile tab. Verify: the masked phone reads `+30 6XX *** ****` per DES-0004 §3.1.

3. **Set freelancer mode + ΑΦΜ.** Toggle the freelancer switch on. Enter a valid 9-digit Greek ΑΦΜ (the MOD-11 validator runs server-side; if your test ΑΦΜ is real, redact in the LOG).

4. **Export business expenses as PDF.** Pick a date range covering the receipt you tagged in step 1 (default range = first day of current month → today). Tap `Δημιουργία PDF`. Expected: the spinner shows briefly, then the **native share sheet opens** with the PDF as the attachment. **This is the BLG-0020 acceptance bullet 3 verification — the on-device share-sheet hand-off, gated for three sprints.**

5. **Pick a target.** Select a target app from the share sheet (Mail, Drive, Files, etc.). Verify the PDF opens correctly with: cover (title + ΑΦΜ + range + timestamp), totals, per-receipt rows, footer with page numbers, A4 + 2 cm margins. Greek glyphs render correctly. Greek currency `X,XX €`. Greek dates `DD-MM-YYYY`.

6. **Native date picker.** Back on the Profile screen, tap the `Από` field. Expected: the **native iOS / Android date picker opens** (locale-aware — on a Greek phone, Greek month / weekday names render automatically). **This is the BLG-0021 acceptance bullet 5 verification — the on-device picker open, also gated for three sprints.** Pick a date. Tap `Έως` and pick a later date. Tap `Δημιουργία PDF` to confirm the new range exports.

7. **Sign out.** Tap the sign-out CTA. Expected: lands back on Login. The encrypted offline cache is wiped per DES-0004 §3.5 / ADR-0006 §2 (verified by reopening the app — no cached receipts visible until you sign in again).

If any step fails, capture the screenshot, the failure point, and the device + Expo Go version, and open a `BLG-` titled `S-009 on-device verification regression — <step>`. Per `AGENTS.md` §4.10, that opens a discovery sprint to address the regression rather than papering over it.

## How to review (discovery sprints)

Not applicable — S-009 was an implementation sprint.

## Where to look next

- `AGENTS.md` §2.6 — shipped features (S-009 added the BLG-0016 + BLG-0020 / BLG-0021 on-device-resolution updates).
- `AGENTS.md` §2.7 — current sprint snapshot (now reads "S-009 closed; SDK 54 live").
- `docs/plan.md` — next sprint (S-010 — likely discovery: country expansion / real-receipt fixtures / post-MVP UX gaps).
- `docs/backlog.md` — what's planned / in-progress (Ready queue empty for delivery work after S-009).
- `docs/done.md` — what has been completed (newest on top — Sprint S-009 entry first).
