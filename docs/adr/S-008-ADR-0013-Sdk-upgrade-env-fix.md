# SDK upgrade unblock — Node.js CA environment fix + S-009 fallback contract

Status: accepted
Date: 2026-05-08
Chair: orchestrator
Participants: agent-safety-officer, architect, engineering-manager, mobile-builder, devops-engineer
Co-signs required: agent-safety-officer (supply-chain implications of chosen path — `AGENTS.md` §4.11), architect (technical decision), engineering-manager (engineering-quality bar), mobile-builder (executor feasibility), devops-engineer (build/distribution implications).

## Context

BLG-0016 (Expo SDK 51 → 54 upgrade) has been deferred **three sprints running** — S-005, S-006, S-007 — on the same failure mode every time:

```
npm ERR! code UNABLE_TO_VERIFY_LEAF_SIGNATURE
npm ERR! errno UNABLE_TO_VERIFY_LEAF_SIGNATURE
npm ERR! request to https://registry.npmjs.org/<package> failed, reason:
npm ERR!   unable to verify the first certificate
```

This error means Node.js's **built-in CA bundle** does not include the intermediate or root CA that signed the current `registry.npmjs.org` TLS leaf certificate. Node.js ships its own CA store (it does **not** use the Windows system trust store by default). When `registry.npmjs.org` rotated to a certificate chain anchored by a newer root (e.g. ISRG Root X2 or a refreshed DigiCert Global root), Node.js installations whose bundled CA set predates that rotation cannot validate the leaf cert — hence `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

The two options already ruled out per `agent-runtime-security.md` and `AGENTS.md` §4.10:

- **`strict-ssl=false`** — weakens supply-chain TLS posture; ruled out permanently.
- **Third-party registry mirror** — expands the outbound allowlist mid-sprint without an ADR; ruled out for delivery sprints. (A managed mirror configured through a proper ADR remains on the table in general; ruled out for *mid-sprint* use only.)

Three options on the table for this debate, per `S-007-REV-0001` and `docs/plan.md` S-008 goals:

- **(A) Fix the host TLS/CA environment.** Update Node.js to a current LTS release (which ships an updated Mozilla CA bundle), or inject an updated CA bundle via `NODE_EXTRA_CA_CERTS` pointing to the Windows system certificate store. Either approach keeps `strict-ssl` fully enabled and `registry.npmjs.org` as the only outbound host.
- **(B) Amend ADR-0012 §1 toward Strategy 3 (EAS dev client / TestFlight).** Remove the Expo Go dependency entirely; ship the app via an EAS custom dev client build through TestFlight / Play internal testing. Requires Apple Developer Program, code-signing keys, EAS CLI integration, and meaningful new CI configuration. ADR-0012 §1 originally rejected this as "MVP-incompatible operational shift" in S-005; three deferrals is the threshold at which that rejection is worth revisiting.
- **(C) Split-into-two-upgrade approach.** SDK 54 dev-client first (smaller blast radius, only `agent-safety-officer` + `engineering-manager` audit the dev-client diff); then full Expo Go compatibility in a separate subsequent sprint.

Constraints in scope:

- `AGENTS.md` §2.4 — no new third-party paid services.
- `AGENTS.md` §3.2.1 — `strict-ssl` must remain enabled; outbound surface additions require a backlog item + ADR.
- `AGENTS.md` §4.7 — `make check` green at sprint close.
- `AGENTS.md` §4.11 — new runtime dependency requires `agent-safety-officer` + `engineering-manager` co-sign.
- ADR-0012 — current upgrade strategy; this ADR amends §1 of ADR-0012 if the decision supersedes Strategy 1 ("stay on SDK 51").

Prior ADRs relevant:

- ADR-0006 — encryption stack: `@noble/ciphers`, `expo-secure-store`, `expo-crypto`. Contract must survive byte-identically.
- ADR-0007 — SDK 51 runtime tree. ADR-0012 §2 supersedes §2 only; other sections carry forward.
- ADR-0012 — the S-005 upgrade decision. §1 is on the table; §2–§10 stay unless this ADR specifically amends them.

## Rounds

### Round 1

**agent-safety-officer:**

