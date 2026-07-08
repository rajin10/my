# Documentation Hub

Project conventions and implementation guides. Read these on demand — linked from [AGENTS.md](../AGENTS.md) and app-level guides.

**New here?** Start with [getting-started.md](getting-started.md) · [architecture.md](architecture.md)

---

## Guides

### Overview

- [Architecture](architecture.md) — monorepo layout, request/queue flow, Cloudflare bindings
- [API endpoint index](guides/api-endpoints.md) — all `/api/v1` routes + api-client methods
- [Architecture decisions (ADRs)](adr/) — recorded design decisions; see [ADR-0004 — multi-vertical platform extension](adr/0004-multi-vertical-platform-extension.md) for adding non-booking business types (e.g. LPG delivery)

### Backend

- [API Query + Repository Pattern](guides/api-query-repository-pattern.md) — global query parsing, BaseQueryDto, BaseRepository, soft-delete, adding new modules
- [Auth service worker](../workers/auth-service/CLAUDE.md) — identity + authz split, gateway proxy, `/internal/authorise`
- [Google Auth](guides/google-auth.md) — Google OAuth setup, server-side redirect flow, env vars
- [Email / password auth](guides/email-password-auth.md) — register, login, forgot/reset password
- [Testing](guides/testing.md) — vitest setup, service unit + route integration tests, `createTestApp`, JWT helpers

### Frontend

- [UI ↔ Backend Sync](guides/ui-backend-sync.md) — `@repo/api-client` + TanStack Query layering, cache rules, uploads, adapters
- [Mobile offline](guides/mobile-offline.md) — TanStack Query persistence, mutation outbox, offline UX for both Expo apps
- [Design System](design-system.md) — token taxonomy, white-label theming scope/boundary, component contract (target state; decisions in [adr/](adr/))
- [Feature Map](feature-map.md) — backend ↔ frontend coverage per module; highlights missing integrations (❌ gaps)
- [Responsive Layout](guides/responsive-layout.md) — `useLayout` hook, `ScreenContainer`, tablet sidebar, landscape support

### Tooling & ops

- [Local dev workflow](guides/local-dev.md) — `dev:setup` wizard + `dev:all` orchestrator
- [Contributing](guides/contributing.md) — PR workflow, verification checklist, what docs to update
- [Environment variables](guides/environment-variables.md) — all env vars by package, local vs production
- [CLI Reference](guides/cli.md) — db seed/fresh/status commands, adding a seeder for a new table
- [CI / CD](guides/ci-cd.md) — GitHub Actions workflow, required secrets, path coverage, adding a new deployable package
- [EAS Deployment](guides/eas-deployment.md) — EAS Build profiles, Google Play submission, OTA updates, first-time setup checklist

---

## Plans & history

| Doc | Purpose |
| --- | --- |
| [guides/ui-backend-sync.md](guides/ui-backend-sync.md) | **Living** frontend ↔ API wiring conventions |
| [plan/rewards-loyalty-design.md](plan/rewards-loyalty-design.md) | Per-business rewards config — **not yet implemented** |
| [plan/multi-vertical-schema-design.md](plan/multi-vertical-schema-design.md) | Drizzle/D1 schema + migrations for [ADR-0004](adr/0004-multi-vertical-platform-extension.md) (business rename + LPG commerce) — **design, not yet implemented** |
| [superpowers/specs/2026-06-16-auth-service-split-design.md](superpowers/specs/2026-06-16-auth-service-split-design.md) | Auth-service worker split — **implemented on `develop`** |
| [superpowers/specs/2026-06-16-booking-service-split-design.md](superpowers/specs/2026-06-16-booking-service-split-design.md) | Booking-service worker split — **approved, not yet implemented** |
| [history/ui-backend-sync-rollout.md](history/ui-backend-sync-rollout.md) | Archived web sync rollout (complete) |
| [history/mobile-backend-sync-rollout.md](history/mobile-backend-sync-rollout.md) | Archived mobile sync rollout (complete) |
| [history/2026-06-sprint.md](history/2026-06-sprint.md) | June 2026 API modules, audit fixes, UX changelog |

---

## Reference

| Doc | Purpose |
| --- | --- |
| [CONTEXT-MAP.md](../CONTEXT-MAP.md) | Index of per-package `CONTEXT.md` session briefs for Cursor |
| [customers.md](customers.md) | End-user guide — customers (Google sign-in, booking, rewards) |
| [business-owners.md](business-owners.md) | End-user guide — business owners and managers |

### App-level guides

- [apps/mobile-app/AGENTS.md](../apps/mobile-app/AGENTS.md) — customer Expo app
- [apps/owner-app/AGENTS.md](../apps/owner-app/AGENTS.md) — owner Expo app
- [sites/marketing-site/AGENTS.md](../sites/marketing-site/AGENTS.md) — customer Next.js site
- [sites/business-dashboard/AGENTS.md](../sites/business-dashboard/AGENTS.md) — owner Next.js dashboard

