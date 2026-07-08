# Current task — `@repo/ui`

> Session brief for shared UI components. Index: [CONTEXT-MAP.md](../../CONTEXT-MAP.md)

## Goal

_[New shared component or variant for web apps?]_

## Scope

**In**

- _[`packages/ui/src/`]_

**Out**

- _[app-specific screens unless consuming the component]_

## Status

- [ ] _Component_
- [ ] Consumers updated (marketing-site, business-dashboard)

## Colour scheme (web sites)

- [`next-themes`](https://github.com/pacocoursey/next-themes): `ColorSchemeProvider` + `ColorSchemeToggle` (system default / light / dark).
- Root `layout.tsx` needs `suppressHydrationWarning` on `<html>`.
- Dark token overrides: `@import` `packages/tokens/src/dark.css` in each site's `globals.css`.

## Tailwind `@source` (required)

Each Next.js site's `src/app/globals.css` must register this package so Tailwind v4
scans component `className` strings (including CVA variants):

```css
@source "../../../../packages/ui/src/**/*.{ts,tsx}";
```

Without it, utilities used only here — e.g. `bg-primary-600`, `ring-line-strong`,
`duration-fast` on `Button` — are not emitted and shared components render unstyled.

## References

- [CONTEXT-MAP.md](../../CONTEXT-MAP.md)
- [docs/design-system.md](../../docs/design-system.md)
