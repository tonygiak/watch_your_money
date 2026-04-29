# Skill: add-screen

Add a new React Native screen that follows our conventions and ships with tests. Used by `mobile-builder`.

## Inputs

- A Ready backlog item with `DES` (design spec) link.
- The screen name and route.

## Outputs

- A screen component under `mobile/src/screens/`.
- Localized strings in `mobile/src/lib/i18n.ts`.
- Tests under `mobile/__tests__/screens/`.

## Procedure

1. **Read the `DES`** from the backlog item. If missing, escalate to `product-designer`; do not invent UX.
2. **Create the screen** in `mobile/src/screens/<Name>Screen.tsx` as a functional component.
3. **Wire navigation** in `mobile/src/navigation/` (or `App.tsx` while navigation is bootstrapping).
4. **Use formatting helpers** for every amount and date (`mobile/src/lib/format.ts`). Never inline `${amount}€` or `Date.toString()`.
5. **Use i18n** for every user-facing string. Add Greek + English keys.
6. **Use the Supabase anon client** via `mobile/src/lib/supabase.ts`. Never the service key on device.
7. **Write tests** under `mobile/__tests__/screens/<Name>Screen.test.tsx`:
   - it renders without crashing,
   - it displays the localized title in Greek by default,
   - any acceptance criterion from the backlog item.
8. **Run `make check`** locally; fix red.

## Required sign-offs

Per `AGENTS.md` §4.11: new mobile screen → `product-designer` + `localization-specialist`.

## Gotchas

- Accessibility: include `accessibilityLabel`, dynamic font scaling, sufficient contrast.
- Strings must round-trip Greek UTF-8 through tests.
