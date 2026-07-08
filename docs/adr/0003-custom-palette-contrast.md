# Full custom venue palettes with mandatory contrast enforcement

**Status:** accepted

Venues may supply a **full custom palette** — primary, accent, foreground, and surface colors chosen individually — rather than picking from curated presets or a single seed color. Because these colors reskin the booking flow **for customers**, every palette is **validated against WCAG AA contrast before it is saved**, at the owner-app input boundary. Unreadable combinations are rejected or auto-corrected at save time; the customer render path always receives a palette already known to be readable.

## Considered options

- **One brand color + auto-derived ramp/foreground (recommended during design, not chosen).** Owner picks one hex; the system derives the ramp and `on-primary` and gates on AA. Lower contrast risk and less owner effort, but constrains brand expression.
- **Curated preset themes.** Pre-validated, zero risk, but many venues share a look.
- **Full custom palette (chosen).** Maximum venue identity; accepts the obligation to contrast-validate every owner-supplied combination.

## Consequences

- A contrast-validation step (WCAG AA) is **required**, not optional, in the owner-app theming UI — this is non-trivial work and a release gate for the white-label feature.
- Validation lives at **save time** (owner side), never at customer render time, so customers never see an unreadable screen.
- The venue palette is stored on the venue record and must round-trip through `@repo/core` schema and the API.
