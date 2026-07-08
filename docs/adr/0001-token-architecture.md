# Shared default tokens with a runtime override boundary

**Status:** accepted

Talash's design tokens are currently defined in ~6 places (2 web `globals.css`, 2 mobile `global.css`, 2 mobile `tokens.ts`), which will drift as the product grows. We will define each token **once** in a shared default source consumed by all surfaces, and apply per-tenant theme overrides at runtime via **NativeWind v5's `vars()`** API (and CSS custom properties on web). Components reference tokens by **semantic role** (`primary`, `on-primary`, `surface`) rather than raw scale (`green-600`) so that an override flows through without touching call sites.

## Considered options

- **Shared default + runtime override (chosen).** One default source; tenants override via `vars()`. Dedupes the values and supports white-label.
- **Per-app tokens + dependency injection.** Rejected: keeps the duplicated `tokens.ts`/`global.css` copies (injection can't unify build-time NativeWind classNames, and the apps' palettes are already identical), adding a provider layer that dedupes nothing.
- **Tokens buried in `@repo/ui-native`.** Rejected: web sites can't import a React Native package, so it would permanently foreclose web sharing the values.

## Consequences

- Brand colors must migrate from raw scale to semantic roles — ~61 `green-###` references today, 0 semantic.
- NativeWind v5 (`5.0.0-preview.4`) `vars()` is the override mechanism on mobile; classNames stay (they do **not** have to be rewritten to inline styles), provided brand classes map to overridable custom properties.
- This is the foundation the component consolidation (`@repo/ui-native`) and white-label theming are built on; it is sequenced first.
