# Themeable token scope and the theme boundary

**Status:** accepted

We restrict **which** tokens a tenant can override and **where** their brand renders.

**Scope — what's themeable:** the brand ramp, gold accent, and a few surface tints. Neutrals/structure (`ink-*`, `line*`) and semantic status (`success`/`danger`/`pending`/`info`) stay **static** across all tenants — status colors carry meaning and accessibility guarantees, and structural neutrals govern overall contrast.

**Boundary — where a brand renders:** full surface reskin requires a single, unambiguous tenant. The owner app is fully branded. In the customer app, cross-venue screens (home, search, My Bookings, account) stay Talash-neutral and show a venue's brand only as an **accent** (tag, logo, thin stripe); a venue's **brand fully reskins only inside that venue's detail + booking flow**.

## Why

A marketplace list shows venues from many owners — it can belong to no single brand, so it cannot reskin without becoming visual noise and dragging every card into per-tenant contrast validation. Anchoring full reskin to single-tenant contexts keeps lists scannable and Talash-identifiable while still giving each venue a strong identity where it matters.

## Consequences

- Only brand/accent/tint references migrate to semantic tokens; semantic-status classNames can stay static.
- Cross-venue components need a lightweight "venue accent" treatment distinct from full theming.
- The customer-facing reskin path inherits the contrast requirement in [ADR-0003](0003-custom-palette-contrast.md).

## Component theming — derived primary ramp (#97)

The shared `@repo/ui-native` Button/Badge needed **four** brand shades (fill, light-tint surface, tinted border, deep fill) that the single flat `bg-primary` role can't express. Decision (HITL, #97 — full coherent reskin):

- **Themeable component roles repaint per tenant:** Button `primary` fill → `bg-primary`; Button `subtle` → `bg-primary-soft` + `border-primary-muted` with `text-primary-strong`; Button `dark` → `bg-primary-deep`; Badge `brand` → `bg-primary-soft` + `text-primary-strong`. `ghost`/`danger`/`quiet` and all status badges stay on **static** roles (status colour carries meaning).
- **Derived ramp, one seed:** a tenant palette carries only `primary`, so the `soft`/`muted`/`strong`/`deep` steps are **derived** from it (`derivePrimaryTints` in `@repo/tokens`, deterministic sRGB mix). The derivation is the **single shared source** used by both the app render boundaries (`paletteToVars` adds the four `--color-primary-*` vars to `THEMEABLE_VARS`) and the API WCAG gate — so the colours a tenant sees are exactly the colours validated at save.
- **Gate extension (#59/ADR-0003):** `contrast.ts` validates two new rendered pairs from the derived ramp — `strong`-on-`soft` (subtle/brand text) and white-on-`deep` (dark button). A primary that passes white-on-primary is dark enough that the derived pairs comfortably pass; a failing palette is rejected at save.
- **RN icon-color limitation → neutral subtle icon:** theming cascades only through `className` (NativeWind `VariableContextProvider`), never a JS palette context (a deliberate rule). A lucide icon takes a JS `color` hex, so it **cannot** read a themed var on React Native. Text/bg/border repaint; icon colour stays static. To avoid a green icon on a brand-tinted `subtle` button, the `subtle`/`brand` icon is decoupled to **neutral ink** (text brand + icon neutral reads as intentional). Filled `primary`/`dark` keep white icons (`on-primary`, never themed). Press feedback for themed fills uses `activeOpacity` (dims the resolved colour) instead of a static darker-hex overlay.
- **Runtime caveat:** the `text-*`/`border-*` repaint rests on the same NativeWind cascade as the existing `bg-primary` boundary; it is verified by device/simulator smoke, not the (logic-only) unit suites.
- **Raw-ramp className refs migrated:** the Button/Badge brand variants (above) and `SectionTitle`'s action-link text (`text-primary-600` → `text-primary-strong`, which repaints and — being darker than `primary-600` — stays AA on `bg-paper`). No raw `primary-{50,200,600,900}` *className* remains in `@repo/ui-native`. The one residual in-set reference is `Switch`'s `activeColor` default (`Colors.primary600`) — a **JS colour prop**, not a className, so like a lucide icon's `color` it cannot read a themed var on RN; it stays a static default a consumer may override. (`Avatar`'s `Colors.primary100/700` defaults are the same JS-prop case but reference values outside the gated set.)
- **Web parity (#97 follow-up):** the same migration is mirrored on the web `@repo/ui` Button/Badge so venue theming actually reskins them — they previously consumed the **static numbered ramp** (`bg-primary-600`/`bg-primary-50`/…), which `BrandThemeBoundary` never overrides, leaving them inert under a tenant palette. Now: Button `primary` → `bg-primary` + `hover:bg-primary-strong` + `text-on-primary`; `subtle` → `bg-primary-soft` + `hover:bg-primary-muted` + `text-primary-strong`; `ghost` → `hover:bg-primary-soft`; `light` → `text-primary-deep`; `dark` → `bg-primary-deep` + `hover:bg-primary-deep/90` (the web analog of the RN press-opacity — dims the themed deep instead of jumping to a static `bg-black`); Badge `primary` → `bg-primary-soft` + `text-primary-strong` (dot → `bg-primary`). `danger`/`quiet`/status stay static. Unlike RN, web text/bg are pure CSS-var classes so no JS-colour-prop carve-out is needed. Because `@repo/ui` is shared, the never-themed `business-dashboard` sees a ~1-ramp-step shift on `subtle` bg/hover and `ghost` hover at the default palette (derived `soft`/`muted` ≠ exact `primary-50`/`100`); accepted for cross-platform consistency. Guarded by `sites/marketing-site/src/components/themeable-ui.test.ts` (variants must emit role tokens, never the numbered ramp). The `--color-on-primary` swap is parity-only — web `paletteToVars` does not expose it, so it resolves to the static white default today.
