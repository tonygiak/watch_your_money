# Offline cache strategy + at-rest encryption

Status: accepted
Date: 2026-04-30
Chair: orchestrator
Participants: mobile-builder, security-privacy-officer, architect, engineering-manager, agent-safety-officer, qa, product-designer, localization-specialist
Co-signs required: security-privacy-officer + architect (auth/data-flow + engineering decision involving on-device financial data — `AGENTS.md` §4.11).

## Context

`AGENTS.md` §2.5 sets a "fast" quality bar; §5.7 says the mobile client must "cache receipts locally for offline viewing"; DES-0001 §"Telemetry" already accounts for `time_to_receipt_ms`. The user expectation is: once a receipt has been seen at least once, opening the app while offline (subway, low-signal area) shows the most recent receipts and lets the user open detail views. The **scanner remains online-only** by design — no offline scan queueing in the MVP (a scan needs a backend round-trip to `e-invoicing.gr` via the FastAPI service).

Three open questions gate BLG-0007:

1. **Storage substrate**: SQLite (`expo-sqlite`), AsyncStorage (`@react-native-async-storage/async-storage`), or in-memory only.
2. **Eviction & cap**: how many receipts and how do we age them out.
3. **At-rest encryption**: financial data on a mobile device + the `AGENTS.md` §2.4 "no bypass of user privacy" rule. Do we encrypt? With what key, kept where.

Constraints in scope:

- `AGENTS.md` §2.4 — country-agnostic, no third-party paid services beyond Supabase / Railway-Render / `e-invoicing.gr`.
- `AGENTS.md` §2.4 + §3.2.1 — secrets only via env (the *backend* env); on the device, secrets handled by the OS keystore.
- `AGENTS.md` §3.2.1 — supply-chain discipline; new runtime deps need ADR + `agent-safety-officer` + `engineering-manager` co-sign.
- `AGENTS.md` §5.5.3 — Greek-first UX, UTF-8 correctness end-to-end (so encoded blobs must round-trip Greek characters).
- `AGENTS.md` §5.7 — "cache receipts locally for offline viewing".
- ADR-0007 will pin the Expo runtime tree; this ADR's deps are part of that pinned set.

## Rounds

### Round 1

