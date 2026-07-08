# F2 — Authorization Guard (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce one shared `AuthorizationService` that owns every ownership-resolution chain (resource → owning venue → owner) and the branch-scope rule, and migrate the `services` module to use it — proving the API before the remaining modules follow.

**Architecture:** Today each service hand-rolls ownership (`venue.ownerId !== actorId`) and branch-scope (`scopedBranchIds.includes(branchId)`) checks under different names (`assertAccess`, `assertOwnership`, inline). This plan extracts those into one injected guard with small composable methods, verified by characterization tests that run the real service → real repository → in-memory SQLite and assert the 403/404 contract — the same tests pass before and after the refactor, proving behavior preservation.

**Tech Stack:** TypeScript, Hono, Drizzle ORM (SQLite), Vitest (node), better-sqlite3 (test-only).

---

## Background & Context (read before starting)

- **PRD:** GitHub issue #26 (part of backbone-hardening epic #23). Read it for the full finding.
- **The two patterns being consolidated** (in `workers/api/src/modules/*/*.service.ts`):
  1. **Owner-ownership** — resolve a resource up to its owning venue, compare `ownerId`: `venues` (direct), `branches` (branch→venue), `coupons` (coupon→venue), `reviews` (review→venue), `team` (member→venue, `assertOwnership`).
  2. **Branch-scope** — `services` (`assertAccess`) and `bookings`: if `scopedBranchIds !== null` (manager/staff) require branch membership; else (owner) resolve branch→venue→owner.
  3. **Customer-ownership** (bookings only) — `booking.userId !== userId`. The guard supports this shape but no module is migrated to it in this phase.
- **Error contract (preserved):** resource missing → `404` (`NotFoundError`); found but not owned / out of scope → `403` (`ForbiddenError`). Both classes are in `workers/api/src/core/errors.ts`.
- **Repos:** every repository exposes `findOne(id): Promise<{ data: T | null }>` (verified for venues, branches, services, coupons, reviews, bookings, team). The guard uses `findOne` uniformly. The shared repos are already constructed in `workers/api/src/middleware/services.ts` (`injectServices`).
- **DB harness facts (validated against the real migrations):** replaying `workers/api/src/database/migrations/*.sql` into an in-memory SQLite DB creates all 19 tables cleanly. **The timestamp column is `createdAt` (camelCase)** — the `timestamps()` helper uses `text()` with no explicit name, so the JS key is the column name. Seed via Drizzle (`db.insert(schema).values({...})`) using **camelCase keys**; Drizzle maps them to the real column names.
- **Required (NOT NULL, no default) columns** — needed for valid seed rows (camelCase keys shown):
  - venues: `id, name, category, city, ownerId, createdAt`
  - branches: `id, venueId, name, address, city, createdAt`
  - services: `id, branchId, name, category, duration, price, createdAt`

### Decisions (locked)