> The `UNABLE_TO_VERIFY_LEAF_SIGNATURE` failure is a **diagnostic result, not a mystery**. Node.js bundles the Mozilla CA store at its release date. If `registry.npmjs.org` has adopted a root or intermediate CA that post-dates the bundled store in the installed Node.js version, validation fails even though the certificate chain is entirely legitimate. The correct fix is not to disable validation — it is to restore parity between Node.js's CA knowledge and the current PKI reality.
>
> **Option A is both safe and sufficient.** Two concrete paths:
>
> 1. **Update Node.js to the current LTS release.** As of 2026-05, the active LTS lines are Node.js 22 (Jod) and Node.js 20 (Iron). Either ships with the Mozilla CA bundle current to its release date, which includes every CA used by `registry.npmjs.org` today. This is standard engineering hygiene — not a security trade-off, a security improvement. It does not add a new outbound host; `nodejs.org` is the download site (install-time only, not in the runtime allowlist). No new runtime dependency; Node.js is the runtime, not a package.
>
> 2. **Export the Windows system CA bundle, set `NODE_EXTRA_CA_CERTS`.** The Windows Trusted Root Certification Authorities store is kept current by Windows Update. Exporting it and pointing Node.js to it gives npm access to every root the OS trusts — including any newer roots that post-date the Node.js installation. The PowerShell command to export:
>
>    ```powershell
>    $certs = Get-ChildItem -Path Cert:\LocalMachine\Root
>    $pem = $certs | ForEach-Object { "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($_.RawData, 'InsertLineBreaks') + "`n-----END CERTIFICATE-----" }
>    $pem | Out-File -FilePath "$env:USERPROFILE\ca-bundle.pem" -Encoding ascii
>    $env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\ca-bundle.pem"
>    ```
>
>    This does not disable TLS verification; it augments the trust set with OS-managed certificates that Windows already trusts. No new outbound host. No new npm package. Fully reversible.
>
> Both paths keep `agent-runtime-security.md` honored byte-identically. My recommendation: **Option A, path 1 first (Node.js LTS update), path 2 as fallback**. Option B (EAS dev client) is a meaningful operational shift that should only be taken if Option A demonstrably fails in S-009 despite the CA fix. Option C (split upgrade) does not address the root cause — the TLS failure will occur for SDK 54 whether it's packaged as a dev client or a stock Expo Go build, so splitting does not inherently unblock anything unless the network environment is fixed first.
>
> **Supply-chain posture of Option A**: Node.js update is a runtime upgrade, not a new npm/pip package. It is **not** within the §4.11 "new runtime dependency" sign-off scope (that scope covers npm/pip packages added to package.json / requirements.txt). The install-time download of the Node.js installer touches `nodejs.org` — install-time only, not added to the production runtime allowlist. `agent-safety-officer` pre-approves this as standard maintenance.

**architect:**

> Option A is architecturally sound. The `UNABLE_TO_VERIFY_LEAF_SIGNATURE` error is a host-environment issue unrelated to the application's architecture. Fixing the CA environment restores the upgrade path without any change to the application stack, the ADR-0012 strategy, or the supply-chain footprint of the SDK 54 transitive re-pin.
>
> Option B (EAS dev client) would change the application delivery model. ADR-0012 §1 rejected it as MVP-incompatible; I continue to hold that position unless Option A demonstrably fails in S-009. Three TLS errors on the same root cause do not constitute evidence that the EAS dev-client model is technically superior — they constitute evidence that the host environment has a CA bundle problem. Fixing the root cause is the right call.
>
> Option C (split upgrade) does not solve the CA problem. Whether the upgrade target is a dev-client build or stock Expo Go, npm still needs to fetch the SDK 54 tarballs from `registry.npmjs.org` — and the TLS failure will occur unless the CA bundle is updated first. Option C could make sense as a sequencing strategy *after* Option A succeeds, to reduce blast radius on the first attempt, but it is not an alternative to the CA fix.
>
> **Position: Option A (Node.js update / CA bundle fix), with a clear success criterion in S-009.** If the install still fails after both CA-fix paths, the evidence set changes (it would mean the TLS failure is not a CA bundle issue at all) and revisiting Option B becomes justified at that point.

**engineering-manager:**

> Option A is the correct first step and should have been the diagnostic hypothesis from the start. A Node.js LTS update is standard engineering maintenance, carries zero risk of introducing new security vulnerabilities (it is, in fact, a security improvement over an outdated version), and directly addresses the diagnosed root cause.
>
> I want this ADR to record a **concrete S-009 pre-flight checklist** so the executor (mobile-builder) has an unambiguous sequence to follow, rather than "try option A and see." The checklist should include: (1) verify current Node.js version, (2) update to v22 LTS if below v22, (3) re-run `npm install --dry-run` or `npm pack` a single SDK 54 tarball as a smoke test, (4) if that succeeds, proceed with `npx expo install --fix`; if it fails after the LTS update, try the `NODE_EXTRA_CA_CERTS` export before declaring Option A exhausted. The checklist lives in this ADR §3 so S-009 can execute it without reopening a debate.
>
> **Position: Option A with an explicit pre-flight checklist.** Option B stays off the table unless the S-009 pre-flight checklist is fully exhausted without success.

**mobile-builder:**

> I've run two failed install attempts (S-006 LOG 18:35, S-007 LOG 21:35), both on the same error. Both times I tried `npm install --prefer-offline` as a fallback (which succeeded with the SDK 51 tree from cache). The `--prefer-offline` success confirms the SDK 51 tree is fully cached; the failure was only on net-fetched SDK 54 tarballs — consistent with a CA validation error during TLS handshake.
>
> `agent-safety-officer`'s two paths are the right moves. I can execute them in S-009 in sequence: (1) `node --version` to confirm the current version; (2) if below v22, update via `winget install OpenJS.NodeJS.LTS` (or the Windows installer from `nodejs.org` — install-time download only); (3) after update, `node --version` confirms the new version; (4) smoke test with `npm pack expo@51.0.0` from a clean temp dir (SDK 51 — should succeed) then `npm pack expo@^54.0.0` (SDK 54 — should now succeed with updated CA); (5) if smoke test passes, proceed with the full `npx expo install --fix` run per ADR-0012 §2; (6) if smoke test still fails despite the Node.js update, run the `NODE_EXTRA_CA_CERTS` export and retry. This sequence is deterministic and fully auditable in the sprint LOG.
>
> **Position: Option A via the sequence above. Option B only if both CA-fix paths in the sequence are exhausted.**

**devops-engineer:**

> From a build and distribution perspective: Option A (Node.js update) has zero CI impact — the CI workflow already pins its Node.js version via the `actions/setup-node` step, so the local-machine update does not affect CI. CI already uses the latest LTS runner image, which presumably has a current CA bundle; the TLS failure has only been seen on the local development machine. This further supports Option A as the right diagnosis.
>
> Option B (EAS dev client) would require: EAS CLI configured on the CI runner, Apple Developer team ID + certificates for iOS, Google Play service account for Android, `eas.json` `development` profile wired for a custom build. These are meaningful operational changes. **If Option A succeeds in S-009, none of this is needed for the SDK upgrade.** EAS is still the right path for the eventual production launch (ADR-0007 §7 reserves the production profile for a separate pre-launch ADR), so the knowledge will be needed — but now is not the right moment to force it.
>
> Option C (split) has the same operational footprint as Option B (the dev-client build is the same whether split or not), so it doesn't reduce scope.
>
> **Position: Option A. Endorsing the `engineering-manager` pre-flight checklist idea.**

### Round 2

All five participants converged on Option A in Round 1 with no dissent. Round 2 addresses the open questions raised in Round 1:

**engineering-manager** (responding, proposing the §3 checklist):

> Below is the S-009 pre-flight checklist I'm proposing for §3. Participants may amend before it is locked.
>
> ```
> Pre-flight step 1: verify Node.js version
>   Run: node --version
>   If v22.x or later → proceed to step 3.
>   If below v22.x → proceed to step 2.
>
> Pre-flight step 2: update Node.js to v22 LTS
>   On Windows: winget install OpenJS.NodeJS.LTS
>   (or download .msi from https://nodejs.org/en/download/)
>   Restart shell. Confirm: node --version → 22.x.x
>
> Pre-flight step 3: smoke test the TLS fix
>   In a temp dir: npm pack expo@^54.0.0 --dry-run
>   Expected: prints tarball name without TLS error.
>   If smoke test passes → proceed to step 4.
>   If smoke test still fails → proceed to step 2a.
>
> Pre-flight step 2a (fallback): export Windows CA bundle
>   Run in PowerShell (admin not required):
>     $pem = (Get-ChildItem Cert:\LocalMachine\Root) | ForEach-Object {
>       "-----BEGIN CERTIFICATE-----`n" +
>       [Convert]::ToBase64String($_.RawData,'InsertLineBreaks') +
>       "`n-----END CERTIFICATE-----"
>     }
>     $pem | Out-File "$env:USERPROFILE\ca-bundle.pem" -Encoding ascii
>     $env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\ca-bundle.pem"
>   Retry step 3 smoke test.
>   If smoke test passes → proceed to step 4.
>   If still fails after both paths → **Option A exhausted — escalate to S-010 for Option B consideration.**
>
> Pre-flight step 4: proceed with SDK 54 upgrade per ADR-0012 §2
>   npx expo install --fix (in mobile/)
>   expo-doctor until clean
>   Regenerate mobile/package-lock.json
>   Run make check (or equivalent per UREV §1 workaround)
> ```

**agent-safety-officer** (responding):

> Pre-flight checklist approved as written. Two additions / confirmations:
>
> 1. The `NODE_EXTRA_CA_CERTS` path file (`ca-bundle.pem`) must be created in the user's home directory and **never committed to the repository**. Log only the fact of its creation (not its content) in `S-009-LOG-0001`.
> 2. The `winget` / `nodejs.org` install-time download is to `nodejs.org` — install-time only. This host is **not** added to the runtime allowlist; it is a developer-tool download, equivalent to the existing PyPI / npmjs.com build-time entries. No allowlist update required.
> 3. The Option A exhaustion criterion must be precise: Option A is exhausted when **both** pre-flight steps (Node.js update **and** `NODE_EXTRA_CA_CERTS` fallback) have been attempted sequentially and the smoke test still fails on step 3. If only one path has been tried, Option A is not exhausted.
>
> Supply-chain co-sign granted for Option A as defined. The supply-chain footprint of the SDK 54 transitive re-pin itself is already approved in ADR-0012 Round 2; this ADR adds only the pre-flight environment setup, which carries no npm/pip package additions.

**architect** (responding):

> Checklist looks right. One note on Option B criteria: if S-009 exhausts Option A and we open S-010 for Option B consideration, the S-010 discovery sprint should include a fresh supply-chain review of the EAS CLI toolchain and the code-signing key management surface. That review is `agent-safety-officer` territory and should be scoped in S-010's PLN, not pre-committed here. Recording this as a follow-up.
>
> Co-sign granted on the technical decision (Option A first, Option B only if S-009 exhausts A).

**engineering-manager** (responding):

> Co-sign granted on the engineering-quality bar. The pre-flight checklist is specific enough that S-009 cannot "try the same thing again" and call that an attempt — each path is distinct and auditable.

**mobile-builder** (responding):

> Checklist matches what I described in Round 1. I can execute it as written. Co-sign granted on executor feasibility.

**devops-engineer** (responding):

> No new concerns. Confirmed: CI's `actions/setup-node@v4` already pins Node.js to the LTS line and the CI runner CA bundle is current — the TLS error has only been observed on the local Windows machine. This pre-flight checklist is local-machine only; CI pipeline is unaffected. Co-sign granted.

### Round 3

No new concerns raised in Round 2. All participants confirm:

- **Option A is the sole path forward for S-009.** Pre-flight checklist in §3 is the execution contract.
- **Option B (EAS dev client) is not adopted.** ADR-0012 §1 remains in force. If Option A is exhausted, Option B is opened for debate in a separate S-010 discovery sprint.
- **Option C (split upgrade) is not adopted.** It does not address the root cause.
- **BLG-0014 (chart-kit re-eval)** — remains passive per ADR-0012 §6. The question "does chart-kit survive the SDK 54 upgrade" is answered when the actual upgrade runs in S-009. No change needed.

All five participants signal no further concerns. Chair declares rounds closed.

## Decision

### 1. Root cause

The `UNABLE_TO_VERIFY_LEAF_SIGNATURE` failure is caused by the host machine's Node.js installation having an outdated built-in CA bundle that does not include the root or intermediate CA currently anchoring `registry.npmjs.org`'s TLS certificate chain. This is a host-environment issue, not an application-architecture issue.

### 2. Chosen path: Option A — host CA environment fix

Execute the S-009 pre-flight checklist in §3 **before** any `npx expo install --fix` attempt. ADR-0012 §2 upgrade strategy is otherwise unchanged.

### 3. S-009 pre-flight checklist (execution contract for mobile-builder)

```
Step 1: Check Node.js version
  Run: node --version
  If output is v22.x.x or later → skip to step 3.
  If output is below v22.x → proceed to step 2.

Step 2: Update Node.js to v22 LTS
  Option: winget install OpenJS.NodeJS.LTS
  Alt:    download installer from https://nodejs.org/en/download/
  Restart shell.
  Confirm: node --version → 22.x.x
  Also run: npm --version (should be 10.x with Node 22)

Step 3: TLS smoke test
  mkdir %TEMP%\npm-tls-test && cd %TEMP%\npm-tls-test
  npm pack expo@^54.0.0 --dry-run
  Expected: lists tarball info and exits 0, no UNABLE_TO_VERIFY_LEAF_SIGNATURE.
  If passes → proceed to step 4.
  If fails despite Node 22 → proceed to step 3a.

Step 3a: Export Windows system CA bundle (fallback)
  Run in PowerShell (no admin required):
    $pem = (Get-ChildItem Cert:\LocalMachine\Root) | ForEach-Object {
      "-----BEGIN CERTIFICATE-----`n" +
      [Convert]::ToBase64String($_.RawData, 'InsertLineBreaks') +
      "`n-----END CERTIFICATE-----"
    }
    $pem | Out-File "$env:USERPROFILE\ca-bundle.pem" -Encoding ascii
    $env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\ca-bundle.pem"
  Note: ca-bundle.pem is NEVER committed to the repository.
  Retry step 3 smoke test.
  If passes → proceed to step 4.
  If STILL fails → STOP. Option A is exhausted.
    Open S-010 as discovery sprint for Option B (EAS dev client).
    Log both attempt results in S-009-LOG with full error output.
    Do not weaken strict-ssl or add a new outbound host.

Step 4: Proceed with SDK 54 upgrade per ADR-0012 §2
  cd mobile/
  npx expo install --fix
  npx expo-doctor (iterate until zero warnings)
  Regenerate mobile/package-lock.json
  Run make check (or the direct-binary equivalent per S-009-UREV-0001 §1 workaround)
  Verify all BLG-0016 acceptance bullets
```

### 4. Option B (EAS dev client) — deferred, not rejected

ADR-0012 §1 rejection of Strategy 3 (EAS dev client) **remains in force** unless and until the S-009 pre-flight checklist is fully exhausted without success. If S-009 exhausts Option A, S-010 opens a new discovery sprint that includes a fresh `agent-safety-officer` supply-chain review of the EAS CLI toolchain and code-signing surface. That review is not pre-committed in this ADR.

### 5. Option C (split upgrade) — not adopted

Option C is valid in principle but does not address the root cause. If the CA fix succeeds, there is no reason to split the upgrade. Dropped.

### 6. BLG-0014 (chart-kit re-eval) — remains passive

Per ADR-0012 §6: `react-native-chart-kit` stays passive unless the actual S-009 install proves it does not survive SDK 54. If it does not survive, BLG-0014 collapses into the same S-009 PR per the existing acceptance bullet. No change to ADR-0012 §6.

### 7. Outbound surface

No change to the allowlist. The `nodejs.org` install download is install-time developer tooling, equivalent to the existing PyPI / npmjs.com build-time entries. It is not a production runtime host and is not added to `.agents/context/outbound-allowlist.md`.

### 8. BLG-0016 status update

BLG-0016 is updated from "Ready, deferred + escalated" to **"Ready, executable in S-009 per ADR-0013 §3 pre-flight checklist."** No fourth deferral on the same outbound surface is acceptable unless the pre-flight checklist is documented as fully exhausted.

## Dissent

None recorded. All five participants converged in Round 2 with no dissent in Round 3.

## Consequences

**Positive:**

- BLG-0016 has a precise, auditable, unambiguous pre-flight checklist — no more "try the install and fail silently."
- Option A is risk-free from a security standpoint (a Node.js LTS update is a security improvement, not a regression).
- ADR-0012's upgrade strategy is preserved byte-identically — the only change is the pre-flight environment setup.
- The decision process is transparent: if S-009 fails after the checklist, the evidence set changes and Option B gets a fair hearing in S-010.

**Negative:**

- Still one sprint away from the actual upgrade. Three sprints of deferral is the cost of maintaining the security posture.
- If the CA fix doesn't resolve the issue (which would be surprising given the diagnostic), we'll need S-010 discovery — another sprint without BLG-0016 landing.

**Follow-ups added to backlog:**

- BLG-0016 updated: "Ready, executable per ADR-0013 §3" (this sprint).
- BLG-0022 closed: discovery sprint complete (this sprint).
- If S-009 exhausts Option A: open BLG-0023 "EAS dev client upgrade path — discovery" for S-010.
- No allowlist update.
