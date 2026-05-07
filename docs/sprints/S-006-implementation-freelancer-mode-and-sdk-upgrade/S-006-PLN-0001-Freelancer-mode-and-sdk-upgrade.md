# Sprint S-006 — Freelancer mode and SDK upgrade

- Type: implementation
- Theme: `freelancer-mode-and-sdk-upgrade`
- Start: 2026-05-07
- Chair: orchestrator
- Participants: orchestrator (chair + co-sign on `go`), mobile-builder, backend-builder, architect, engineering-manager, agent-safety-officer, security-privacy-officer, data-architect, product-designer, localization-specialist, qa, devops-engineer

## Why this sprint

Closes `AGENTS.md` §2.8 bullets 8 + 9 (tag a receipt as a business expense; export tagged business expenses as PDF) and unblocks on-device verification on stock Expo Go. Four Ready items (per `AGENTS.md` §4.1.3) carry over from S-005 discovery against ADR-0008..0012 and DES-0004..0005:

- **BLG-0016** — Expo SDK 51 → 54 upgrade (anchored to **ADR-0012**).
- **BLG-0017** — Profile screen + freelancer toggle + ΑΦΜ field + sign-out (anchored to **DES-0004 + ADR-0008 §4**).
- **BLG-0018** — Tag-as-business endpoint + Receipt-detail UX (anchored to **ADR-0008 + DES-0005**).
- **BLG-0019** — PDF export endpoint + Profile export action (anchored to **ADR-0009 + DES-0004 §3.4**).

Per `AGENTS.md` §4.1.2 — the Ready queue is non-empty, so this sprint must be implementation, not discovery. After S-006 every bullet in `AGENTS.md` §2.8 is reachable end-to-end on a real Greek consumer's stock Expo Go.

## Goals

1. **BLG-0016 land** — `mobile/package.json` reflects the SDK 54 tree (exact pins, no carets); `mobile/package-lock.json` regenerated; `expo-doctor` clean; encryption-stack round-trip test passes; both in-tree compat-matrix deviations (`netinfo`, `typescript`) re-aligned to the SDK 54 matrix; existing 198 tests stay green under `jest-expo@~54`; `eas.json` profiles bumped.
2. **BLG-0017 land** — `PATCH /users/me` Bearer-JWT-protected with server-side ΑΦΜ MOD-11 validation; mobile Profile screen with freelancer toggle, ΑΦΜ field, sign-out; sign-out rotates `wym.cache.aes-256-gcm.v1`; full Greek `profile.*` strings.
3. **BLG-0018 land** — `POST /receipts/{id}/tag` Bearer-JWT-protected per ADR-0008 §2 (idempotent 200, RLS + WHERE-guard, 404 for not-owned, 422 for malformed/too-long, server-side trim + lowercase on `category`); mobile Receipt-detail tag-as-business inline UX per DES-0005; full Greek `tag.*` strings.
4. **BLG-0019 land** — `GET /export/business-expenses` PDF endpoint per ADR-0009 (reportlab, on-the-fly, never persisted, `StreamingResponse`, RFC-7807 errors, 366-day range cap, Greek glyphs via `DejaVuSans`); mobile Profile export action per DES-0004 §3.4 (date pills, Generate PDF CTA, native share sheet).
5. **`make check` green at sprint close** — aim ~250 tests (current baseline 198).
6. **`AGENTS.md` §2.6 + §2.7 + `docs/plan.md`** updated to reflect S-006 close and queue S-007.

## Scope

**In:**