- **mobile-builder**: My default is **AsyncStorage** as the substrate + **`expo-secure-store`** for a per-install symmetric key (used to encrypt the AsyncStorage payload). Reasoning: (a) AsyncStorage is the smallest dep we already need for trivial preferences (e.g. last-language choice); (b) `expo-secure-store` is already part of the Expo SDK, no additional native module compilation; (c) we don't need SQL queries — the cache has one shape: "list of receipt JSON, indexed by id". Concern: AsyncStorage isn't designed for hundreds of MB; we cap the cache at ~200 receipts and drop `raw_html` from the cached payload to keep size predictable.
- **security-privacy-officer**: Encryption-at-rest is **non-negotiable** for financial data. Keychain (iOS) and Android Keystore (via `expo-secure-store`) are the right place for the key. Concerns: (1) what key derivation — random 256-bit on first launch, stored in `expo-secure-store`, never logged; (2) what cipher — AES-256-GCM (authenticated, prevents tamper); (3) what library — using a tiny, audited primitive matters; (4) what does `expo-secure-store` mean on Android emulators / rooted devices (key may fall back to encrypted SharedPreferences); we accept that the threat model excludes rooted devices and document it.
- **architect**: Strong agreement on AsyncStorage + `expo-secure-store`. SQLite is overkill for a "list of N receipts" cache and adds a non-trivial native dep. **Concern**: encryption introduces a dependency on a JS crypto library. The Web Crypto API (`crypto.subtle`) is **not** universally available in React Native without polyfills. Options: (a) `expo-crypto` (Expo's wrapper) — audited, official, but limited algorithms; (b) `react-native-aes-crypto` or `tweetnacl` — third-party. I prefer (a) if it supports AES-GCM. If it doesn't, we should re-evaluate before the implementation sprint rather than ship an unaudited primitive.
- **engineering-manager**: AsyncStorage + `expo-secure-store` is implementable in one delivery sprint. Encryption library has to be picked. **Concern**: every new dep is a supply-chain delta. I want this ADR to **list the exact pinned versions** that will land in `package.json`, with a default and an alternative. `agent-safety-officer` co-signs the actual versions.
- **agent-safety-officer**: From a runtime-security stance, the cache must NEVER store: (1) the Bearer JWT (lives only in `expo-secure-store` — that's a separate auth-token concern, not cache), (2) `raw_html` (parser-only, never reaches the client today and shouldn't be cached even if it did), (3) phone number, (4) any payment-method PAN-like string. Want this codified in the ADR. On dependency surface: AsyncStorage + `expo-secure-store` + an encryption library — that's three additions in `package.json`. I'll co-sign the specific versions in ADR-0007 (Expo runtime tree); this ADR's job is to lock the *contract* (substrate + encryption + cap + what's in the cache).
- **qa**: Test strategy: (1) `CacheRepository` interface (the same architectural pattern as `InsightsRepository` / `BaseReceiptParser`) with `InMemoryCacheRepository` for tests + `EncryptedAsyncStorageCacheRepository` for production. (2) Unit tests for the encrypt-then-decrypt round-trip with Greek characters in description fields (UTF-8 invariants). (3) Eviction tests (LRU vs FIFO behavior).
- **product-designer**: UX consideration: when the user is offline, the Home screen header should show a small Greek-first "Είστε εκτός σύνδεσης" banner so users understand the data may be stale. The Insights screen, which depends on aggregations the cache does NOT cover, displays a Greek-first empty state ("Διαθέσιμο όταν είστε online" / "Available when online"). Receipt detail offline: show the cached payload, but disable the "Tag as business expense" action (which writes to the backend) until the user is back online. Captured in DES-0003.
- **localization-specialist**: All offline strings under `mobile/src/i18n/strings.ts` keys `offline.*`. The "you are offline" banner needs Greek formal register matching the rest of the app: `Είστε εκτός σύνδεσης`.

### Round 2

- **mobile-builder** (responding to architect): I checked `expo-crypto` — it exposes `digest` / `getRandomBytesAsync` but **not** AES-GCM directly today. So we have two paths: (a) defer to `react-native-quick-crypto` (full Node-crypto API) but that's a heavier native module; (b) use a small audited JS lib like `@noble/ciphers` (zero deps, written in pure JS, used by the Ethereum ecosystem, AES-GCM available). I propose `@noble/ciphers` — pure JS, no native build step, single file, well-audited. `expo-crypto.getRandomBytesAsync` for the IV. Pinned versions go in ADR-0007.
- **security-privacy-officer** (responding to mobile-builder): `@noble/ciphers` is acceptable. It's a peer-reviewed implementation by Paul Miller, used by industry-grade JS wallets. I want the ADR to lock: (1) AES-256-GCM, (2) 96-bit random IV per encrypt, (3) IV is stored alongside the ciphertext (it's not secret), (4) the symmetric key is generated on first launch via `expo-crypto.getRandomBytesAsync(32)` and stored in `expo-secure-store` under a fixed key name, (5) on key loss (e.g. user clears app data), the cache is silently dropped — receipts are re-fetched on next online use, no PII is leaked. Codified.
- **architect** (responding): `@noble/ciphers` is a fine pick. It satisfies "tiny, audited, no native build". Pin a specific version in ADR-0007.
- **engineering-manager** (responding): With AsyncStorage + expo-secure-store + @noble/ciphers + expo-crypto, that's the dep set. ADR-0007 will pin all four.
- **agent-safety-officer** (responding to all): I'll check the four packages in `review-external-surface.md` while drafting ADR-0007. From a runtime-security stance, this is acceptable provided the supply-chain review passes. **Adding to scope of this ADR**: every cache write goes through a sanitizer that strips `raw_html` and any field not in the documented "cacheable subset" (defined in §5 below). The sanitizer is the security boundary.
- **qa** (responding): Confirming the sanitizer is a unit-testable function. I'll add tests for "field that should not be cached gets dropped silently" and "Greek characters round-trip via the encrypted blob".
- **product-designer** (responding): No new concerns.
- **localization-specialist** (responding): No new concerns.

