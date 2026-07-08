# Current task — `@repo/auth-service`

> Session brief for this worker. Stable rules: [CLAUDE.md](./CLAUDE.md) · Index: [CONTEXT-MAP.md](../../CONTEXT-MAP.md)

## Goal

_[Auth routes, users module, internal authorise, or gateway integration change?]_

## Scope

**In**

- _[`workers/auth-service/src/` modules]_

**Out**

- _[Domain modules in `workers/api` unless gateway proxy / binding change]_

## Status

- [ ] _Implementation_
- [ ] Route tests (`bun run --filter @repo/auth-service test`)
- [ ] [api-endpoints.md](../../docs/guides/api-endpoints.md) if public routes changed
- [ ] [workers/api/CLAUDE.md](../api/CLAUDE.md) if gateway proxy or `AUTH_SERVICE` binding changed

## References

- [CLAUDE.md](./CLAUDE.md)
- [docs/superpowers/specs/2026-06-16-auth-service-split-design.md](../../docs/superpowers/specs/2026-06-16-auth-service-split-design.md)
- [docs/guides/api-endpoints.md](../../docs/guides/api-endpoints.md)
