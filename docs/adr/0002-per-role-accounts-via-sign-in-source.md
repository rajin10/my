# Per-role accounts selected by a client-declared sign-in source

- **Status:** accepted
- **Date:** 2026-06-08
- **Scope:** `workers/api` auth + `packages/core` users schema; consumed by all four clients

## Decision

A single Google identity backs **one Talash account per role**, not one account with
many roles. The `users` unique indexes are scoped per-role — `(email, role)`,
`(phone, role)`, `(googleId, role)` (migration `0010_per_role_user_identifiers`) — so
the same Gmail can hold a customer `user` account and a business `owner` account as two
separate rows. Customer-facing and business-facing data stay cleanly separated.

Which role a sign-in touches is chosen by a **client-declared `source`** field on the
Google sign-in endpoints (`POST /auth/google/token`, `GET /auth/google`). The
`source → role` map (`modules/auth/sign-in-source.ts`):

| source | role |
| --- | --- |
| `marketing-site` | `user` |
| `mobile-app` | `user` |
| `business-app` | `owner` |

Four rules govern it:

1. **`source` is client-declared, not server-inferred.** Inferring from `Origin` /
   `redirect_uri` is brittle (shared domains, native custom-scheme redirects,
   localhost). The client states its own source.
2. **The trust boundary is the invariant that `source` may only ever map to a
   self-service role (`user` / `owner`).** Both are open to anyone already — the
   business-dashboard lets any visitor become an owner; an owner account owns nothing
   until `assertVenueOwner` is satisfied by actually creating a venue. So a client
   choosing its own role is *not* privilege escalation. Privileged roles
   (`moderator` / `manager` / `staff`) are granted **only** server-side via team
   assignment and must never be reachable from a `source`. A test pins this so adding
   e.g. `admin-app → moderator` — which would turn client-declared `source` into a
   privesc vector — fails loudly.
3. **`source` is optional and defaults to the least-privileged role (`user`).** An
   omitted `source` can therefore only ever *under*-provision. The one failure mode —
   a business client forgetting to send `business-app` — fails loud and immediate
   (`createVenue` → 403), never silently mints an owner. A regression test pins the
   default so nobody "tidies" `DEFAULT_SIGN_IN_SOURCE` to a privileged source and
   inverts the safe direction.
4. **Cross-role sign-in is intentional, not an error.** A customer who signs in on the
   business-dashboard deliberately gets a new empty `owner` account; the system does
   no cross-role lookup to detect "you already have an account under another role" —
   that would reintroduce the cross-role coupling the per-role indexes remove. The
   rare confused-customer case is handled in product UX (an onboarding escape hatch),
   not in the auth layer.

`source` is **transient** — it selects the role in `findOrCreateUserByGoogle` and is
then discarded. It is not persisted as account provenance; `marketing-site` vs
`mobile-app` (both `user`) exist only as self-documenting call-site values.

## Considered options

- **One user row, multiple roles.** Rejected: mixes customer and business data under
  one identity; per-role separation is the product requirement.
- **Server-infers `source` from `Origin` / `redirect_uri`.** Rejected: brittle across
  shared domains, native redirects, and localhost.
- **Require `source` (reject when absent).** Rejected: no client sends it today, so
  requiring it 400s every sign-in across four independently-deployed clients until a
  lockstep update lands. The least-privileged default removes the need.
- **Persist `source` as a `signupSource` column.** Deferred (YAGNI): add it when
  analytics/support actually needs front-door attribution, as its own decision.

## Consequences

- Every client must send `source` explicitly (the server default is a safety net, not
  a client contract) so a future change to `DEFAULT_SIGN_IN_SOURCE` can't silently
  flip a client's role.
- The `source → role` map is the single privilege-granting surface for sign-in; its
  self-service-only invariant must be test-enforced, not assumed.
- Cross-role users have independent profiles, photos, and history per role by design.