### Round 3

- **mobile-builder**: No new concerns.
- **security-privacy-officer**: No new concerns.
- **architect**: No new concerns.
- **agent-safety-officer**: No new concerns.

No new concerns surfaced after Round 3. Closing.

## Decision

### 1. Substrate

- **AsyncStorage** (`@react-native-async-storage/async-storage`) for the cache blob.
- **`expo-secure-store`** for the AES-256-GCM symmetric key + the Supabase access/refresh tokens (already implied by ADR-0004; codified here).
- **Rejected**: SQLite (`expo-sqlite`) — overkill for a list-of-N cache and a heavier native dep.
- **Rejected**: in-memory-only — fails `AGENTS.md` §5.7 ("cache receipts locally for offline viewing"), which implies persistence across restarts.

### 2. Encryption-at-rest

- **Cipher**: AES-256-GCM via `@noble/ciphers`.
- **IV**: 96-bit random per encrypt, generated by `expo-crypto.getRandomBytesAsync(12)`.
- **Key**: 256-bit random, generated by `expo-crypto.getRandomBytesAsync(32)` on first launch, stored in `expo-secure-store` under the key name `wym.cache.aes-256-gcm.v1`.
- **Storage layout** in AsyncStorage:
  - One key per receipt: `wym.cache.receipt.<id>` → `{ "iv": "<base64>", "ct": "<base64>" }`.
  - One index key: `wym.cache.index` → `[{ "id": "<uuid>", "issue_date": "YYYY-MM-DD", "last_seen_at": "<iso>" }, …]` (encrypted with the same key).
  - One version key: `wym.cache.version` → `1` (un-encrypted, used to invalidate the cache on schema migrations).
- **Failure mode**: if `expo-secure-store` returns no key (e.g. user wiped app data or Keychain entry deleted), the cache is treated as empty: AsyncStorage is purged, a new key is generated, no error is shown to the user. The next online session re-populates the cache.
- **Threat model**: protects against casual file-system reads and lost-device scenarios; **does not** protect against a rooted/jailbroken device or a runtime-debuggable app build (we ship release builds with debug stripped). Documented in `.agents/context/`.

### 3. Eviction and cap

- **Cap**: 200 receipts.
- **Eviction policy**: **LRU** (least-recently-seen). `last_seen_at` is updated on every cache hit. When a write would push the count over 200, the oldest-by-`last_seen_at` is evicted.
- **TTL**: none for individual entries; the user explicitly never asked for "forget receipts after X days" and that would surprise users browsing old months.
- **Manual purge**: a "Καθαρισμός cache" button in the Profile screen wipes the cache (`AsyncStorage.multiRemove(...)` for the cache namespace). Future enhancement, captured in BLG follow-up but not blocking S-004.

### 4. Cache write trigger

- The cache is populated on three events:
  - **Successful scan**: response from `POST /receipts/parse` (both 201 and 200+`is_duplicate`) is sanitized (§5) and written.
  - **Receipt list load**: when Home fetches `/receipts` from Supabase via the anon-key + RLS path, results are sanitized and bulk-written.
  - **Receipt detail open**: refreshes `last_seen_at`.
- **No background sync** in the MVP. A future BLG can add periodic refresh.

### 5. Cacheable subset (sanitizer)

Only the following fields are written to the cache for each receipt. Anything else returned by the backend or by Supabase reads is dropped by the sanitizer **before** encryption:

- `id`
- `country_code`
- `merchant_name`, `merchant_afm`, `merchant_address`
- `document_number`, `mark`, `issue_date`, `transmission_timestamp`
- `payment_method`, `provider`
- `subtotal`, `discount`, `surcharge`, `total`, `net_value`, `vat_total` (decimal-as-string)
- `is_business_expense`, `business_category`, `notes`
- `created_at`
- `items[*]`: `id`, `ean`, `description`, `unit`, `quantity`, `unit_price`, `pre_discount_value`, `discount`, `vat_rate`, `total_value`, `inferred_category` (decimal-as-string for numeric fields)

