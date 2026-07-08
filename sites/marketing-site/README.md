# Marketing Site

Customer-facing Next.js site. Deployed on Cloudflare via OpenNext.

**Agent guide:** [AGENTS.md](./AGENTS.md)

```sh
bun run marketing-site:dev   # from monorepo root
```

Copy `.env.example` to `.env.local` before first run. See [docs/getting-started.md](../../docs/getting-started.md).

Deploy targets:

```sh
bun run --filter @repo/marketing-site deploy:staging
bun run --filter @repo/marketing-site deploy:production
```

Staging deploys run via GitHub Actions (push to `staging`) and serve on the account's workers.dev subdomain.

Production serves at https://talash.mahannankhan.info; the API base is https://api.mahannankhan.info.
