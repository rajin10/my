# Design System

The shared visual language across Talash's surfaces: two Expo apps (`mobile-app`, `owner-app`), two Next.js sites (`marketing-site`, `business-dashboard`), and the shared `@repo/ui` (web) / planned `@repo/ui-native` (mobile) component libraries.

> **Status:** the token + white-label architecture below is **planned**, not yet built. It is the agreed target state from the design-system grilling session. Decisions are recorded as ADRs in [adr/](adr/). Current code still has per-app token copies and duplicated mobile components — see [Migration](#migration-state).

---

## Principles

1. **Consistency over creativity** — the system exists so the four surfaces don't reinvent the wheel.
2. **Flexibility within constraints** — components are composable; tenants theme within guardrails, not freely.
3. **One source of truth per value** — every token is defined once, consumed everywhere.
4. **Meaning-colors are not themeable** — `success`/`danger`/`pending`/`info` carry semantics and accessibility guarantees; tenants cannot override them.

---

## Token taxonomy

Tokens are referenced by **semantic role**, never by raw scale. Components use `bg-primary`, `text-on-primary`, `bg-surface` — **not** `bg-green-600`. This indirection is what lets a tenant theme override flow through at runtime (see [ADR-0001](adr/0001-token-architecture.md)).

| Role group | Examples | Themeable per tenant? |
| --- | --- | --- |
| **Brand** | `primary`, `primary-strong`, `on-primary`, the green ramp | ✅ Yes |
| **Accent** | `accent`, `on-accent` (gold) | ✅ Yes |
| **Surface tints** | `surface`, `paper`, `cream` (warmth) | ✅ A few |
| **Neutrals / structure** | `ink-*`, `line`, `line-strong`, `line-soft` | ❌ Static |
| **Semantic status** | `success`, `danger`, `pending`, `info` (+ `-bg`/`-fg`) | ❌ Static |
| **Radius / shadow / motion** | `radius-*`, `shadow-*`, `duration-*`, `ease-*` | ❌ Static |

Default token values are the Talash emerald/ink/gold palette currently in `tokens.ts` / `globals.css`. See [ADR-0002](adr/0002-themeable-scope-and-boundary.md) for why the split lands where it does.

### Role catalog

Defaults below are the current palette. **Themeable** roles map to overridable custom properties (a tenant override flows through `vars()`); **static** roles compile to literals.

#### Brand — themeable

| Role | Default | Was (raw scale) | Usage |
| --- | --- | --- | --- |
| `primary` | `#0e7c66` | `green-600` | Primary buttons, active brand fills |
| `primary-strong` | `#0b5c4b` | `green-700` | Primary hover / pressed |
| `primary-deep` | `#08362c` | `green-900` | Dark/inverse brand button, deep brand surfaces |
| `primary-soft` | `#f3f8f6` | `green-50` | Subtle-button background, tinted brand panels |
| `primary-muted` | `#e8f2ee` | `green-100` | Brand borders, soft fills |
| `on-primary` | `#ffffff` | (literal `#fff`) | Text/icon on any `primary*` fill |

Beyond the named roles above, the **full `primary-50…950` brand ramp** is a first-class part of the themeable token set (every step overridable per tenant) — it replaced the old fixed `green-*` palette. Use the named roles for the common cases and the numeric ramp (`primary-200`, `primary-500`…) for the remaining shades. The named roles are aliases of specific ramp steps (`primary` = `primary-600`, `primary-strong` = `primary-700`, `primary-deep` = `primary-900`, `primary-soft` = `primary-50`, `primary-muted` = `primary-100`).

#### Accent — themeable

| Role | Default | Was | Usage |
| --- | --- | --- | --- |
| `accent` | `#c9a063` | `gold-500` | Accent highlights, premium tags |
| `accent-strong` | `#9c7634` | `gold-700` | Accent hover / emphasis |
| `accent-soft` | `#f6eedc` | `gold-100` | Accent background |
| `on-accent` | `#14201c` | `ink-900` | Text on accent (dark — white fails AA on gold) |

#### Surface — themeable (a few tints)

| Role | Default | Usage |
| --- | --- | --- |
| `surface` | `#ffffff` | Cards, sheets, inputs |
| `paper` | `#fbfaf6` | App background |
| `cream` | `#f5f1e8` | Warm panels |

#### Neutral / structure — static (has light/dark variants)

| Role | Default (light) | Was | Usage |
| --- | --- | --- | --- |
| `ink` | `#14201c` | `ink-900` | Primary text |
| `ink-muted` | `#4a564f` | `ink-600` | Secondary text |
| `ink-subtle` | `#8a958f` | `ink-400` | Placeholder / tertiary |
| `line-strong` | `#d5dbd7` | — | Strong borders, control outlines |
| `line` | `#e4e8e5` | — | Default borders |
| `line-soft` | `#eef1ef` | — | Hairlines, dividers |
| `cream-deep` | `#ece5d5` | — | Static deep warm tint |

Dark mode overrides **only** this group + surfaces (per existing `DarkColors`). Light/dark is orthogonal to tenant theming.

**Web colour scheme (marketing-site + business-dashboard):** [`next-themes`](https://github.com/pacocoursey/next-themes) via `ColorSchemeProvider` in `@repo/ui` (`defaultTheme="system"`, `enableSystem`, `attribute="class"`, `storageKey="talash-theme"`). Users pick **System / Light / Dark** from `ColorSchemeToggle` in the header. Dark neutrals/surfaces apply when `.dark` is on `<html>` (`packages/tokens/src/dark.css`).

#### Semantic status — static

| Role | Fg / solid | `-bg` | `-fg` |
| --- | --- | --- | --- |
| `success` | `#149a7e` | `#e3f3ee` | `#0b5c4b` |
| `danger` | `#c0492f` | `#fae8e2` | `#8a2f1b` |
| `pending` | `#c98a1e` | `#faf0dc` | `#8a5e0f` |
| `info` | `#2e7d8c` | `#e2f0f2` | `#1b5560` |

#### Non-color — static

`radius-{xs:6, sm:10, md:14, lg:20, xl:28, full}` · `shadow-{xs,sm,md,lg,xl}` · `duration-{fast:140, normal:240, slow:420}ms` · `ease-{out, in-out}`.

### Raw-scale → semantic migration (done — #54)

The entire brand ramp was migrated from the fixed `green-*` palette to the themeable `primary-*` ramp (value-preserving, so zero visual change). The mapping was uniform and mechanical:

| Find | Replace |
| --- | --- |
| `{bg,text,border,fill,…}-green-<N>` (classes) | `…-primary-<N>` |
| `var(--color-green-<N>)` (CSS refs) | `var(--color-primary-<N>)` |
| `Colors.green<N>` (JS inline) | `Colors.primary<N>` |
| `--color-green-<N>` (token defs) | `--color-primary-<N>` |

All `green-*` was removed from `@repo/tokens`; a build check confirms `primary-*` utilities generate and **zero** `green-*` utilities remain. Status, `ink-*`, and `line-*` references were **not** touched — they stay static. Accent (`gold-*` → `accent-*`) is a separate follow-up.

> The earlier "61 refs" estimate undercounted — the real migration spanned ~560 references across every brand shade, which is why the full `primary-*` ramp (not just the 5 named roles) was promoted to themeable.

### Consumption forms

- **Web** — CSS custom properties in `@theme` (Tailwind v4); classNames resolve to `var(--color-*)`.
- **Mobile** — NativeWind v5 classNames for layout/color **plus** a JS token object for React Native inline styles. Both forms read the same default values; tenant overrides are applied via NativeWind's `vars()` at a theme boundary.

---

## White-label theming

Businesses supply their own brand colors; those colors render to customers inside a single business's context.

### Surface & boundary rules

| Surface | Theming |
| --- | --- |
| Owner app (a single owner's ops app) | Full business/owner brand |
| Customer app — home, search, My Bookings, account (**cross-business**) | Talash-neutral; business brand appears only as an **accent** (tag, logo, thin stripe) per item |
| Customer app — business detail + that business's booking flow (**single-tenant**) | **Full surface reskin** to the business's brand |

The rule: **full reskin requires a single, unambiguous tenant.** A list of businesses from many owners can never be one brand, so lists stay neutral with accents. See [ADR-0002](adr/0002-themeable-scope-and-boundary.md).

### Color safety

Businesses provide a **full custom palette** (primary, accent, foreground, surfaces). Because those colors render to customers, every palette is **contrast-validated against WCAG AA before save** — unreadable combinations are rejected or corrected at the owner-app input boundary, never at customer render time. See [ADR-0003](adr/0003-custom-palette-contrast.md).

### Data flow (cross-context dependency)

Business brand colors live on the **business record** (`@repo/core` schema), are delivered via the API, and are applied at the business-detail theme boundary in the client. This ties the design system to `packages/core` + `workers/api`, not just the UI packages — record the relationship in [CONTEXT-MAP.md](../CONTEXT-MAP.md) when the schema lands.

---

## Component contract

Shared components live in `@repo/ui` (web) and the planned `@repo/ui-native` (mobile). When merging the currently-duplicated mobile components, the canonical version is the **superset** of both apps' features; genuine design conflicts are resolved explicitly, not by silently picking a winner.

### Cross-platform variant names

One vocabulary across web and mobile. Resolved from the audit's naming drift:

| Concept | Canonical name | Retired aliases |
| --- | --- | --- |
| Tinted secondary button | `subtle` | `secondary` |
| Neutral badge | `default` | `neutral` |
| Destructive button | `danger` | — (resolve filled-vs-outline as one spec) |

Every interactive component must define: `default`, `hover`/`pressed`, `disabled`, and **`loading`** states. No current Button implements `loading` — close that gap during the merge.

---

## Migration state

Progress against the target state:

- **Token foundation (#53) — done.** Single shared `@repo/tokens` source (CSS `@theme` + JS object, drift-guarded by a sync test) replaced the ~6 duplicated palette copies; all four surfaces consume it.
- **Brand-ramp migration (#54) — done.** All brand color migrated from the fixed `green-*` palette to the themeable `primary-*` ramp; **0** raw `green-*` references remain.
- `@repo/ui` (web) is consolidated and consumed by both sites. ✅ Each site's `globals.css` must `@source` `packages/ui/src/**/*.{ts,tsx}` so Tailwind emits component utility classes.
- **Still open:** mobile has **no shared package** — `mobile-app` and `owner-app` each carry their own UI set with **8 of 11 same-named components drifted** (#62/#63). The Expo-default `constants/theme.ts` remains a stray. The `vars()` runtime override (#55) and white-label engine (#56–#61) are not yet built.

The agreed program builds the token + `vars()` + contrast architecture first, then merges components onto it ([ADR-0001](adr/0001-token-architecture.md), sequencing decision).