Explicitly **never** cached:

- `raw_html` (server-only).
- The Bearer JWT or refresh token (those live in `expo-secure-store`, not in the cache layer).
- Any field added in the future without an explicit ADR sign-off (default-deny on cache).

### 6. Repository pattern

Storage layer mirrors ADR-0001 / ADR-0002 / ADR-0005:

- `mobile/src/cache/types.ts` — `CacheRepository` interface: `getById(id)`, `getList(limit)`, `put(receipt)`, `putMany(receipts)`, `clear()`.
- `mobile/src/cache/InMemoryCacheRepository.ts` — tests + local dev.
- `mobile/src/cache/EncryptedAsyncStorageCacheRepository.ts` — production. Wraps the AsyncStorage + `@noble/ciphers` + `expo-secure-store` flow.
- Screens (`HomeScreen`, `ReceiptDetailScreen`) consume the interface, never the concrete class.

### 7. Offline UX (companion DES-0003 + DES-0004)

- Home: small Greek-first banner "Είστε εκτός σύνδεσης" / "You are offline" when `NetInfo` reports no connectivity. Cached list shown.
- Receipt detail: cached data shown when offline; "Tag as business expense" disabled with tooltip "Διαθέσιμο όταν είστε online" / "Available when online".
- Insights: empty-state message (the cache does NOT cover aggregations).
- Scanner: disabled with Greek-first message "Σαρώστε όταν είστε online" / "Scan when online".
- All `offline.*` strings live in `mobile/src/i18n/strings.ts`.

### 8. Supply-chain summary (locked in ADR-0007)

The dep additions this ADR commits to (exact versions pinned in ADR-0007):

- `@react-native-async-storage/async-storage`
- `expo-secure-store`
- `@noble/ciphers`
- `expo-crypto` (likely already in the Expo runtime tree once ADR-0007 ships)

`agent-safety-officer` runs `review-external-surface.md` on this set inside ADR-0007.

### 9. Test strategy (BLG-0007 acceptance)

- **Round-trip**: encrypt a receipt with Greek characters → decrypt → assert byte-equality on every cacheable field.
- **Sanitizer**: write a receipt with extra fields → assert only the cacheable subset is encrypted; `raw_html` never reaches the storage layer.
- **LRU eviction**: write 201 receipts → assert the oldest-by-`last_seen_at` is dropped.
- **Key loss**: simulate `expo-secure-store` returning null on key-fetch → assert cache is purged, no error surfaced, next put generates a new key.
- **Offline UX**: render Home with `NetInfo.isConnected=false` → assert banner + disabled scanner FAB.

## Dissent

None recorded. All participants converged in Round 3.

## Consequences

**Positive:**

- BLG-0007 is **Ready**: S-004 implements the `CacheRepository` (in-memory + encrypted-AsyncStorage), the sanitizer, the LRU eviction, the key-management glue, and the offline UX states.
- Encryption-at-rest is real: AES-256-GCM with a Keychain/Keystore-backed key. Lost-device threat model genuinely mitigated.
- Repository pattern lets tests run without any native module — `InMemoryCacheRepository` covers the integration shape end-to-end.
- No new outbound surface; allowlist unchanged. New deps are local-only (no network calls).

**Negative:**

- Four new runtime deps land in `mobile/package.json` (`@react-native-async-storage/async-storage`, `expo-secure-store`, `@noble/ciphers`, `expo-crypto`). Each is reviewed in ADR-0007 by `agent-safety-officer`.
- Encryption costs CPU on every cache hit. Cap on cache size (200) + LRU keeps the working set small enough that this is invisible on modern devices; we record a perf note in the runbook.
- The `raw_html` field is intentionally **not** cached — opening a receipt offline shows fields parsed at scan time, not the original HTML. Acceptable trade.

**Follow-ups (added to backlog):**

- BLG-0007 acceptance bullets folded into the backlog item (this sprint).
- Future BLG: "Καθαρισμός cache" Profile-screen action (out of S-004 unless a concrete user need surfaces).
- Future BLG: background-sync refresh policy (out of MVP per `AGENTS.md` §2.9).
