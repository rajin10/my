# Business Dashboard

Owner-facing Next.js app for business operators. Deployed on Cloudflare via OpenNext.

**Agent guide:** [AGENTS.md](./AGENTS.md) — layout, hooks, conventions, onboarding.

```sh
bun run business-dashboard:dev   # from monorepo root
```

See [docs/getting-started.md](../../docs/getting-started.md) for full local setup.

Deploy targets:

```sh
bun run --filter @repo/business-dashboard deploy:staging
bun run --filter @repo/business-dashboard deploy:production
```