- `mobile/package.json` + `mobile/package-lock.json` updated to SDK 54 (BLG-0016).
- `eas.json` profile bumps (BLG-0016).
- New mobile sources: `mobile/src/lib/afm.ts`, `mobile/src/api/profile.ts`, `mobile/src/screens/profile/state.ts`, `mobile/src/screens/profile/ProfileScreen.tsx`, `mobile/src/screens/receipt/tag.state.ts`, `mobile/src/screens/receipt/TagPanel.tsx`, `mobile/src/screens/receipt/ReceiptDetailScreen.tsx`.
- New mobile tests under `mobile/__tests__/lib/afm.test.ts`, `mobile/__tests__/screens/profile/state.test.ts`, `mobile/__tests__/screens/profile/ProfileScreen.render.test.tsx`, `mobile/__tests__/screens/receipt/tag.state.test.ts`, `mobile/__tests__/screens/receipt/ReceiptDetailScreen.render.test.tsx`, `mobile/__tests__/cache/keyRotation.test.ts`.
- New mobile API helpers / extensions: extend `mobile/src/api/auth.ts` with `signOutAndRotateCacheKey`, extend `mobile/src/api/receipts.ts` with `tagReceipt`.
- New mobile i18n keys under `tag.*`, `profile.*`, `receipt.*` namespaces.
- New backend sources: `backend/app/storage/users.py`, `backend/app/lib/afm.py`, `backend/app/lib/format.py`, `backend/app/exports/__init__.py`, `backend/app/exports/business_expenses.py`, `backend/app/routes/users.py`, `backend/app/routes/receipt_tag.py`, `backend/app/routes/exports.py`.
- Extend `backend/app/storage/receipts.py` with `find_by_id` and `tag_receipt` methods (in-memory + Supabase).
- New backend tests: `backend/tests/lib/test_afm.py`, `backend/tests/routes/test_users.py`, `backend/tests/routes/test_receipt_tag.py`, `backend/tests/exports/test_business_expenses.py`, `backend/tests/routes/test_exports.py`.
- `backend/requirements.txt` adds `reportlab==4.2.5` (per ADR-0009 §1).
- Updates to `backend/app/main.py` to wire the three new routers.
- Documentation: `docs/done.md` entries, `docs/backlog.md` removals, `AGENTS.md` §2.6 + §2.7, `docs/plan.md`, `S-006-LOG-0001`, `S-006-REV-0001`, `S-006-UREV-0001`.

**Out (explicitly):**

- Profile-level period import for tagging (deferred per ADR-0008 §1).
- Multi-receipt batch tag (deferred per ADR-0008 §1).
- Inferred-category labels on tagged receipts (deferred per ADR-0010).
- Branded / themed PDF (deferred per ADR-0009 Consequences).
- Per-merchant-grouped export view (deferred per ADR-0009 Consequences).
- Account deletion / GDPR Art. 17 self-service (post-MVP per DES-0004 §1).
- Profile language switch (BLG-0011, out of MVP).
- Live integration test for the export endpoint against a Supabase test project (BLG-0015).
- Real-receipt fixtures (BLG-0004 — stays planned).
- Drift-detection CI (BLG-0009 — stays planned).

## Ready items pulled (delivery)

- BLG-0016: Upgrade Expo SDK 51 → 54 (Expo Go compatibility + compat-matrix alignment).
- BLG-0017: Profile screen — freelancer toggle, ΑΦΜ field, sign-out (mobile + thin backend).
- BLG-0018: Tag-as-business — `POST /receipts/{id}/tag` endpoint + Receipt-detail UX.
- BLG-0019: PDF export — `GET /export/business-expenses` endpoint + Profile export action.

## Sequencing strategy

Strategy C from `docs/plan.md` was the recommended option. **S-006 follows Strategy C with one tweak**:

1. **BLG-0016 first** — locks the SDK 54 tree, regenerates `mobile/package-lock.json`, runs the encryption round-trip. If anything in the existing 198 tests regresses, the upgrade is paused until it can be made green (no scope creep into ADR-0006 amendments without a discovery sprint).
2. **BLG-0018 + BLG-0017 in parallel** — different surfaces (Receipt detail + `receipts` write path vs. Profile screen + `users` write path). The mobile screens are independent; the backend endpoints are independent.
3. **BLG-0019 last** — depends on BLG-0017 having shipped the Profile screen scaffold; the export action is a section on that screen (DES-0004 §3.4).

The tweak: since the encryption round-trip test (BLG-0016 acceptance bullet 5) is the hardest to satisfy from a Cursor agent runtime (we cannot run a real Expo Go device session), we adopt the **forward-only** variant proposed in `docs/plan.md` "Open questions" — encrypt + decrypt under SDK 54 with a known plaintext, asserting the AES-256-GCM round-trip is unbroken. This is the lower of the two acceptable bullet-5 paths and is captured here so a future agent doesn't re-debate.

