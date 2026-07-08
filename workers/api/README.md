# API Worker

Hono HTTP API on Cloudflare Workers (`@repo/api`).

**Agent guide:** [CLAUDE.md](./CLAUDE.md)

```sh
bun run api:dev          # from monorepo root → http://localhost:8787
bun run api:cf-typegen   # regenerate worker-configuration.d.ts
```

Copy `workers/api/.dev.vars.example` → `.dev.vars` before first run. Scalar API reference: `http://localhost:8787/api/docs` when dev is running.

See [docs/getting-started.md](../../docs/getting-started.md) and [docs/guides/api-query-repository-pattern.md](../../docs/guides/api-query-repository-pattern.md).