1. **Guard methods that resolve a resource return it** (so callers don't re-`findOne`). Parent-assertions return the parent (`assertVenueOwner` → venue) or `void` (`assertBranchAccess`).
2. **Branch-scope path trusts `scopedBranchIds`** (no extra branch-existence/venue check) — exactly matching current `assertAccess` behavior.
3. **Error messages are normalized** to consistent strings. This is intentional and is **not** byte-identical to today (some current code throws a bare `ForbiddenError()` with no message). Status codes are preserved; only message text may change. Update any test asserting on message text.
4. **Phase scope:** guard + `services` migration only. Out of scope here: bookings/branches/coupons/team/reviews migrations and `requireRole`/`requireVenueStaff` convergence (separate follow-up plans).

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `workers/api/src/__tests__/helpers/test-db.ts` | In-memory SQLite drizzle factory (shared with F1) | Create if absent |
| `workers/api/src/__tests__/helpers/seed.ts` | Seed a venue→branch→service ownership chain for tests | Create |
| `workers/api/src/core/authorization.ts` | `AuthorizationService` — all ownership/scope resolution | Create |
| `workers/api/src/__tests__/core/authorization.test.ts` | Guard behavior tests (real DB) | Create |
| `workers/api/src/middleware/services.ts` | Construct + inject `AuthorizationService`; rewire `servicesService` | Modify |
| `workers/api/src/types.ts` | Add `authz` to context var types (if services are surfaced on context) | Modify if needed |
| `workers/api/src/modules/services/services.service.ts` | Use the guard; drop `assertAccess`, `branchesRepo`, `venuesRepo` | Modify |
| `workers/api/src/__tests__/modules/services/services.service.test.ts` | Characterization tests (cross-owner/out-of-scope/missing) | Create |
| `docs/guides/api-query-repository-pattern.md` | Document the authorization guard pattern | Modify |

---

## Task 1: In-memory DB harness + chain seed helper

**Files:**
- Create (if absent): `workers/api/src/__tests__/helpers/test-db.ts`
- Create: `workers/api/src/__tests__/helpers/seed.ts`
- Test (smoke): `workers/api/src/__tests__/helpers/seed.smoke.test.ts`

- [ ] **Step 1: Ensure `better-sqlite3` is installed (dev)**

If the F1 plan already added it, skip. Otherwise run from repo root:

```bash
bun add --cwd workers/api --dev better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 2: Ensure the harness exists**

If `workers/api/src/__tests__/helpers/test-db.ts` already exists (from F1), leave it. Otherwise create it:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@repo/core/src/database/schema";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const MIGRATIONS_DIR = fileURLToPath(
	new URL("../../database/migrations", import.meta.url),
);

/**
 * Fresh in-memory SQLite DB with the full schema applied by replaying the
 * drizzle migration SQL files. Foreign keys are OFF (better-sqlite3 default),
 * so a single chain can be seeded without populating unrelated tables.
 */
export function createTestDb() {
	const sqlite = new Database(":memory:");
	const files = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort();
	for (const file of files) {
		sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
	}
	return drizzle(sqlite, { schema });
}
```

> Validated: replaying all migration files via `exec()` creates every table without error. `--> statement-breakpoint` lines are SQL comments and are ignored.

- [ ] **Step 3: Write the seed helper smoke test (failing)**

Create `workers/api/src/__tests__/helpers/seed.smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTestDb } from "./test-db";
import { seedChain } from "./seed";

describe("seedChain", () => {
	it("seeds a venue→branch→service chain owned by the given owner", async () => {
		const db = createTestDb();
		const chain = await seedChain(db, { ownerId: "owner-1" });
		expect(chain.ownerId).toBe("owner-1");
		expect(chain.venueId).toBeTruthy();
		expect(chain.branchId).toBeTruthy();
		expect(chain.serviceId).toBeTruthy();
	});
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `bun run --filter @repo/api test -- seed.smoke`
Expected: FAIL — `Cannot find module './seed'`.

- [ ] **Step 5: Write the seed helper**

Create `workers/api/src/__tests__/helpers/seed.ts`:

```ts
import {
	branchesSchema,
	servicesSchema,
	venuesSchema,
} from "@repo/core/src/database/schema";
import type { createTestDb } from "./test-db";

type Db = ReturnType<typeof createTestDb>;

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;
const TS = "2026-01-01T00:00:00.000Z";

export interface SeededChain {
	ownerId: string;
	venueId: string;
	branchId: string;
	serviceId: string;
}

/**
 * Inserts a venue → branch → service chain owned by `ownerId`. IDs are
 * generated unless provided. Uses Drizzle (camelCase keys) so column-name
 * mapping is handled by the schema.
 */
export async function seedChain(
	db: Db,
	opts: { ownerId: string; venueId?: string; branchId?: string; serviceId?: string },
): Promise<SeededChain> {
	const venueId = opts.venueId ?? nextId("venue");
	const branchId = opts.branchId ?? nextId("branch");
	const serviceId = opts.serviceId ?? nextId("service");

	await db.insert(venuesSchema).values({
		id: venueId,
		name: "Test Venue",
		category: "Beauty",
		city: "Dhaka",
		ownerId: opts.ownerId,
		createdAt: TS,
	} as never);

	await db.insert(branchesSchema).values({
		id: branchId,
		venueId,
		name: "Test Branch",
		address: "123 St",
		city: "Dhaka",
		createdAt: TS,
	} as never);

	await db.insert(servicesSchema).values({
		id: serviceId,
		branchId,
		name: "Haircut",
		category: "Hair",
		duration: 30,
		price: 1000,
		createdAt: TS,
	} as never);

	return { ownerId: opts.ownerId, venueId, branchId, serviceId };
}
```

> Confirm the exact table export names in `@repo/core/src/database/schema` (`venuesSchema`, `branchesSchema`, `servicesSchema` per the schema files). Adjust if a barrel re-exports under different names.

- [ ] **Step 6: Run the smoke test to verify it passes**

Run: `bun run --filter @repo/api test -- seed.smoke`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add workers/api/package.json workers/api/src/__tests__/helpers/test-db.ts workers/api/src/__tests__/helpers/seed.ts workers/api/src/__tests__/helpers/seed.smoke.test.ts
git commit -m "test(api): add ownership-chain seed helper for authorization tests"
```

---

## Task 2: AuthorizationService — owner + branch-access primitives

**Files:**
- Create: `workers/api/src/core/authorization.ts`
- Test: `workers/api/src/__tests__/core/authorization.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `workers/api/src/__tests__/core/authorization.test.ts`:

```ts
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import { VenuesRepository } from "@repo/core/src/database/repositories/venues.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../core/errors";
import { createTestDb } from "../helpers/test-db";
import { seedChain } from "../helpers/seed";

function makeGuard(db: ReturnType<typeof createTestDb>) {
	return new AuthorizationService(
		new VenuesRepository(db as never),
		new BranchesRepository(db as never),
		new ServicesRepository(db as never),
		new CouponsRepository(db as never),
		new BookingsRepository(db as never),
		new TeamRepository(db as never),
		new ReviewsRepository(db as never),
	);
}

describe("AuthorizationService.assertVenueOwner", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("returns the venue when the actor owns it", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		const venue = await makeGuard(db).assertVenueOwner("owner-1", venueId);
		expect(venue.id).toBe(venueId);
	});

	it("throws 403 when the actor does not own it", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertVenueOwner("owner-2", venueId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("throws 404 when the venue does not exist", async () => {
		await expect(
			makeGuard(db).assertVenueOwner("owner-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("AuthorizationService.assertBranchAccess", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("allows the owner (scopedBranchIds null) who owns the venue", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertBranchAccess("owner-1", branchId, null),
		).resolves.toBeUndefined();
	});

	it("throws 403 for an owner who does not own the venue", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertBranchAccess("owner-2", branchId, null),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("allows a manager assigned to the branch (scopedBranchIds includes it)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertBranchAccess("manager-1", branchId, [branchId]),
		).resolves.toBeUndefined();
	});

	it("throws 403 for a manager not assigned to the branch", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertBranchAccess("manager-1", branchId, ["other-branch"]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("throws 404 for an owner when the branch does not exist", async () => {
		await expect(
			makeGuard(db).assertBranchAccess("owner-1", "missing", null),
		).rejects.toBeInstanceOf(NotFoundError);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run --filter @repo/api test -- authorization`
Expected: FAIL — `Cannot find module '../../core/authorization'`.

- [ ] **Step 3: Write the guard primitives**

Create `workers/api/src/core/authorization.ts`:

```ts
import type { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import type { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import type { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import type { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import type { VenuesRepository } from "@repo/core/src/database/repositories/venues.repository";
import type {
	BranchSelect,
	VenueSelect,
} from "@repo/core/src/database/schema";
import { ForbiddenError, NotFoundError } from "./errors";

/**
 * Centralizes every authorization decision for owner-scoped resources:
 * ownership-chain resolution (resource → owning venue → owner) and the
 * branch-scope rule for managers/staff. Services call this instead of
 * hand-rolling `venue.ownerId !== actorId` checks.
 */
export class AuthorizationService {
	constructor(
		private readonly venuesRepo: VenuesRepository,
		private readonly branchesRepo: BranchesRepository,
		private readonly servicesRepo: ServicesRepository,
		private readonly couponsRepo: CouponsRepository,
		private readonly bookingsRepo: BookingsRepository,
		private readonly teamRepo: TeamRepository,
		private readonly reviewsRepo: ReviewsRepository,
	) {}

	/** Asserts the actor owns the venue. Returns the venue. */
	async assertVenueOwner(
		actorId: string,
		venueId: string,
	): Promise<VenueSelect> {
		const venue = await this.venuesRepo.findOne(venueId);
		if (!venue.data) throw new NotFoundError("Venue not found");
		if (venue.data.ownerId !== actorId) {
			throw new ForbiddenError("You do not own this venue");
		}
		return venue.data as VenueSelect;
	}

	/**
	 * Branch-scoped access. `scopedBranchIds === null` means owner (must own the
	 * venue containing the branch); a non-null array means manager/staff (must be
	 * assigned to the branch). The non-null path trusts the assignment list and
	 * does not re-check branch existence — matching prior behavior.
	 */
	async assertBranchAccess(
		actorId: string,
		branchId: string,
		scopedBranchIds: string[] | null,
	): Promise<void> {
		if (scopedBranchIds !== null) {
			if (!scopedBranchIds.includes(branchId)) {
				throw new ForbiddenError("You are not assigned to this branch");
			}
			return;
		}
		const branch = await this.branchesRepo.findOne(branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");
		await this.assertVenueOwner(actorId, branch.data.venueId);
	}

	/** Asserts the actor owns the venue containing this branch. Returns the branch. */
	async assertBranchOwner(
		actorId: string,
		branchId: string,
	): Promise<BranchSelect> {
		const branch = await this.branchesRepo.findOne(branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");
		await this.assertVenueOwner(actorId, branch.data.venueId);
		return branch.data as BranchSelect;
	}
}
```

> Verified: `VenueSelect` and `BranchSelect` are exported from `@repo/core/src/database/schema`. Import directly.

- [ ] **Step 4: Run to verify the primitives pass**

Run: `bun run --filter @repo/api test -- authorization`
Expected: the `assertVenueOwner` and `assertBranchAccess` describe blocks PASS (the resolver tests added in Task 3 don't exist yet).

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/core/authorization.ts workers/api/src/__tests__/core/authorization.test.ts
git commit -m "feat(api): add AuthorizationService owner + branch-access primitives"
```

---

## Task 3: AuthorizationService — resource resolvers + customer-ownership

**Files:**
- Modify: `workers/api/src/core/authorization.ts`
- Modify: `workers/api/src/__tests__/core/authorization.test.ts`

- [ ] **Step 1: Add failing tests for the resolvers**

Append to `workers/api/src/__tests__/core/authorization.test.ts`:

```ts
import { bookingsSchema } from "@repo/core/src/database/schema";

describe("AuthorizationService.assertServiceAccess", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("returns the service for the owning actor", async () => {
		const { serviceId } = await seedChain(db, { ownerId: "owner-1" });
		const svc = await makeGuard(db).assertServiceAccess("owner-1", serviceId, null);
		expect(svc.id).toBe(serviceId);
	});

	it("throws 403 for a different owner", async () => {
		const { serviceId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertServiceAccess("owner-2", serviceId, null),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("throws 403 for a manager not assigned to the service's branch", async () => {
		const { serviceId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeGuard(db).assertServiceAccess("mgr", serviceId, ["other-branch"]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("throws 404 when the service does not exist", async () => {
		await expect(
			makeGuard(db).assertServiceAccess("owner-1", "missing", null),
		).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("AuthorizationService.assertCustomerOwnsBooking", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	async function seedBooking(ownerId: string, userId: string) {
		const chain = await seedChain(db, { ownerId });
		const bookingId = "booking-1";
		await db.insert(bookingsSchema).values({
			id: bookingId,
			userId,
			serviceId: chain.serviceId,
			branchId: chain.branchId,
			slot: "2026-02-01T10:00:00.000Z",
			price: 1000,
			createdAt: "2026-01-01T00:00:00.000Z",
		} as never);
		return { bookingId, ...chain };
	}

	it("returns the booking for its owning customer", async () => {
		const { bookingId } = await seedBooking("owner-1", "cust-1");
		const b = await makeGuard(db).assertCustomerOwnsBooking("cust-1", bookingId);
		expect(b.id).toBe(bookingId);
	});

	it("throws 403 for a different customer", async () => {
		const { bookingId } = await seedBooking("owner-1", "cust-1");
		await expect(
			makeGuard(db).assertCustomerOwnsBooking("cust-2", bookingId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("throws 404 when the booking does not exist", async () => {
		await expect(
			makeGuard(db).assertCustomerOwnsBooking("cust-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run --filter @repo/api test -- authorization`
Expected: FAIL — `assertServiceAccess`/`assertCustomerOwnsBooking` are not functions.

- [ ] **Step 3: Add the resolver methods**

In `workers/api/src/core/authorization.ts`, extend the type import and add methods. Update the schema type import to include the resolved types:

```ts
import type {
	BookingSelect,
	BranchSelect,
	CouponSelect,
	ReviewSelect,
	ServiceSelect,
	TeamMemberSelect,
	VenueSelect,
} from "@repo/core/src/database/schema";
```

Add these methods to the `AuthorizationService` class body (after `assertBranchOwner`):

```ts
	/** Branch-scoped access to a service. Returns the service. */
	async assertServiceAccess(
		actorId: string,
		serviceId: string,
		scopedBranchIds: string[] | null,
	): Promise<ServiceSelect> {
		const service = await this.servicesRepo.findOne(serviceId);
		if (!service.data) throw new NotFoundError("Service not found");
		await this.assertBranchAccess(
			actorId,
			service.data.branchId,
			scopedBranchIds,
		);
		return service.data as ServiceSelect;
	}

	/** Branch-scoped access to a booking (staff view). Returns the booking. */
	async assertBookingAccess(
		actorId: string,
		bookingId: string,
		scopedBranchIds: string[] | null,
	): Promise<BookingSelect> {
		const booking = await this.bookingsRepo.findOne(bookingId);
		if (!booking.data) throw new NotFoundError("Booking not found");
		await this.assertBranchAccess(
			actorId,
			booking.data.branchId,
			scopedBranchIds,
		);
		return booking.data as BookingSelect;
	}

	/** Customer owns their own booking. Returns the booking. */
	async assertCustomerOwnsBooking(
		userId: string,
		bookingId: string,
	): Promise<BookingSelect> {
		const booking = await this.bookingsRepo.findOne(bookingId);
		if (!booking.data) throw new NotFoundError("Booking not found");
		if (booking.data.userId !== userId) {
			throw new ForbiddenError("You do not own this booking");
		}
		return booking.data as BookingSelect;
	}

	/** Owner owns the venue containing this coupon. Returns the coupon. */
	async assertCouponOwner(
		actorId: string,
		couponId: string,
	): Promise<CouponSelect> {
		const coupon = await this.couponsRepo.findOne(couponId);
		if (!coupon.data) throw new NotFoundError("Coupon not found");
		await this.assertVenueOwner(actorId, coupon.data.venueId);
		return coupon.data as CouponSelect;
	}

	/** Owner owns the venue for this review. Returns the review. */
	async assertReviewOwner(
		actorId: string,
		reviewId: string,
	): Promise<ReviewSelect> {
		const review = await this.reviewsRepo.findOne(reviewId);
		if (!review.data) throw new NotFoundError("Review not found");
		await this.assertVenueOwner(actorId, review.data.venueId);
		return review.data as ReviewSelect;
	}

	/** Owner owns the venue for this team member. Returns the member. */
	async assertTeamMemberOwner(
		actorId: string,
		memberId: string,
	): Promise<TeamMemberSelect> {
		const member = await this.teamRepo.findOne(memberId);
		if (!member.data) throw new NotFoundError("Team member not found");
		await this.assertVenueOwner(actorId, member.data.venueId);
		return member.data as TeamMemberSelect;
	}
```

> Verified: `ServiceSelect`, `BookingSelect`, `CouponSelect`, `ReviewSelect`, `TeamMemberSelect`, `BranchSelect`, and `VenueSelect` are all exported and re-exported from `@repo/core/src/database/schema`. Import directly.

- [ ] **Step 4: Run to verify all guard tests pass**

Run: `bun run --filter @repo/api test -- authorization`
Expected: PASS (all guard describe blocks).

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/core/authorization.ts workers/api/src/__tests__/core/authorization.test.ts
git commit -m "feat(api): add AuthorizationService resource resolvers + customer ownership"
```

---

## Task 4: Inject AuthorizationService into the request context

**Files:**
- Modify: `workers/api/src/middleware/services.ts`

- [ ] **Step 1: Construct the guard and expose it**

In `workers/api/src/middleware/services.ts`, inside `injectServices`, after the existing repository constructions (`venuesRepo`, `branchesRepo`, `servicesRepo`, `couponsRepo`, `bookingsRepo`, `teamRepo` already exist), add a `reviewsRepo` if not already created and construct the guard. Add the import at the top:

```ts
import { AuthorizationService } from "../core/authorization";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
```

Then, where the shared repos are created, ensure a `reviewsRepo` instance exists and add:

```ts
	const reviewsRepo = new ReviewsRepository(db);
	const authz = new AuthorizationService(
		venuesRepo,
		branchesRepo,
		servicesRepo,
		couponsRepo,
		bookingsRepo,
		teamRepo,
		reviewsRepo,
	);
```

> `reviewsService` currently constructs its own `new ReviewsRepository(db)` inline; reuse the shared `reviewsRepo` you just created for both the guard and `reviewsService` to avoid duplicate instances.

- [ ] **Step 2: Verify the app still builds and all tests pass**

Run: `bun run --filter @repo/api test`
Expected: PASS (no behavior change yet — the guard is constructed but not consumed).

- [ ] **Step 3: Commit**

```bash
git add workers/api/src/middleware/services.ts
git commit -m "feat(api): construct shared AuthorizationService in injectServices"
```

---

## Task 5: Characterization tests for the current `services` module

These pin the **current** `ServicesService` authorization behavior so the Task 6 refactor is provably safe. They are written against the existing implementation and must PASS immediately.

**Files:**
- Create: `workers/api/src/__tests__/modules/services/services.service.test.ts`

- [ ] **Step 1: Write the characterization tests**

Create `workers/api/src/__tests__/modules/services/services.service.test.ts`:

```ts
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { VenuesRepository } from "@repo/core/src/database/repositories/venues.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { ServicesService } from "../../../modules/services/services.service";
import { createTestDb } from "../../helpers/test-db";
import { seedChain } from "../../helpers/seed";

// Storage is never reached by the authorization path under test.
const stubStorage = {
	upload: async () => "https://example/x.jpg",
} as never;

function makeService(db: ReturnType<typeof createTestDb>) {
	// NOTE: keep this constructor call in sync with ServicesService. Task 6
	// changes the dependencies; update this factory there too.
	return new ServicesService(
		new ServicesRepository(db as never),
		new BranchesRepository(db as never),
		new VenuesRepository(db as never),
		stubStorage,
	);
}

describe("ServicesService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("create: rejects an owner who does not own the branch's venue (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).create(
				"owner-2",
				branchId,
				{ name: "X", category: "Hair", duration: 30, price: 1000 } as never,
				null,
			),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("create: rejects a manager not assigned to the branch (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).create(
				"mgr",
				branchId,
				{ name: "X", category: "Hair", duration: 30, price: 1000 } as never,
				["other-branch"],
			),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("create: succeeds for the venue owner", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).create(
			"owner-1",
			branchId,
			{ name: "X", category: "Hair", duration: 30, price: 1000 } as never,
			null,
		);
		expect(result).toBeTruthy();
	});

	it("update: rejects a different owner (403)", async () => {
		const { serviceId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).update("owner-2", serviceId, { price: 2000 } as never, null),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("update: throws 404 when the service is missing", async () => {
		await expect(
			makeService(db).update("owner-1", "missing", { price: 2000 } as never, null),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("delete: rejects a manager not assigned to the branch (403)", async () => {
		const { serviceId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).delete("mgr", serviceId, ["other-branch"]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
```

- [ ] **Step 2: Run them against the CURRENT implementation**

Run: `bun run --filter @repo/api test -- services.service`
Expected: PASS — these characterize existing behavior. If any fail, the test setup is wrong (fix the test, not the service) before proceeding.

- [ ] **Step 3: Commit**

```bash
git add workers/api/src/__tests__/modules/services/services.service.test.ts
git commit -m "test(api): characterize ServicesService authorization behavior"
```

---

## Task 6: Migrate `ServicesService` to the guard

The Task 5 tests must still pass after this — that is the proof of behavior preservation.

**Files:**
- Modify: `workers/api/src/modules/services/services.service.ts`
- Modify: `workers/api/src/middleware/services.ts`
- Modify: `workers/api/src/__tests__/modules/services/services.service.test.ts` (constructor factory)

- [ ] **Step 1: Rewrite `ServicesService` to depend on the guard**

Replace the contents of `workers/api/src/modules/services/services.service.ts` with:

```ts
import type { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import type { ServiceInsert } from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";
import type { R2Storage } from "../../core/storage/r2";

export class ServicesService {
	constructor(
		private readonly repo: ServicesRepository,
		private readonly authz: AuthorizationService,
		private readonly storage: R2Storage,
	) {}

	listByBranch(branchId: string) {
		return this.repo.findByBranch(branchId);
	}

	async get(id: string) {
		const result = await this.repo.findOne(id);
		if (!result.data) {
			const { NotFoundError } = await import("../../core/errors");
			throw new NotFoundError("Service not found");
		}
		return result.data;
	}

	async create(
		actorId: string,
		branchId: string,
		data: Omit<ServiceInsert, "branchId">,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertBranchAccess(actorId, branchId, scopedBranchIds);
		const result = await this.repo.create({ ...data, branchId });
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(
		actorId: string,
		serviceId: string,
		data: Partial<Omit<ServiceInsert, "branchId">>,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertServiceAccess(actorId, serviceId, scopedBranchIds);
		const result = await this.repo.updateOne(serviceId, data);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async delete(
		actorId: string,
		serviceId: string,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertServiceAccess(actorId, serviceId, scopedBranchIds);
		const result = await this.repo.deleteOne(serviceId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async uploadPhoto(
		actorId: string,
		serviceId: string,
		file: File,
		scopedBranchIds: string[] | null,
	): Promise<{ url: string }> {
		await this.authz.assertServiceAccess(actorId, serviceId, scopedBranchIds);

		const ext = file.name.split(".").pop() ?? "jpg";
		const key = `services/${serviceId}/${crypto.randomUUID()}.${ext}`;
		const url = await this.storage.upload(
			key,
			await file.arrayBuffer(),
			file.type,
		);

		await this.repo.updateOne(serviceId, {
			imageUrl: url,
		} as Partial<ServiceInsert>);
		return { url };
	}

	async deletePhoto(
		actorId: string,
		serviceId: string,
		scopedBranchIds: string[] | null,
	): Promise<void> {
		await this.authz.assertServiceAccess(actorId, serviceId, scopedBranchIds);
		await this.repo.updateOne(serviceId, {
			imageUrl: null,
		} as Partial<ServiceInsert>);
	}
}
```

> The dynamic `import` in `get()` is a clumsy way to avoid an extra top import; if `NotFoundError` is already needed, prefer a normal top-level `import { NotFoundError } from "../../core/errors";` and use it directly. Keep `get()`'s behavior identical (404 on missing service). The cleaner form:
> ```ts
> import { NotFoundError } from "../../core/errors";
> // ...
> async get(id: string) {
> 	const result = await this.repo.findOne(id);
> 	if (!result.data) throw new NotFoundError("Service not found");
> 	return result.data;
> }
> ```

- [ ] **Step 2: Update the `servicesService` wiring in `injectServices`**

In `workers/api/src/middleware/services.ts`, change the `servicesService` construction from the old four-arg form to inject the guard:

```ts
	c.set(
		"servicesService",
		new ServicesService(servicesRepo, authz, storage),
	);
```

(The `authz` instance was created in Task 4. `branchesRepo`/`venuesRepo` are still used by other services, so leave them.)

- [ ] **Step 3: Update the test constructor factory**

In `workers/api/src/__tests__/modules/services/services.service.test.ts`, replace the `makeService` factory to construct the guard (the characterization assertions are unchanged):

```ts
import { AuthorizationService } from "../../../core/authorization";
import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";

function makeService(db: ReturnType<typeof createTestDb>) {
	const authz = new AuthorizationService(
		new VenuesRepository(db as never),
		new BranchesRepository(db as never),
		new ServicesRepository(db as never),
		new CouponsRepository(db as never),
		new BookingsRepository(db as never),
		new TeamRepository(db as never),
		new ReviewsRepository(db as never),
	);
	return new ServicesService(
		new ServicesRepository(db as never),
		authz,
		stubStorage,
	);
}
```

- [ ] **Step 4: Run the characterization tests — they must still pass**

Run: `bun run --filter @repo/api test -- services.service`
Expected: PASS (identical assertions, new internals). This is the behavior-preservation proof.

- [ ] **Step 5: Run the full api + core suites**

Run: `bun run --filter @repo/core test && bun run --filter @repo/api test`
Expected: all green. If a pre-existing `services` route test asserted on a Forbidden **message string** that changed, update it — message normalization is intentional (see Decisions). Status codes are unchanged.

- [ ] **Step 6: Commit**

```bash
git add workers/api/src/modules/services/services.service.ts workers/api/src/middleware/services.ts workers/api/src/__tests__/modules/services/services.service.test.ts
git commit -m "refactor(api): migrate ServicesService to shared AuthorizationService"
```

---

## Task 7: Documentation + final verification

**Files:**
- Modify: `docs/guides/api-query-repository-pattern.md`

- [ ] **Step 1: Document the authorization guard**

In `docs/guides/api-query-repository-pattern.md`, add an "Authorization guard" subsection. Content to include (prose, adapt to the doc's voice):

```markdown
### Authorization guard

Owner-scoped service methods must not hand-roll ownership checks. Use the shared
`AuthorizationService` (injected on the request context as part of service
wiring). It centralizes the ownership-resolution chains and the branch-scope
rule:

- `assertVenueOwner(actorId, venueId)` — owner owns the venue.
- `assertBranchAccess(actorId, branchId, scopedBranchIds)` — owner (scoped null)
  owns the venue, or manager/staff is assigned to the branch.
- `assertServiceAccess` / `assertBookingAccess` — branch-scoped access to a
  resource; returns the resolved resource.
- `assertCouponOwner` / `assertReviewOwner` / `assertTeamMemberOwner` /
  `assertBranchOwner` — owner-only resources; return the resolved resource.
- `assertCustomerOwnsBooking(userId, bookingId)` — a customer acting on their
  own booking.

Contract: missing resource → 404; found-but-not-authorized → 403. Methods that
resolve a resource return it so the caller does not re-fetch. New owner-scoped
endpoints must call the guard rather than comparing `ownerId` inline.
```

- [ ] **Step 2: Run lint, full tests, and build**

Run:

```bash
bun run lint && bun run --filter @repo/core test && bun run --filter @repo/api test && bun run --filter @repo/api build
```

Expected: lint clean, all tests pass, build succeeds. Record what you ran.

- [ ] **Step 3: Commit**

```bash
git add docs/guides/api-query-repository-pattern.md
git commit -m "docs(api): document the shared authorization guard"
```

---

## Self-Review Notes (for the implementer)

- **PRD coverage (issue #26):** the guard centralizes all resolution chains (stories 1–7, 12, 13, 16, 17); branch-scope semantics fixed in one place (8, 9, 17); 403/404 distinction preserved (10); consistent error body (11); customer-ownership shape supported (covers the bookings third shape); characterization + guard tests at the DB seam (18, 19). Stories about *converging the two route middlewares* (14, 15) and migrating the remaining modules are intentionally **out of scope for this phase** — see below.
- **Deferred to follow-up plans (do not implement here):**
  1. Migrate `bookings` (uses `assertBookingAccess` + `assertCustomerOwnsBooking`), then `branches`, `coupons`, `team`, `reviews` to the guard — each is a mechanical repeat of Task 5+6 against its resolver, validated by its own characterization tests.
  2. Converge `requireRole`/`requireVenueStaff` into one configurable authorization middleware (route-test seam, every module `index.ts`).
  3. On completion, check off F2 in epic #23.
- **Naming consistency:** the guard class is `AuthorizationService`; context var is `authz`; methods are `assertVenueOwner`, `assertBranchAccess`, `assertBranchOwner`, `assertServiceAccess`, `assertBookingAccess`, `assertCustomerOwnsBooking`, `assertCouponOwner`, `assertReviewOwner`, `assertTeamMemberOwner`. Used identically in Tasks 2, 3, 6.
- **Verified facts:** all `*Select` type exports used by the guard exist in the schema barrel; every repo exposes `findOne(id)`; migration replay into in-memory SQLite succeeds; the timestamp column is `createdAt` (camelCase). No discovery work remains on these.
- **Behavior preservation is status-code level, not byte-level:** error *messages* are deliberately normalized.
```