## Risks & known unknowns

- **R1 — SDK 54 transitive re-pin breaks an existing test.** Mitigation: keep the two-project Jest layout from BLG-0012, run the existing 198 tests under `jest-expo@~54` before any new test is added, and revert+document drift if a regression cannot be made green inside the sprint.
- **R2 — `react-native-chart-kit` does not survive SDK 54.** Mitigation: per ADR-0012 §6, BLG-0014 collapses into this PR with a swap (likely `victory-native@~37.x` or `react-native-svg-charts`) and a one-line ADR-0007 §8 resolution.
- **R3 — `expo-sharing` does not survive SDK 54.** Mitigation: BLG-0019 picks an equivalent share dep with `agent-safety-officer` review folded in; the contract on the Profile screen stays the same.
- **R4 — `@react-native-community/datetimepicker` not in SDK 54 matrix.** Mitigation: per DES-0004 §9, `mobile-builder` picks a small alternative with `agent-safety-officer` review folded into BLG-0019.
- **R5 — Encryption-stack behavioral change under SDK 54.** Mitigation: BLG-0016 acceptance bullet 5 round-trip test catches this; if it triggers, the upgrade blocks pending an ADR-0006 amendment (this is the right behavior — we don't break user data).
- **R6 — `notes` free-text PDF-injection.** Mitigation: ADR-0009 §4 sanitizer strips control characters before passing to `reportlab.platypus.Paragraph`.
- **R7 — RLS bypass via service-key client on the new write paths.** Mitigation: defense-in-depth `WHERE user_id = sub` on every UPDATE / SELECT in the new endpoints, identical to the ADR-0002 / ADR-0005 / ADR-0008 §3 pattern; 404 returned for both "not found" and "belongs to another user" (no enumeration).
- **R8 — Greek glyph regression in PDF.** Mitigation: contract test asserts Greek glyphs (`Πλατεία`, `αποδείξεις`, `ΦΠΑ`) appear in the generated PDF text stream.
- **R9 — Phone PII in error responses on `PATCH /users/me`.** Mitigation: response shape per DES-0004 §4 explicitly excludes `phone`; error envelope per ADR-0002 §6 strips Pydantic `input` field; only ΑΦΜ shape is echoed (and ΑΦΜ is the user's own input, not new data).
- **R10 — Telemetry leakage of category / notes / phone / ΑΦΜ.** Mitigation: telemetry events are counts only per DES-0004 §7 and DES-0005 §6; values are never attached.

## User direction (if `go` was used)

- Direction: `go` (no extra text).
- Honored in scope: yes — the sprint type is implementation per `AGENTS.md` §4.1.2 and `docs/plan.md`; sequence follows Strategy C from the plan with the forward-only encryption-round-trip variant explicitly named here. No extra direction was supplied so no backlog split is required.

## Definition of done

- `mobile/package.json` reflects the SDK 54 tree (exact pins, no carets), `mobile/package-lock.json` regenerated, `expo-doctor` clean.
- All four BLG-0016..0019 acceptance bullet sets met (see `docs/backlog.md` items at S-006 start).
- §4.11 sign-offs recorded in `S-006-REV-0001` for: new endpoint / API contract (BLG-0017 / 0018 / 0019), new mobile screen / UX flow (BLG-0017 / 0018 / 0019), user-data flow (BLG-0017 / 0018 / 0019), new runtime dependency (BLG-0016 + BLG-0019), schema migration (none — verified), auth flow change (none — verified), sprint scope change (none expected), adding / retiring an agent (none).
- `make check` green at sprint close (~250 tests; smoke check + new tests added by each BLG).
- `AGENTS.md` §2.6 + §2.7 reflect S-006 outcomes (Profile, freelancer toggle, ΑΦΜ field, tag-as-business, PDF export, SDK 54).
- `docs/plan.md` carries the S-006 close snapshot and queues S-007 (likely discovery — country expansion or BLG-0004 + BLG-0009 if consenting users have been recruited).
- `docs/done.md` has new sprint section with BLG-0016..0019 entries; `docs/backlog.md` no longer carries those four items.
- S-006 sprint folder contains `PLN`, `LOG`, `REV`, `UREV`.
