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

Staging deploys run via GitHub Actions (push to `staging`) and serve on the account's workers.dev subdomain.

Production serves at https://business.mahannankhan.info; the API base is https://api.mahannankhan.info.
