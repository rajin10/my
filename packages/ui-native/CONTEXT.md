# Current task — `@repo/ui-native`

> Session brief for the shared **mobile** component library (Expo apps). Index: [CONTEXT-MAP.md](../../CONTEXT-MAP.md)

## What this package is

The mobile counterpart to `@repo/ui` (which serves the web apps). It holds
components shared by `apps/mobile-app` and `apps/owner-app`, consumes the shared
design tokens from `@repo/tokens`, and owns the single `cn` class-merge util.

Conventions (match `@repo/tokens` / `@repo/ui`):

- **No build step.** Ships TypeScript source; `main`/`types` → `src/index.ts`.
  "Builds" means it typechecks (`bun run --filter @repo/ui-native typecheck`)
  and is consumable by both Expo apps via Metro's workspace resolution.
- **peerDependencies** for app-provided runtime (`react`, `react-native`,
  `nativewind`, `lucide-react-native`) — never bundle a second copy. Direct
  deps: `clsx`, `tailwind-merge`, `class-variance-authority`, `@repo/tokens`.
  `nativewind` / `react-native-css` are also **devDependencies** so the package
  typechecks standalone (they provide the `className` augmentation via
  `nativewind-env.d.ts` → `react-native-css/types`).
- **`className`-driven (#63).** Components style via NativeWind `className`
  using semantic token classes (`bg-surface`, `bg-danger-bg`, …); colours that
  must be JS values (icon tints, initials) read from `@repo/tokens`. (The #62
  `Surface` smoke component predates this and still uses inline styles.)
- **Pure logic split out for node tests.** Each component `Foo.tsx` keeps its
  RN-free style logic (cva variant maps, size/colour maps, helpers) in
  `Foo.styles.ts`, unit-tested by `Foo.styles.test.ts` under node vitest
  (`include: ["src/**/*.test.ts"]`). The `.tsx` (imports `react-native`,
  `lucide-react-native`) is verified by typecheck + each app's build/smoke, not
  rendered here.

## Scope

**In**

- `packages/ui-native/src/` — shared components + `cn`.

**Out**

- App-specific screens (live in each app's `src/`).
- Moving existing app components here (#63) and broad adoption + per-app copy
  deletion (#64).

## Status (#62 — scaffold)

- [x] Package builds (typechecks) and is importable by both Expo apps
- [x] Consumes shared semantic tokens (`@repo/tokens`, from #53)
- [x] Shared `cn` lives here; both apps re-export it from `src/lib/cn.ts`
- [x] One trivial component (`Surface`) exported end-to-end as a smoke test
      — `cn` unit-tested here (node vitest); `Surface` render-smoked via
      owner-app's vitest-native harness (`ui-native-smoke.test.tsx`)

## Status (#63 — superset-merge)

Eight components merged as one canonical superset each, absorbing every feature
from both apps. All `*.styles.ts` logic is node-tested (55 assertions); the full
package typechecks and passes Biome.

| Component | Superset notes |
| --- | --- |
| `Icon` | owner's numeric `size` + `sizePx` over mobile's token-only sizes |
| `Button` | **danger split** (HITL): `danger` = filled high-emphasis (mobile), `dangerOutline` = outline low-emphasis (owner); new `loading` state (spinner replaces leading icon, non-interactive); `secondary`→`subtle` rename; owner's per-size `BUTTON_ICON_SIZE` |
| `Badge` / `StatusPill` | `neutral`→`default` rename; absorbs mobile's `info` auto-icon; StatusPill covers owner's `Sent`/`OutForDelivery`/`Delivered` + "Out for delivery" label |
| `Avatar` | owner's numeric `size` (font ≈ 38% of px) + per-size font scale |
| `Stars` | owner's numeric `size` + `sizePx` |
| `Card` | identical across apps; named-or-raw `pad` |
| `Switch` | unified cva name; keeps owner's `ToggleSwitch` alias; default `activeColor` = primary-600 |
| `SectionTitle` | absorbs owner's `count` pill; customer's 24px title unifies to the 20px canonical |

**Variant-name contract:** `subtle` (not `secondary`), `default` (not
`neutral`).

**Deferred — semantic token migration.** Components carry over raw primary-ramp
classes (`bg-primary-600`, `bg-primary-50`, `border-primary-200`,
`bg-primary-900`, `brand: bg-primary-50`) **verbatim** to keep #63 a
behaviour-preserving merge. These do not repaint under a tenant palette today,
and a button needs four primary shades the flat `bg-primary` role can't all
express. Migrating them to semantic roles (#54's remit) is a deliberate
follow-up, not done blind inside this merge. (`surface`, `line-strong`,
`danger-bg`, `info-bg`, etc. are already semantic.)

## Status (#64 — adoption)

Both apps now consume the 8 primitives from `@repo/ui-native` (their
`src/components/ui/index.ts` barrels re-export them; the per-app copies are
deleted). App-local components that used the primitives import them from
`@repo/ui-native` directly. Call-site migrations: `secondary`→`subtle`
(8 sites); owner `danger`→`dangerOutline` (2 sites in `MoreScreen`).

**Required infra — `@source`.** Each app's `src/global.css` adds
`@source "../../../packages/ui-native/src/**/*.{ts,tsx}";` so Tailwind/NativeWind
scans this package for `className` usage. Without it, classes used *only* here
(e.g. `bg-info-bg`, `bg-pending-bg`, `border-primary-200`, `bg-line-soft`,
`text-pending-fg`) would not be generated and those component states would lose
styling. Verified the at-risk classes are extracted by `@tailwindcss/oxide`'s
scanner from this glob; full repaint is device-smoke territory (NativeWind's
runtime cascade isn't exercised by the node/RNTL suites).

**Test harness note.** `Icon`/`Stars` `import * as Icons from
"lucide-react-native"`, whose ESM build trips vitest-native. owner-app's
`setup.ts` stubs those two leaf modules (by relative path) so lucide never loads;
Badge/StatusPill still render real label text. mobile-app's node suite never
imports the barrel, so it needs no stub.

## Status (#96 — identical-component consolidation)

Follow-up to #64 for the byte-identical copies left out of the named-8. Two
components lifted as straight moves (already identical across both apps); both
apps re-export them from their `src/components/ui/index.ts` barrels and the
per-app files are deleted. `@source` already covers them (no `global.css`
change). Package + both app suites green; package typecheck clean.

| Component | Notes |
| --- | --- |
| `Divider` | cva variant logic (`direction` × `strength`) extracted to `Divider.styles.ts`, node-tested |
| `Eyebrow` | RN-free className + base style + default tint (`Colors.primary600`) extracted to `Eyebrow.styles.ts`, node-tested |

**Collapsible — deleted, not lifted (HITL).** The issue listed a third
component, but `collapsible.tsx` was unused Expo starter boilerplate: zero call
sites, exported from neither app's barrel, and dependent on four **app-local**
`@/` modules (`themed-text`, `themed-view`, `constants/theme`, `hooks/use-theme`)
absent from this package. Lifting it would have forced dragging those (likely
drifted) modules in to host a component nothing renders, so both copies were
deleted instead — diverges from the issue's literal AC by user decision.

## Next

- Follow-up: semantic-token pass for the deferred raw primary-ramp classes.

## References

- [CONTEXT-MAP.md](../../CONTEXT-MAP.md)
- [packages/ui/CONTEXT.md](../ui/CONTEXT.md) — web sibling
