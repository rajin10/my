# Context map

Index of per-package session briefs for Cursor agents. Attach **`@CONTEXT-MAP.md`** to pick the right scope, then **`@<path>/CONTEXT.md`** for the package you are working in.

Stable conventions live in **`AGENTS.md`** / **`CLAUDE.md`** — do not duplicate them in `CONTEXT.md` files.

---

## How to use

1. Open **`CONTEXT-MAP.md`** (this file) to see which package owns your task.
2. Attach that package's **`CONTEXT.md`** in chat (e.g. `@workers/api/CONTEXT.md`).
3. Update only that package's `CONTEXT.md` as the task evolves.
4. Clear or replace sections when you switch tasks.

**Root monorepo work** (CI, turbo, cross-package refactors): use [docs/CONTEXT.md](docs/CONTEXT.md).

---

## Packages

| Path | Package | Session brief | Stable guide |
| --- | --- | --- | --- |
| `packages/core` | `@repo/core` | [CONTEXT.md](packages/core/CONTEXT.md) | [CLAUDE.md](packages/core/CLAUDE.md) |
| `packages/api-client` | `@repo/api-client` | [CONTEXT.md](packages/api-client/CONTEXT.md) | [docs/guides/api-endpoints.md](docs/guides/api-endpoints.md) |
| `packages/ui` | `@repo/ui` | [CONTEXT.md](packages/ui/CONTEXT.md) | — |
| `packages/ui-native` | `@repo/ui-native` | [CONTEXT.md](packages/ui-native/CONTEXT.md) | — |
| `workers/api` | `@repo/api` | [CONTEXT.md](workers/api/CONTEXT.md) | [CLAUDE.md](workers/api/CLAUDE.md) |
| `workers/auth-service` | `@repo/auth-service` | [CONTEXT.md](workers/auth-service/CONTEXT.md) | [CLAUDE.md](workers/auth-service/CLAUDE.md) |
| `workers/queue` | `@repo/queue` | [CONTEXT.md](workers/queue/CONTEXT.md) | [CLAUDE.md](workers/queue/CLAUDE.md) |
| `workers/scheduled` | `@repo/scheduled` | [CONTEXT.md](workers/scheduled/CONTEXT.md) | [CLAUDE.md](workers/scheduled/CLAUDE.md) |
| `apps/mobile-app` | `@repo/mobile-app` | [CONTEXT.md](apps/mobile-app/CONTEXT.md) | [AGENTS.md](apps/mobile-app/AGENTS.md) |
| `apps/owner-app` | `owner-app` | [CONTEXT.md](apps/owner-app/CONTEXT.md) | [AGENTS.md](apps/owner-app/AGENTS.md) |
| `sites/marketing-site` | `@repo/marketing-site` | [CONTEXT.md](sites/marketing-site/CONTEXT.md) | [AGENTS.md](sites/marketing-site/AGENTS.md) |
| `sites/business-dashboard` | `@repo/business-dashboard` | [CONTEXT.md](sites/business-dashboard/CONTEXT.md) | [AGENTS.md](sites/business-dashboard/AGENTS.md) |
| `tools/cli` | CLI | [CONTEXT.md](tools/cli/CONTEXT.md) | [docs/guides/cli.md](docs/guides/cli.md) |
| `docs` | Documentation | [CONTEXT.md](docs/CONTEXT.md) | [docs/README.md](docs/README.md) |

---

## Shared references

- [AGENTS.md](AGENTS.md) — monorepo layout, commands, doc policy
- [docs/getting-started.md](docs/getting-started.md) — local setup
- [docs/architecture.md](docs/architecture.md) — system overview
- [docs/guides/contributing.md](docs/guides/contributing.md) — PR checklist
