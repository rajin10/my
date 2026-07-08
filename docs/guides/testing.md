# Testing Guide

## Running all tests

```sh
# From monorepo root — runs every package's test suite in parallel via turbo
bun run test
```

Each package also exposes individual scripts:

```sh
bun run --filter @repo/api test
bun run --filter @repo/queue test
bun run --filter @repo/scheduled test
bun run --filter @repo/core test
bun run --filter @repo/api-client test
bun run --filter @repo/business-dashboard test
bun run --filter @repo/marketing-site test
bun run --filter @repo/mobile-app test
bun run --filter @repo/owner-app test
bun run --filter @repo/cli test
```

---

## Package-by-package setup

| Package | Runner | Test location |
|---------|--------|---------------|
| `workers/api` | vitest | `src/__tests__/` |
| `workers/queue` | vitest | `src/__tests__/` |
| `workers/scheduled` | vitest | `src/__tests__/` |
| `packages/core` | vitest | `src/__tests__/` |
| `packages/api-client` | vitest | `src/__tests__/` |
| `sites/business-dashboard` | vitest + jsdom | `src/__tests__/` |
| `sites/marketing-site` | vitest + jsdom | `src/__tests__/` |
| `apps/mobile-app` | vitest | `src/__tests__/` |
| `apps/owner-app` | vitest | `src/__tests__/` |
| `tools/cli` | bun test | `__tests__/` |

### Why `bun test` for tools/cli

The CLI seeders import `bun:sqlite` directly. vitest runs in Node.js and cannot resolve `bun:sqlite`, so cli uses the native bun test runner instead.

---

## workers/api — two-layer architecture

This is the most complete test suite (~265 tests, 28 files — run `bun run --filter @repo/api test` for the current count). See below for patterns used across all workers.

### 1. Service unit tests

Test business logic directly. Repositories are passed as `vi.fn()` mocks — no HTTP, no DB.

```ts
// users.service.test.ts
const mockRepo = { findAll: vi.fn(), findOne: vi.fn(), create: vi.fn(), ... };
const svc = new UsersService(mockRepo as never);

it("throws NotFoundError when user not found", async () => {
  mockRepo.findOne.mockResolvedValue({ data: null });
  await expect(svc.get("missing")).rejects.toThrow(NotFoundError);
});
```

### 2. Route integration tests

Test the full HTTP request/response cycle using Hono's `app.request()`. Services are injected as mocks via `createTestApp`.

```ts
// users.routes.test.ts
const mockUsersService = { list: vi.fn(), get: vi.fn(), ... };
const app = createTestApp({ usersService: mockUsersService as never });

it("returns 200 with list", async () => {
  mockUsersService.list.mockResolvedValue({ data: [], query: {...} });
  const res = await app.request("/api/v1/users", {}, TEST_ENV);
  expect(res.status).toBe(200);
});
```

### Key helpers

**`createTestApp(services)`** — `workers/api/src/__tests__/helpers/create-test-app.ts`

Creates a test Hono app with all global middleware but replaces `injectServices` with mock services.

**`createTestToken(opts)`** / **`authHeader(token)`** — `workers/api/src/__tests__/helpers/auth.ts`

Generates signed JWTs for authenticated route tests. `TEST_ENV` is the fake env object. Default role is `"user"` — pass `{ role: "owner" }` etc. to override.

---

## Cloudflare worker packages (queue, scheduled, core)

All three share the same setup as `workers/api`:

- `vitest.config.ts` — aliases `cloudflare:workers` to a local stub and points at `setup.ts`
- `src/__tests__/mocks/cloudflare-workers.ts` — exports `env = {}` to prevent import errors
- `src/__tests__/setup.ts` — globally mocks `getDB()` from `@repo/core/src/database/client`

### Constructor mocks with vi.hoisted

When a handler instantiates a repository directly (`new BookingsRepository(db)`), the mock must be constructable. Use `vi.hoisted()` so the mock is available before module-level `vi.mock()` hoisting runs:

```ts
const { MockCouponsRepository, mockExpireOld } = vi.hoisted(() => {
  const mockExpireOld = vi.fn();
  const MockCouponsRepository = vi.fn(function (this: { expireOld: typeof mockExpireOld }) {
    this.expireOld = mockExpireOld;
  });
  return { MockCouponsRepository, mockExpireOld };
});

vi.mock("@repo/core/src/database/repositories/coupons.repository", () => ({
  CouponsRepository: MockCouponsRepository,
}));
```

**Important:** use `vi.clearAllMocks()` (not `vi.resetAllMocks()`) in `beforeEach`. `resetAllMocks` strips mock implementations, which breaks constructor mocks set up with `vi.fn(function() {...})`.

### Auto-mock + reinit pattern (simpler alternative)

For route tests where the handler calls `new SomeRepository(getDB())` directly, you can skip `vi.hoisted` and let `vi.mock()` auto-mock the module, then reinstall implementations each `beforeEach`:

```ts
vi.mock("@repo/core/src/database/repositories/favourites.repository");

import { FavouritesRepository } from "@repo/core/src/database/repositories/favourites.repository";

beforeEach(() => {
  vi.resetAllMocks(); // safe here because we reinit below
  vi.mocked(FavouritesRepository).mockImplementation(function () {
    return {
      findByUser: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
    };
  } as never);
});
```

Use this pattern when:
- The handler only calls the repo via `new Repo(getDB())` (no shared module-level instance)
- You want per-test default behaviour that individual tests can override with another `mockImplementation` call
- There's no service layer to inject through `createTestApp`

**Contrast with `vi.hoisted`:** hoisted mocks persist their implementation across the whole file unless `clearAllMocks` is called; the reinit pattern resets and reinstalls on every test, which is cleaner for route tests that override behaviour in individual cases.

---

## packages/api-client

Tests cover `ApiClient` in `src/__tests__/client.test.ts`. Key scenarios:

- GET request with/without Authorization header
- Query string parameter serialization (undefined params omitted)
- Error mapping (4xx/5xx → `ApiError` with `code`, `message`, `status`)
- 401 → token refresh → retry
- Concurrent 401s deduplicated to a single refresh call
- POST/PATCH/DELETE method and body handling

Uses `vi.stubGlobal("fetch", mockFetch)` to intercept fetch calls.

---

## sites (business-dashboard, marketing-site)

Both sites use vitest with jsdom environment and `@testing-library/react`.

**business-dashboard** tests cover pure adapter functions in `src/lib/adapters.ts` (`formatDate`, `adaptBooking`, `adaptReview`, `adaptCoupon`) — no React rendering needed for these.

**marketing-site** tests include a component test for `Stars` using React Testing Library.

vitest.config.ts uses `@vitejs/plugin-react` and sets `environment: "jsdom"`. The `@` alias resolves to `./src`.

---

## apps (mobile-app, owner-app)

Both apps use vitest with node environment, mocking `expo-secure-store` in the global setup file.

Tests cover `tokenStore` — verifying that `getAccessToken`, `getRefreshToken`, `setTokens`, and `clearTokens` delegate to the correct SecureStore keys.

The mock is defined in `src/__tests__/setup.ts`:

```ts
vi.mock("expo-secure-store", () => ({
  getItem: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
```

---

## tools/cli

Tests cover the factory modules in `__tests__/factories.test.ts` using `bun test`. Factories are pure faker — no DB, no seeders, no bun:sqlite imports.

---

## Adding tests for a new module (workers/api)

1. Create `src/__tests__/modules/<name>/<name>.service.test.ts` — mock repo constructor args, test each method
2. Create `src/__tests__/modules/<name>/<name>.routes.test.ts` — call `createTestApp({ <name>Service: mockService })`, test each endpoint
3. Register the new app in `src/__tests__/helpers/create-test-app.ts` so route tests can reach it
4. If the route handler instantiates repositories directly (no service layer), use the auto-mock + reinit pattern rather than `createTestApp` service injection — see "Auto-mock + reinit" above

### Test checklist per endpoint

| Scenario | Expected |
|----------|----------|
| Success (2xx) | ✓ |
| Missing/invalid auth | 401 |
| Insufficient role | 403 |
| Resource not found | 404 |
| Ownership conflict | 403 |
| Business conflict | 409 |
| Missing required fields | 400 |

---

## File structure

```
workers/api/
  vitest.config.ts
  src/__tests__/
    setup.ts
    mocks/cloudflare-workers.ts
    helpers/auth.ts
    helpers/create-test-app.ts
    modules/<name>/<name>.service.test.ts
    modules/<name>/<name>.routes.test.ts

workers/queue/
  vitest.config.ts
  src/__tests__/setup.ts
  src/__tests__/mocks/cloudflare-workers.ts
  src/__tests__/handler.test.ts

workers/scheduled/
  vitest.config.ts
  src/__tests__/setup.ts
  src/__tests__/mocks/cloudflare-workers.ts
  src/__tests__/handler.test.ts

packages/core/
  vitest.config.ts
  src/__tests__/setup.ts
  src/__tests__/mocks/cloudflare-workers.ts
  src/__tests__/rewards.service.test.ts

packages/api-client/
  vitest.config.ts
  src/__tests__/client.test.ts

sites/business-dashboard/
  vitest.config.ts
  src/__tests__/setup.ts          # imports @testing-library/jest-dom
  src/__tests__/adapters.test.ts

sites/marketing-site/
  vitest.config.ts
  src/__tests__/setup.ts
  src/__tests__/Stars.test.tsx

apps/mobile-app/
  vitest.config.ts
  src/__tests__/setup.ts          # mocks expo-secure-store
  src/__tests__/token-store.test.ts

apps/owner-app/
  vitest.config.ts
  src/__tests__/setup.ts
  src/__tests__/token-store.test.ts

tools/cli/
  __tests__/factories.test.ts     # bun test (no vitest.config.ts needed)
```
