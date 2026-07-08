# F2 Phase 2 — Authorization Guard: Remaining Modules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `branches`, `coupons`, `team`, `reviews`, and `bookings` services to use the shared `AuthorizationService` introduced in Phase 1, eliminating all remaining hand-rolled ownership checks.

**Architecture:** Each module follows the same two-step pattern: (1) add real-DB characterization tests that pin the current 403/404 authorization contract using the in-memory SQLite harness + `seedChain` helper, then (2) rewrite the service to call the guard instead of hand-rolling checks. The characterization tests must pass both before and after migration — that is the proof of behavior preservation. After migrating each service, update its wiring in `injectServices`. All five migrations land as independent commits so behavior preservation is reviewable per module.

**Tech Stack:** TypeScript, Hono, Drizzle ORM (SQLite), Vitest (node), better-sqlite3 (test-only).

---

## Background & Context (read before starting)

- **Phase 1** (already merged to `develop`): `AuthorizationService` lives in `workers/api/src/core/authorization.ts`. It is constructed in `injectServices` as `const authz = new AuthorizationService(venuesRepo, branchesRepo, servicesRepo, couponsRepo, bookingsRepo, teamRepo, reviewsRepo)`. The `services` module already uses it.
- **Guard methods used in this phase:**
  - `assertVenueOwner(actorId, venueId)` → returns venue; 404 if missing, 403 if wrong owner
  - `assertBranchOwner(actorId, branchId)` → returns branch; 404 if branch/venue missing, 403 if wrong owner
  - `assertBranchAccess(actorId, branchId, scopedBranchIds)` → void; 403 if manager not assigned, or owner doesn't own venue
  - `assertBookingAccess(actorId, bookingId, scopedBranchIds)` → returns booking; same as assertBranchAccess applied to the booking's branch
  - `assertCustomerOwnsBooking(userId, bookingId)` → returns booking; 404 if missing, 403 if different user
  - `assertCouponOwner(actorId, couponId)` → returns coupon; 404 if missing, 403 if wrong owner
  - `assertReviewOwner(actorId, reviewId)` → returns review; 404 if missing, 403 if wrong owner
  - `assertTeamMemberOwner(actorId, memberId)` → returns member; 404 if missing, 403 if wrong owner
- **Test helpers (from Phase 1):**
  - `workers/api/src/__tests__/helpers/test-db.ts` — `createTestDb()` returns in-memory Drizzle+SQLite
  - `workers/api/src/__tests__/helpers/seed.ts` — `seedChain(db, { ownerId })` inserts venue→branch→service, returns `{ ownerId, venueId, branchId, serviceId }`
- **Error contract (behavior-preserving at status-code level):** resource missing → 404 (`NotFoundError`), found-but-not-authorized → 403 (`ForbiddenError`). Error *messages* are normalized — some current methods throw bare `ForbiddenError()` (no message); the guard always includes a message. This is intentional and is **not** a bug.
- **One deliberate behavior change per module:** if a resource's parent venue is soft-deleted (orphaned), the current code returns 403 (the `!venue.data` arm of `if (!venue.data || venue.data.ownerId !== ownerId)`). The guard returns 404. This is more correct and intentional. Document in commit messages.
- **`bookings` module keeps `branchesRepo` and `servicesRepo`** in its constructor — they are used by non-authorization logic (`create`, `cancel`). Only `venuesRepo` is dropped.
- **`reviews` module keeps `bookingsRepo` and `branchesRepo`** — used by `submit` to derive venueId. Only `venuesRepo` is dropped.
- **Seed schema exports** (from `@repo/core/src/database/schema`): `venuesSchema`, `branchesSchema`, `servicesSchema`, `bookingsSchema`. All use camelCase keys (Drizzle maps to snake_case columns).
- **Required NOT NULL columns for bookings seed rows:** `id, userId, serviceId, branchId, slot, price, createdAt`. Status defaults to `"Pending"`.

---

## File Structure

| File | Change |
|------|--------|
| `workers/api/src/modules/branches/branches.service.ts` | Drop `venuesRepo`; use guard for create/update/delete/setHours |
| `workers/api/src/__tests__/modules/branches/branches.service.test.ts` | Replace with real-DB characterization tests |
| `workers/api/src/modules/coupons/coupons.service.ts` | Drop `venuesRepo`; use guard for listByVenue/get/create/update/delete |
| `workers/api/src/__tests__/modules/coupons/coupons.service.test.ts` | Replace with real-DB characterization tests |
| `workers/api/src/modules/team/team.service.ts` | Drop `venuesRepo`; use guard for listByVenue/add/update/remove |
| `workers/api/src/__tests__/modules/team/team.service.test.ts` | Replace with real-DB characterization tests |
| `workers/api/src/modules/reviews/reviews.service.ts` | Drop `venuesRepo`; use guard for listPending/approve/reject |
| `workers/api/src/__tests__/modules/reviews/reviews.service.test.ts` | Replace with real-DB characterization tests |
| `workers/api/src/modules/bookings/bookings.service.ts` | Drop `venuesRepo`; use guard for listByBranch/get/confirm/complete/assignStaff/cancel |
| `workers/api/src/__tests__/modules/bookings/bookings.service.test.ts` | Update mock factory + add real-DB auth tests |
| `workers/api/src/middleware/services.ts` | Rewire all five services; drop duplicate `TeamRepository` instantiation |
| `docs/guides/api-query-repository-pattern.md` | Update section 18 to note all modules migrated |

---

## Task 1: Migrate `branches`

**Files:**
- Modify: `workers/api/src/modules/branches/branches.service.ts`
- Modify: `workers/api/src/__tests__/modules/branches/branches.service.test.ts`
- Modify: `workers/api/src/middleware/services.ts`

- [ ] **Step 1: Replace the branches service test with real-DB characterization tests**

Replace the entire contents of `workers/api/src/__tests__/modules/branches/branches.service.test.ts`:

```ts
import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import { VenuesRepository } from "@repo/core/src/database/repositories/venues.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { BranchesService } from "../../../modules/branches/branches.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

// NOTE: keep this factory in sync with the BranchesService constructor.
// After Task 1 migration the constructor is (repo, servicesRepo, bookingsRepo, authz).
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
	return new BranchesService(
		new BranchesRepository(db as never),
		new VenuesRepository(db as never),
		new ServicesRepository(db as never),
		new BookingsRepository(db as never),
	);
}

describe("BranchesService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("create: rejects an owner who does not own the venue (403)", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).create("owner-2", venueId, {
				name: "B",
				address: "1 St",
				city: "Dhaka",
			} as never),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("create: throws 404 for a missing venue", async () => {
		await expect(
			makeService(db).create("owner-1", "missing-venue", {
				name: "B",
				address: "1 St",
				city: "Dhaka",
			} as never),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("create: succeeds for the venue owner", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).create("owner-1", venueId, {
			name: "New Branch",
			address: "1 St",
			city: "Dhaka",
		} as never);
		expect(result).toBeTruthy();
	});

	it("update: rejects a different owner (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).update("owner-2", branchId, { name: "X" }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("update: throws 404 for a missing branch", async () => {
		await expect(
			makeService(db).update("owner-1", "missing", { name: "X" }),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("delete: rejects a different owner (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).delete("owner-2", branchId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("setHours: rejects a different owner (403)", async () => {
		const { branchId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).setHours("owner-2", branchId, [
				{ dayOfWeek: 0, isClosed: true, openTime: null, closeTime: null },
			]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
```

> **Note:** The `makeService` factory above uses the **current** 4-arg `BranchesService` constructor `(repo, venuesRepo, servicesRepo, bookingsRepo)`. These tests must pass against the current implementation. After migrating in Step 4, you'll update the factory to use `(repo, servicesRepo, bookingsRepo, authz)`.

- [ ] **Step 2: Run tests — must PASS against current implementation**

Run: `bun run --filter @repo/api test -- branches.service`
Expected: PASS (all 7 tests). If any fail, the test setup is wrong — fix the test, not the service.

- [ ] **Step 3: Migrate `BranchesService`**

Replace the entire contents of `workers/api/src/modules/branches/branches.service.ts`:

```ts
import type { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import type {
	BranchHoursInsert,
	BranchInsert,
} from "@repo/core/src/database/schema";
import {
	addMinutes,
	generateSlotCandidates,
	isBranchClosedOnDate,
} from "../../lib/booking-slots";
import { NotFoundError, ValidationError } from "../../core/errors";
import type { AuthorizationService } from "../../core/authorization";

export class BranchesService {
	constructor(
		private readonly repo: BranchesRepository,
		private readonly servicesRepo: ServicesRepository,
		private readonly bookingsRepo: BookingsRepository,
		private readonly authz: AuthorizationService,
	) {}

	listByVenue(venueId: string) {
		return this.repo.findByVenue(venueId);
	}

	async get(id: string) {
		const result = await this.repo.findOne(id);
		if (!result.data) throw new NotFoundError("Branch not found");
		return result.data;
	}

	async create(
		ownerId: string,
		venueId: string,
		data: Omit<BranchInsert, "venueId">,
	) {
		await this.authz.assertVenueOwner(ownerId, venueId);
		const result = await this.repo.create({ ...data, venueId });
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(
		ownerId: string,
		branchId: string,
		data: Partial<Omit<BranchInsert, "venueId">>,
	) {
		await this.authz.assertBranchOwner(ownerId, branchId);
		const result = await this.repo.updateOne(branchId, data);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async delete(ownerId: string, branchId: string) {
		await this.authz.assertBranchOwner(ownerId, branchId);
		const result = await this.repo.deleteOne(branchId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	getHours(branchId: string) {
		return this.repo.findHours(branchId);
	}

	async getAvailability(branchId: string, date: string, serviceId: string) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			throw new ValidationError("date must be YYYY-MM-DD");
		}

		await this.get(branchId);

		const svcResult = await this.servicesRepo.findOne(serviceId);
		if (!svcResult.data) throw new NotFoundError("Service not found");
		if (svcResult.data.branchId !== branchId) {
			throw new ValidationError("Service does not belong to this branch");
		}

		const hours = await this.repo.findHours(branchId);
		const isClosed = isBranchClosedOnDate(date, hours);
		if (isClosed) {
			return { date, serviceId, isClosed: true, slots: [] as string[] };
		}

		const candidates = generateSlotCandidates(
			date,
			svcResult.data.duration,
			hours,
		);
		const slots: string[] = [];

		for (const slot of candidates) {
			const slotEnd = addMinutes(slot, svcResult.data.duration);
			const conflict = await this.bookingsRepo.findConflict(
				branchId,
				serviceId,
				slot,
			);
			if (conflict) continue;
			const overlap = await this.bookingsRepo.countOverlapping(
				branchId,
				slot,
				slotEnd,
			);
			if (overlap > 0) continue;
			slots.push(slot);
		}

		return { date, serviceId, isClosed: false, slots };
	}

	async setHours(
		ownerId: string,
		branchId: string,
		hours: Array<
			Pick<
				BranchHoursInsert,
				"dayOfWeek" | "isClosed" | "openTime" | "closeTime"
			>
		>,
	) {
		await this.authz.assertBranchOwner(ownerId, branchId);
		const results = await Promise.all(
			hours.map((h) =>
				this.repo.upsertHour({
					branchId,
					dayOfWeek: h.dayOfWeek,
					isClosed: h.isClosed ?? false,
					openTime: h.openTime ?? null,
					closeTime: h.closeTime ?? null,
				}),
			),
		);
		return results;
	}
}
```

- [ ] **Step 4: Update the test factory to use the new constructor**

In the branches service test, update `makeService` to:

```ts
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
	return new BranchesService(
		new BranchesRepository(db as never),
		new ServicesRepository(db as never),
		new BookingsRepository(db as never),
		authz,
	);
}
```

- [ ] **Step 5: Run tests — must still PASS (behavior preservation proof)**

Run: `bun run --filter @repo/api test -- branches.service`
Expected: PASS (same 7 tests).

- [ ] **Step 6: Update `injectServices` wiring**

In `workers/api/src/middleware/services.ts`, replace:

```ts
	c.set(
		"branchesService",
		new BranchesService(branchesRepo, venuesRepo, servicesRepo, bookingsRepo),
	);
```

with:

```ts
	c.set(
		"branchesService",
		new BranchesService(branchesRepo, servicesRepo, bookingsRepo, authz),
	);
```

- [ ] **Step 7: Run full api test suite**

Run: `bun run --filter @repo/api test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add workers/api/src/modules/branches/branches.service.ts \
        workers/api/src/__tests__/modules/branches/branches.service.test.ts \
        workers/api/src/middleware/services.ts
git commit -m "refactor(api): migrate BranchesService to shared AuthorizationService

Drop venuesRepo dependency; use assertVenueOwner for create and
assertBranchOwner for update/delete/setHours. 7 characterization
tests pass unchanged.

Note: orphaned-venue edge now returns 404 instead of 403 (intended).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Migrate `coupons`

**Files:**
- Modify: `workers/api/src/modules/coupons/coupons.service.ts`
- Modify: `workers/api/src/__tests__/modules/coupons/coupons.service.test.ts`
- Modify: `workers/api/src/middleware/services.ts`

- [ ] **Step 1: Replace the coupons service test with real-DB characterization tests**

Replace the entire contents of `workers/api/src/__tests__/modules/coupons/coupons.service.test.ts`:

```ts
import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import { VenuesRepository } from "@repo/core/src/database/repositories/venues.repository";
import { couponsSchema } from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { CouponsService } from "../../../modules/coupons/coupons.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";

// NOTE: keep in sync with CouponsService constructor.
// After Task 2 migration the constructor is (repo, authz).
function makeService(db: ReturnType<typeof createTestDb>) {
	return new CouponsService(
		new CouponsRepository(db as never),
		new VenuesRepository(db as never),
	);
}

async function seedCoupon(
	db: ReturnType<typeof createTestDb>,
	ownerId: string,
) {
	const { venueId } = await seedChain(db, { ownerId });
	const couponId = `coupon-${ownerId}`;
	await db.insert(couponsSchema).values({
		id: couponId,
		venueId,
		code: "TEST10",
		type: "Percentage",
		value: 10,
		createdAt: TS,
	} as never);
	return { couponId, venueId };
}

describe("CouponsService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("listByVenue: rejects a different owner (403)", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).listByVenue("owner-2", venueId, {
				page: 1,
				limit: 10,
			} as never),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("listByVenue: throws 404 for a missing venue", async () => {
		await expect(
			makeService(db).listByVenue("owner-1", "missing", {
				page: 1,
				limit: 10,
			} as never),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("listByVenue: succeeds for the venue owner", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).listByVenue("owner-1", venueId, {
			page: 1,
			limit: 10,
		} as never);
		expect(result).toBeDefined();
	});

	it("get: rejects a different owner (403)", async () => {
		const { couponId } = await seedCoupon(db, "owner-1");
		await expect(
			makeService(db).get("owner-2", couponId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("get: throws 404 for a missing coupon", async () => {
		await expect(
			makeService(db).get("owner-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("create: rejects a different owner (403)", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).create("owner-2", venueId, {
				code: "OFF10",
				type: "Percentage",
				value: 10,
			} as never),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("update: rejects a different owner (403)", async () => {
		const { couponId } = await seedCoupon(db, "owner-1");
		await expect(
			makeService(db).update("owner-2", couponId, { value: 20 } as never),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("delete: rejects a different owner (403)", async () => {
		const { couponId } = await seedCoupon(db, "owner-1");
		await expect(
			makeService(db).delete("owner-2", couponId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
```

- [ ] **Step 2: Run tests — must PASS against current implementation**

Run: `bun run --filter @repo/api test -- coupons.service`
Expected: PASS (8 tests).

- [ ] **Step 3: Migrate `CouponsService`**

Replace the entire contents of `workers/api/src/modules/coupons/coupons.service.ts`:

```ts
import type { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import type { CouponInsert } from "@repo/core/src/database/schema";
import type { PaginatedQueryDto } from "@repo/core/src/http/response";
import {
	ConflictError,
	ValidationError,
} from "../../core/errors";
import type { AuthorizationService } from "../../core/authorization";

export interface ValidateCouponResult {
	couponId: string;
	code: string;
	discount: number;
}

export class CouponsService {
	constructor(
		private readonly repo: CouponsRepository,
		private readonly authz: AuthorizationService,
	) {}

	async listByVenue(
		ownerId: string,
		venueId: string,
		query: PaginatedQueryDto,
	) {
		await this.authz.assertVenueOwner(ownerId, venueId);
		return this.repo.findAllByVenue(venueId, query);
	}

	async get(ownerId: string, id: string) {
		const coupon = await this.authz.assertCouponOwner(ownerId, id);
		return coupon;
	}

	async create(
		ownerId: string,
		venueId: string,
		data: Omit<CouponInsert, "venueId">,
	) {
		await this.authz.assertVenueOwner(ownerId, venueId);
		const result = await this.repo.create({
			...data,
			venueId,
			code: data.code.toUpperCase(),
		});
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(
		ownerId: string,
		couponId: string,
		data: Partial<Omit<CouponInsert, "venueId">>,
	) {
		await this.authz.assertCouponOwner(ownerId, couponId);
		const result = await this.repo.updateOne(couponId, data);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async delete(ownerId: string, couponId: string) {
		await this.authz.assertCouponOwner(ownerId, couponId);
		const result = await this.repo.deleteOne(couponId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	/**
	 * Validate a coupon code and compute the discount — does NOT yet increment usage.
	 * Call `applyUsage` after the booking is persisted successfully.
	 */
	async validate(
		code: string,
		venueId: string,
		price: number,
	): Promise<ValidateCouponResult> {
		const coupon = await this.repo.findActiveByCode(code, venueId);
		if (!coupon) throw new ValidationError("Invalid or expired coupon code");

		const discount =
			coupon.type === "Percentage"
				? Math.min(Math.round((price * coupon.value) / 100), price)
				: Math.min(coupon.value, price);

		return { couponId: coupon.id, code: coupon.code, discount };
	}

	/** Increment usage counter — throws ConflictError if the coupon just hit its limit. */
	async applyUsage(couponId: string): Promise<void> {
		const ok = await this.repo.incrementUsage(couponId);
		if (!ok) throw new ConflictError("Coupon is no longer available");
	}

	findByCode(code: string) {
		return this.repo.findByCode(code);
	}

	/** Find an active coupon scoped to a specific venue. Used during cancellation. */
	findByCodeAndVenue(code: string, venueId: string) {
		return this.repo.findActiveByCode(code, venueId);
	}

	/** Decrement usage counter — call if the associated booking is cancelled. */
	revertUsage(couponId: string) {
		return this.repo.decrementUsage(couponId);
	}
}
```

- [ ] **Step 4: Update the test factory to use the new constructor**

In the coupons service test, update `makeService` to:

```ts
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
	return new CouponsService(new CouponsRepository(db as never), authz);
}
```

- [ ] **Step 5: Run tests — must still PASS**

Run: `bun run --filter @repo/api test -- coupons.service`
Expected: PASS (8 tests).

- [ ] **Step 6: Update `injectServices` wiring**

In `workers/api/src/middleware/services.ts`, replace:

```ts
	const couponsService = new CouponsService(couponsRepo, venuesRepo);
```

with:

```ts
	const couponsService = new CouponsService(couponsRepo, authz);
```

> `authz` is already constructed before `couponsService`. `couponsService` is still passed as a dependency to `BookingsService` — no change needed there.

- [ ] **Step 7: Run full api test suite**

Run: `bun run --filter @repo/api test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add workers/api/src/modules/coupons/coupons.service.ts \
        workers/api/src/__tests__/modules/coupons/coupons.service.test.ts \
        workers/api/src/middleware/services.ts
git commit -m "refactor(api): migrate CouponsService to shared AuthorizationService

Drop venuesRepo dependency; use assertVenueOwner for listByVenue/create
and assertCouponOwner for get/update/delete. 8 characterization tests
pass unchanged.

Note: update/delete previously threw bare ForbiddenError(); message
is now normalized to 'You do not own this venue' (intentional).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Migrate `team`

**Files:**
- Modify: `workers/api/src/modules/team/team.service.ts`
- Modify: `workers/api/src/__tests__/modules/team/team.service.test.ts`
- Modify: `workers/api/src/middleware/services.ts`

- [ ] **Step 1: Replace the team service test with real-DB characterization tests**

Replace the entire contents of `workers/api/src/__tests__/modules/team/team.service.test.ts`:

```ts
import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import { VenuesRepository } from "@repo/core/src/database/repositories/venues.repository";
import { teamMembersSchema } from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { TeamService } from "../../../modules/team/team.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";

// NOTE: keep in sync with TeamService constructor.
// After Task 3 migration the constructor is (repo, authz).
function makeService(db: ReturnType<typeof createTestDb>) {
	return new TeamService(
		new TeamRepository(db as never),
		new VenuesRepository(db as never),
	);
}

async function seedMember(
	db: ReturnType<typeof createTestDb>,
	ownerId: string,
) {
	const { venueId } = await seedChain(db, { ownerId });
	const memberId = `member-${ownerId}`;
	await db.insert(teamMembersSchema).values({
		id: memberId,
		venueId,
		userId: `user-${ownerId}`,
		role: "staff",
		createdAt: TS,
	} as never);
	return { memberId, venueId };
}

describe("TeamService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("listByVenue: rejects a different owner (403)", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).listByVenue("owner-2", venueId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("listByVenue: throws 404 for a missing venue", async () => {
		await expect(
			makeService(db).listByVenue("owner-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("listByVenue: succeeds for the venue owner", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).listByVenue("owner-1", venueId);
		expect(result).toBeDefined();
	});

	it("add: rejects a different owner (403)", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).add("owner-2", venueId, {
				userId: "u-x",
				role: "staff",
			} as never),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("update: rejects a different owner (403)", async () => {
		const { memberId } = await seedMember(db, "owner-1");
		await expect(
			makeService(db).update("owner-2", memberId, { role: "manager" }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("update: throws 404 for a missing member", async () => {
		await expect(
			makeService(db).update("owner-1", "missing", { role: "manager" }),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("remove: rejects a different owner (403)", async () => {
		const { memberId } = await seedMember(db, "owner-1");
		await expect(
			makeService(db).remove("owner-2", memberId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
```

- [ ] **Step 2: Run tests — must PASS against current implementation**

Run: `bun run --filter @repo/api test -- team.service`
Expected: PASS (7 tests).

- [ ] **Step 3: Migrate `TeamService`**

Replace the entire contents of `workers/api/src/modules/team/team.service.ts`:

```ts
import type { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import type { TeamMemberInsert } from "@repo/core/src/database/schema";
import { ConflictError, NotFoundError } from "../../core/errors";
import type { AuthorizationService } from "../../core/authorization";

export class TeamService {
	constructor(
		private readonly repo: TeamRepository,
		private readonly authz: AuthorizationService,
	) {}

	async listByVenue(ownerId: string, venueId: string) {
		await this.authz.assertVenueOwner(ownerId, venueId);
		return this.repo.findByVenue(venueId);
	}

	async get(id: string) {
		const result = await this.repo.findOne(id);
		if (!result.data) throw new NotFoundError("Team member not found");
		return result.data;
	}

	async add(
		ownerId: string,
		venueId: string,
		data: Omit<TeamMemberInsert, "venueId">,
	) {
		await this.authz.assertVenueOwner(ownerId, venueId);

		const existing = await this.repo.findMembership(data.userId, venueId);
		if (existing)
			throw new ConflictError("User is already a team member of this venue");

		const result = await this.repo.create({ ...data, venueId });
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(
		ownerId: string,
		memberId: string,
		data: Partial<Pick<TeamMemberInsert, "title" | "role" | "branchId">>,
	) {
		await this.authz.assertTeamMemberOwner(ownerId, memberId);
		const result = await this.repo.updateOne(memberId, data);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async remove(ownerId: string, memberId: string) {
		await this.authz.assertTeamMemberOwner(ownerId, memberId);
		const result = await this.repo.deleteOne(memberId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}
}
```

- [ ] **Step 4: Update the test factory to use the new constructor**

In the team service test, update `makeService` to:

```ts
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
	return new TeamService(new TeamRepository(db as never), authz);
}
```

- [ ] **Step 5: Run tests — must still PASS**

Run: `bun run --filter @repo/api test -- team.service`
Expected: PASS (7 tests).

- [ ] **Step 6: Update `injectServices` wiring**

In `workers/api/src/middleware/services.ts`, replace:

```ts
	c.set("teamService", new TeamService(new TeamRepository(db), venuesRepo));
```

with:

```ts
	c.set("teamService", new TeamService(teamRepo, authz));
```

> This also deduplicate the `TeamRepository` instantiation — `teamRepo` is already constructed earlier in `injectServices`.

- [ ] **Step 7: Run full api test suite**

Run: `bun run --filter @repo/api test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add workers/api/src/modules/team/team.service.ts \
        workers/api/src/__tests__/modules/team/team.service.test.ts \
        workers/api/src/middleware/services.ts
git commit -m "refactor(api): migrate TeamService to shared AuthorizationService

Drop venuesRepo dependency; use assertVenueOwner for listByVenue/add
and assertTeamMemberOwner for update/remove. 7 characterization tests
pass unchanged. Also deduplicates TeamRepository instantiation in
injectServices.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Migrate `reviews`

**Files:**
- Modify: `workers/api/src/modules/reviews/reviews.service.ts`
- Modify: `workers/api/src/__tests__/modules/reviews/reviews.service.test.ts`
- Modify: `workers/api/src/middleware/services.ts`

- [ ] **Step 1: Replace the reviews service test with real-DB characterization tests**

Replace the entire contents of `workers/api/src/__tests__/modules/reviews/reviews.service.test.ts`:

```ts
import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import { VenuesRepository } from "@repo/core/src/database/repositories/venues.repository";
import {
	bookingsSchema,
	reviewsSchema,
} from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError, NotFoundError } from "../../../core/errors";
import { ReviewsService } from "../../../modules/reviews/reviews.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";

// NOTE: keep in sync with ReviewsService constructor.
// After Task 4 migration the constructor is (repo, bookingsRepo, branchesRepo, authz).
function makeService(db: ReturnType<typeof createTestDb>) {
	return new ReviewsService(
		new ReviewsRepository(db as never),
		new VenuesRepository(db as never),
		new BookingsRepository(db as never),
		new BranchesRepository(db as never),
	);
}

async function seedReview(
	db: ReturnType<typeof createTestDb>,
	ownerId: string,
) {
	const { venueId, branchId, serviceId } = await seedChain(db, { ownerId });
	const bookingId = `booking-${ownerId}`;
	const reviewId = `review-${ownerId}`;
	await db.insert(bookingsSchema).values({
		id: bookingId,
		userId: "cust-1",
		serviceId,
		branchId,
		slot: "2026-02-01T10:00:00",
		status: "Completed",
		price: 1000,
		createdAt: TS,
	} as never);
	await db.insert(reviewsSchema).values({
		id: reviewId,
		venueId,
		userId: "cust-1",
		bookingId,
		serviceId,
		rating: 5,
		text: "Great",
		status: "Pending",
		createdAt: TS,
	} as never);
	return { reviewId, venueId, bookingId };
}

describe("ReviewsService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
	});

	it("listPending: rejects a different owner (403)", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		await expect(
			makeService(db).listPending("owner-2", venueId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("listPending: throws 404 for a missing venue", async () => {
		await expect(
			makeService(db).listPending("owner-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("listPending: succeeds for the venue owner", async () => {
		const { venueId } = await seedChain(db, { ownerId: "owner-1" });
		const result = await makeService(db).listPending("owner-1", venueId);
		expect(result).toBeDefined();
	});

	it("approve: rejects a different owner (403)", async () => {
		const { reviewId } = await seedReview(db, "owner-1");
		await expect(
			makeService(db).approve("owner-2", reviewId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("approve: throws 404 for a missing review", async () => {
		await expect(
			makeService(db).approve("owner-1", "missing"),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("reject: rejects a different owner (403)", async () => {
		const { reviewId } = await seedReview(db, "owner-1");
		await expect(
			makeService(db).reject("owner-2", reviewId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
```

- [ ] **Step 2: Run tests — must PASS against current implementation**

Run: `bun run --filter @repo/api test -- reviews.service`
Expected: PASS (6 tests).

- [ ] **Step 3: Migrate `ReviewsService`**

Replace the entire contents of `workers/api/src/modules/reviews/reviews.service.ts`:

```ts
import type { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import type { ReviewInsert } from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../core/errors";

export interface SubmitReviewInput {
	bookingId: string;
	rating: number;
	text: string;
}

export class ReviewsService {
	constructor(
		private readonly repo: ReviewsRepository,
		private readonly bookingsRepo: BookingsRepository,
		private readonly branchesRepo: BranchesRepository,
		private readonly authz: AuthorizationService,
	) {}

	listPublished(venueId: string) {
		return this.repo.findPublishedByVenue(venueId);
	}

	async listPending(ownerId: string, venueId: string) {
		await this.authz.assertVenueOwner(ownerId, venueId);
		return this.repo.findPendingByVenue(venueId);
	}

	async submit(userId: string, input: SubmitReviewInput) {
		if (input.rating < 1 || input.rating > 5)
			throw new ValidationError("Rating must be 1–5");

		const booking = await this.bookingsRepo.findOne(input.bookingId);
		if (!booking.data) throw new NotFoundError("Booking not found");
		if (booking.data.userId !== userId)
			throw new ForbiddenError("You cannot review this booking");
		if (booking.data.status !== "Completed")
			throw new ValidationError("Only completed bookings can be reviewed");

		const branch = await this.branchesRepo.findOne(booking.data.branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");

		const data: ReviewInsert = {
			userId,
			venueId: branch.data.venueId,
			serviceId: booking.data.serviceId,
			bookingId: input.bookingId,
			rating: input.rating,
			text: input.text,
			status: "Pending",
		};

		try {
			const result = await this.repo.create(data);
			// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
			return result.data!;
		} catch (err) {
			if (
				err instanceof Error &&
				err.message.includes("UNIQUE constraint failed") &&
				err.message.includes("booking_id")
			) {
				throw new ConflictError("A review for this booking already exists");
			}
			throw err;
		}
	}

	async approve(ownerId: string, reviewId: string) {
		await this.authz.assertReviewOwner(ownerId, reviewId);
		const updated = await this.repo.updateStatus(reviewId, "Published");
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return updated.data!;
	}

	async reject(ownerId: string, reviewId: string) {
		await this.authz.assertReviewOwner(ownerId, reviewId);
		const deleted = await this.repo.softDelete(reviewId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return deleted.data!;
	}
}
```

- [ ] **Step 4: Update the test factory to use the new constructor**

In the reviews service test, update `makeService` to:

```ts
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
	return new ReviewsService(
		new ReviewsRepository(db as never),
		new BookingsRepository(db as never),
		new BranchesRepository(db as never),
		authz,
	);
}
```

- [ ] **Step 5: Run tests — must still PASS**

Run: `bun run --filter @repo/api test -- reviews.service`
Expected: PASS (6 tests).

- [ ] **Step 6: Update `injectServices` wiring**

In `workers/api/src/middleware/services.ts`, replace:

```ts
	c.set(
		"reviewsService",
		new ReviewsService(reviewsRepo, venuesRepo, bookingsRepo, branchesRepo),
	);
```

with:

```ts
	c.set(
		"reviewsService",
		new ReviewsService(reviewsRepo, bookingsRepo, branchesRepo, authz),
	);
```

- [ ] **Step 7: Run full api test suite**

Run: `bun run --filter @repo/api test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add workers/api/src/modules/reviews/reviews.service.ts \
        workers/api/src/__tests__/modules/reviews/reviews.service.test.ts \
        workers/api/src/middleware/services.ts
git commit -m "refactor(api): migrate ReviewsService to shared AuthorizationService

Drop venuesRepo; use assertVenueOwner for listPending and assertReviewOwner
for approve/reject. Eliminate private updateStatus helper. 6 characterization
tests pass unchanged.

Note: reject previously threw bare ForbiddenError(); normalized (intentional).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Migrate `bookings`

Bookings is more complex: it has extensive business-logic tests (slot conflicts, working hours, coupon validation) in the existing mock-based test file alongside authorization tests. The strategy is: (1) add real-DB auth characterization tests to the existing file, (2) update the mock `makeService` factory to replace `mockVenuesRepo` with `mockAuthz`, then (3) migrate the service.

**Files:**
- Modify: `workers/api/src/modules/bookings/bookings.service.ts`
- Modify: `workers/api/src/__tests__/modules/bookings/bookings.service.test.ts`
- Modify: `workers/api/src/middleware/services.ts`

- [ ] **Step 1: Add real-DB auth characterization tests to the bookings test file**

Read `workers/api/src/__tests__/modules/bookings/bookings.service.test.ts` first. Then append the following to the end of the file (after the last closing `}`):

```ts
// ── Real-DB authorization characterization tests ──────────────────────────

import {
	BookingsRepository as BookingsRepo,
	BranchesRepository as BranchesRepo,
	CouponsRepository as CouponsRepo,
	ReviewsRepository as ReviewsRepo,
	ServicesRepository as ServicesRepo,
	TeamRepository as TeamRepo,
	VenuesRepository as VenuesRepo,
} from "@repo/core/src/database/repositories";
```

> **Stop.** Don't import from a barrel `@repo/core/src/database/repositories` — it likely doesn't exist. Use individual paths. The real-DB section should instead be placed in a **new file**: `workers/api/src/__tests__/modules/bookings/bookings.service.auth.test.ts`.

Create `workers/api/src/__tests__/modules/bookings/bookings.service.auth.test.ts`:

```ts
import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import { VenuesRepository } from "@repo/core/src/database/repositories/venues.repository";
import { bookingsSchema } from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationService } from "../../../core/authorization";
import { ForbiddenError } from "../../../core/errors";
import { BookingsService } from "../../../modules/bookings/bookings.service";
import { seedChain } from "../../helpers/seed";
import { createTestDb } from "../../helpers/test-db";

const TS = "2026-01-01T00:00:00.000Z";

const stubQueue = { send: vi.fn().mockResolvedValue(undefined) } as never;
const stubCouponsService = {
	validate: vi.fn(),
	applyUsage: vi.fn(),
	findByCode: vi.fn(),
	findByCodeAndVenue: vi.fn(),
	revertUsage: vi.fn(),
} as never;

// NOTE: keep in sync with BookingsService constructor.
// After Task 5 migration the constructor is
// (repo, servicesRepo, branchesRepo, couponsService, queue, authz, teamRepo?).
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
	return new BookingsService(
		new BookingsRepository(db as never),
		new ServicesRepository(db as never),
		new BranchesRepository(db as never),
		stubCouponsService,
		stubQueue,
		new VenuesRepository(db as never),
		undefined,
	);
}

async function seedBooking(
	db: ReturnType<typeof createTestDb>,
	ownerId: string,
	userId: string,
) {
	const { branchId, serviceId } = await seedChain(db, { ownerId });
	const bookingId = `booking-${userId}-${ownerId}`;
	await db.insert(bookingsSchema).values({
		id: bookingId,
		userId,
		serviceId,
		branchId,
		slot: "2026-02-01T10:00:00",
		status: "Pending",
		price: 1000,
		createdAt: TS,
	} as never);
	return { bookingId, branchId };
}

describe("BookingsService authorization (characterization)", () => {
	let db: ReturnType<typeof createTestDb>;
	beforeEach(() => {
		db = createTestDb();
		vi.clearAllMocks();
	});

	it("get: rejects a different customer (403)", async () => {
		const { bookingId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).get("cust-2", bookingId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("listByBranch: rejects an owner who does not own the venue (403)", async () => {
		const { branchId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).listByBranch(branchId, null, "owner-2"),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("listByBranch: rejects a manager not assigned to the branch (403)", async () => {
		const { branchId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).listByBranch(branchId, ["other-branch"], "mgr"),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("confirm: rejects an owner who does not own the venue (403)", async () => {
		const { bookingId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).confirm("owner-2", bookingId, null),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("confirm: rejects a manager not assigned to the branch (403)", async () => {
		const { bookingId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).confirm("mgr", bookingId, ["other-branch"]),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("complete: rejects an owner who does not own the venue (403)", async () => {
		const { bookingId } = await seedBooking(db, "owner-1", "cust-1");
		// set to Confirmed first so the status check doesn't fire
		const bookingsRepo = new BookingsRepository(db as never);
		await bookingsRepo.updateStatus(bookingId, "Confirmed");
		await expect(
			makeService(db).complete("owner-2", bookingId, null),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("cancel: rejects a different customer (403)", async () => {
		const { bookingId } = await seedBooking(db, "owner-1", "cust-1");
		await expect(
			makeService(db).cancel("cust-2", bookingId),
		).rejects.toBeInstanceOf(ForbiddenError);
	});
});
```

- [ ] **Step 2: Run tests — must PASS against current implementation**

Run: `bun run --filter @repo/api test -- bookings.service.auth`
Expected: PASS (7 tests).

- [ ] **Step 3: Update the existing mock factory in `bookings.service.test.ts`**

In `workers/api/src/__tests__/modules/bookings/bookings.service.test.ts`, add a `mockAuthz` object near the top (alongside the existing mocks) and update `makeService`:

Add after `mockQueue`:

```ts
const mockAuthz = {
	assertBranchAccess: vi.fn().mockResolvedValue(undefined),
	assertBookingAccess: vi.fn().mockImplementation(async (_actorId, _bookingId, _scoped) => {
		// Returns fakeBooking — tests that need a different booking override this mock
		return (await mockRepo.findOne(_bookingId)).data;
	}),
	assertCustomerOwnsBooking: vi.fn().mockImplementation(async (_userId, _bookingId) => {
		return (await mockRepo.findOne(_bookingId)).data;
	}),
} as never;
```

Replace the existing `makeService`:

```ts
function makeService() {
	return new BookingsService(
		mockRepo as never,
		mockServicesRepo as never,
		mockBranchesRepo as never,
		mockCouponsService as never,
		mockQueue as never,
		mockAuthz,
	);
}
```

> This changes the constructor from 7 args (with `mockVenuesRepo` at position 6) to 6 args (with `mockAuthz` at position 6, `teamRepo` dropped since it was optional and unused in existing tests). The existing tests mock `mockBranchesRepo.findOne` and `mockVenuesRepo.findOne` for the ownership path — after migration those paths route through `mockAuthz` instead. Set `mockAuthz.assertBranchAccess` and `mockAuthz.assertBookingAccess` to resolve by default (allowing), and any test that wants to test rejection calls `mockAuthz.assertBookingAccess.mockRejectedValueOnce(new ForbiddenError(...))`.

- [ ] **Step 4: Run the existing mock tests — they must still pass (before migration)**

Run: `bun run --filter @repo/api test -- bookings.service.test`
> **Note:** These tests will FAIL now because `makeService` uses the new constructor but the old `BookingsService` still expects 7 args. This is expected — you are updating tests and service together. Proceed to Step 5.

- [ ] **Step 5: Migrate `BookingsService`**

Replace the entire contents of `workers/api/src/modules/bookings/bookings.service.ts`:

```ts
import type { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import type { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import type { QueueProducer } from "@repo/core/src/queue/producer";
import type { AuthorizationService } from "../../core/authorization";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../core/errors";
import type { CouponsService } from "../coupons/coupons.service";

export interface CreateBookingInput {
	serviceId: string;
	branchId: string;
	slot: string; // ISO local datetime: "2026-06-01T11:00:00"
	couponCode?: string;
	requestId?: string;
}

export class BookingsService {
	constructor(
		private readonly repo: BookingsRepository,
		private readonly servicesRepo: ServicesRepository,
		private readonly branchesRepo: BranchesRepository,
		private readonly couponsService: CouponsService,
		private readonly queue: QueueProducer,
		private readonly authz: AuthorizationService,
		private readonly teamRepo?: TeamRepository,
	) {}

	listByUser(userId: string) {
		return this.repo.findByUser(userId);
	}

	async listByBranch(
		branchId: string,
		scopedBranchIds: string[] | null,
		actorId: string,
	) {
		await this.authz.assertBranchAccess(actorId, branchId, scopedBranchIds);
		return this.repo.findByBranch(branchId);
	}

	async get(userId: string, bookingId: string) {
		const booking = await this.authz.assertCustomerOwnsBooking(
			userId,
			bookingId,
		);
		return booking;
	}

	async create(userId: string, input: CreateBookingInput) {
		const svcResult = await this.servicesRepo.findOne(input.serviceId);
		if (!svcResult.data) throw new NotFoundError("Service not found");
		if (svcResult.data.branchId !== input.branchId) {
			throw new ValidationError("Service does not belong to this branch");
		}

		if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(input.slot)) {
			throw new ValidationError(
				"Slot must be an ISO local datetime, e.g. 2026-06-01T11:00:00",
			);
		}

		const conflict = await this.repo.findConflict(
			input.branchId,
			input.serviceId,
			input.slot,
		);
		if (conflict) throw new ConflictError("This slot is no longer available");

		const slotStart = input.slot;
		const slotEnd = this.addMinutes(input.slot, svcResult.data.duration);
		const overlapCount = await this.repo.countOverlapping(
			input.branchId,
			slotStart,
			slotEnd,
		);
		if (overlapCount > 0)
			throw new ConflictError(
				"The requested time window overlaps with an existing booking",
			);

		const branchResult = await this.branchesRepo.findOne(input.branchId);
		if (!branchResult.data) throw new NotFoundError("Branch not found");
		const venueId = branchResult.data.venueId;

		const slotDateStr = input.slot.slice(0, 10);
		const dayOfWeek = new Date(`${slotDateStr}T12:00:00`).getDay();
		const hours = await this.branchesRepo.findHoursForSlot(
			input.branchId,
			dayOfWeek,
		);
		if (hours) {
			if (hours.isClosed)
				throw new ValidationError("The branch is closed on the requested day");
			if (hours.openTime && hours.closeTime) {
				const toMins = (hhmm: string) => {
					const [h, m] = hhmm.split(":").map(Number);
					return h * 60 + (m ?? 0);
				};
				const slotMins = toMins(input.slot.slice(11, 16));
				const endMins = slotMins + svcResult.data.duration;
				const openMins = toMins(hours.openTime);
				const closeMins = toMins(hours.closeTime);
				if (slotMins < openMins || endMins > closeMins) {
					throw new ValidationError(
						`Slot must be within branch hours: ${hours.openTime}–${hours.closeTime}`,
					);
				}
			}
		}

		let discount = 0;
		let couponId: string | undefined;
		if (input.couponCode) {
			const validated = await this.couponsService.validate(
				input.couponCode,
				venueId,
				svcResult.data.price,
			);
			discount = validated.discount;
			couponId = validated.couponId;
			await this.couponsService.applyUsage(couponId);
		}

		let booking;
		try {
			const result = await this.repo.create({
				userId,
				serviceId: input.serviceId,
				branchId: input.branchId,
				slot: input.slot,
				status: "Pending",
				price: svcResult.data.price,
				discount,
				couponCode: input.couponCode ?? null,
			});
			booking = result.data!;
		} catch (err) {
			if (couponId) await this.couponsService.revertUsage(couponId);
			if (
				err instanceof Error &&
				err.message.includes("UNIQUE constraint failed")
			) {
				throw new ConflictError("This slot is no longer available");
			}
			throw err;
		}

		await this.queue.send({
			type: "notification.booking_created",
			bookingId: booking.id,
			requestId: input.requestId,
		});
		return booking;
	}

	async confirm(
		actorId: string,
		bookingId: string,
		scopedBranchIds: string[] | null,
	) {
		const booking = await this.authz.assertBookingAccess(
			actorId,
			bookingId,
			scopedBranchIds,
		);
		if (booking.status !== "Pending") {
			throw new ConflictError("Only Pending bookings can be confirmed");
		}
		const updated = await this.repo.updateStatus(bookingId, "Confirmed");
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return updated.data!;
	}

	async complete(
		actorId: string,
		bookingId: string,
		scopedBranchIds: string[] | null,
	) {
		const booking = await this.authz.assertBookingAccess(
			actorId,
			bookingId,
			scopedBranchIds,
		);
		if (booking.status !== "Confirmed") {
			throw new ConflictError(
				"Only Confirmed bookings can be marked Completed",
			);
		}

		const updated = await this.repo.updateStatus(bookingId, "Completed");
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		const completed = updated.data!;

		await this.queue.send({
			type: "rewards.credit",
			userId: completed.userId,
			bookingId: completed.id,
		});

		return completed;
	}

	async assignStaff(
		actorId: string,
		bookingId: string,
		staffId: string | null,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertBookingAccess(actorId, bookingId, scopedBranchIds);
		if (staffId !== null && this.teamRepo) {
			const member = await this.teamRepo.findOne(staffId);
			if (!member.data) throw new NotFoundError("Staff member not found");
		}
		const updated = await this.repo.assignStaff(bookingId, staffId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return updated.data!;
	}

	private addMinutes(isoLocal: string, minutes: number): string {
		const dt = new Date(isoLocal.replace("T", " ").replace(/-/g, "/"));
		dt.setMinutes(dt.getMinutes() + minutes);
		return dt.toISOString().slice(0, 19).replace("T", "T");
	}

	async cancel(userId: string, bookingId: string) {
		const booking = await this.authz.assertCustomerOwnsBooking(
			userId,
			bookingId,
		);
		if (booking.status === "Cancelled")
			throw new ConflictError("Booking is already cancelled");
		if (booking.status === "Completed")
			throw new ConflictError("Completed bookings cannot be cancelled");

		if (booking.couponCode) {
			const branch = await this.branchesRepo.findOne(booking.branchId);
			const venueId = branch.data?.venueId;
			if (venueId) {
				const coupon = await this.couponsService.findByCodeAndVenue(
					booking.couponCode,
					venueId,
				);
				if (coupon) await this.couponsService.revertUsage(coupon.id);
			}
		}

		const updated = await this.repo.updateStatus(bookingId, "Cancelled");

		await this.queue.send({
			type: "notification.booking_cancelled",
			bookingId,
		});
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return updated.data!;
	}
}
```

> **Key change in `get`:** the new implementation returns the booking directly from `assertCustomerOwnsBooking`. The old implementation fetched the booking, checked ownership, then returned it — same behavior, fewer DB calls.
>
> **Key change in `confirm`/`complete`:** `assertBookingAccess` fetches and returns the booking, so the inline `findOne` call is eliminated and the status is read from the returned booking.

- [ ] **Step 6: Update the existing mock tests to fix `confirm`/`complete`/`cancel` expectations**

The existing mock tests for `confirm`, `complete`, and `cancel` set up `mockRepo.findOne` to return the booking AND `mockBranchesRepo.findOne` + `mockVenuesRepo.findOne` for the ownership path. After migration:
- `confirm`/`complete`/`assignStaff` use `mockAuthz.assertBookingAccess` (already mocked above to return `mockRepo.findOne` result)
- `get`/`cancel` use `mockAuthz.assertCustomerOwnsBooking` (already mocked above)
- The existing tests for `get` and `cancel` that assert `ForbiddenError` when `userId !== booking.userId` now need to use `mockAuthz.assertCustomerOwnsBooking.mockRejectedValueOnce(new ForbiddenError("..."))` instead of setting `mockRepo.findOne` to return a booking with a different `userId`

Read the existing test file carefully. For any test that:
1. Tests a 403 by returning a booking with a different `userId` → change to `mockAuthz.assertCustomerOwnsBooking.mockRejectedValueOnce(new ForbiddenError("You do not own this booking"))`
2. Tests a 403 by returning a branch/venue owned by someone else → change to `mockAuthz.assertBookingAccess.mockRejectedValueOnce(new ForbiddenError("You do not own this venue"))`
3. Tests a 404 from missing booking → change to `mockAuthz.assertBookingAccess.mockRejectedValueOnce(new NotFoundError("Booking not found"))` or `mockAuthz.assertCustomerOwnsBooking.mockRejectedValueOnce(new NotFoundError(...))`
4. Tests successful path (no auth failure) → existing mocks already resolve, no change needed except `mockRepo.findOne` is still needed for business logic in `create`/`cancel`

- [ ] **Step 7: Update `makeService` in `bookings.service.auth.test.ts` to use the new constructor**

The auth test file's `makeService` still passes `new VenuesRepository(db as never)` at position 6. After migration it must pass `authz` instead. Replace the `makeService` function in `bookings.service.auth.test.ts` with:

```ts
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
	return new BookingsService(
		new BookingsRepository(db as never),
		new ServicesRepository(db as never),
		new BranchesRepository(db as never),
		stubCouponsService,
		stubQueue,
		authz,
		undefined,
	);
}
```

- [ ] **Step 8: Run the bookings auth tests — must pass**

Run: `bun run --filter @repo/api test -- bookings.service.auth`
Expected: PASS (7 tests).

- [ ] **Step 9: Run all bookings service tests — must pass**

Run: `bun run --filter @repo/api test -- bookings.service`
Expected: PASS (all tests in both `bookings.service.test.ts` and `bookings.service.auth.test.ts`).

- [ ] **Step 10: Update `injectServices` wiring**

In `workers/api/src/middleware/services.ts`, replace:

```ts
	c.set(
		"bookingsService",
		new BookingsService(
			bookingsRepo,
			servicesRepo,
			branchesRepo,
			couponsService,
			queue,
			venuesRepo,
			teamRepo,
		),
	);
```

with:

```ts
	c.set(
		"bookingsService",
		new BookingsService(
			bookingsRepo,
			servicesRepo,
			branchesRepo,
			couponsService,
			queue,
			authz,
			teamRepo,
		),
	);
```

- [ ] **Step 11: Run full api test suite**

Run: `bun run --filter @repo/api test`
Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add workers/api/src/modules/bookings/bookings.service.ts \
        workers/api/src/__tests__/modules/bookings/bookings.service.test.ts \
        workers/api/src/__tests__/modules/bookings/bookings.service.auth.test.ts \
        workers/api/src/middleware/services.ts
git commit -m "refactor(api): migrate BookingsService to shared AuthorizationService

Drop venuesRepo and private assertVenueOwner; use assertBranchAccess for
listByBranch, assertBookingAccess for confirm/complete/assignStaff, and
assertCustomerOwnsBooking for get/cancel. 7 real-DB auth tests added.

Note: get/cancel bare ForbiddenError() messages normalized (intentional).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Documentation + final verification

**Files:**
- Modify: `docs/guides/api-query-repository-pattern.md`

- [ ] **Step 1: Update the authorization guard section**

In `docs/guides/api-query-repository-pattern.md`, find section 18 ("Authorization guard") and replace the last paragraph ("New owner-scoped endpoints must call the guard rather than comparing `ownerId` inline. Remaining modules ...") with:

```markdown
New owner-scoped endpoints must call the guard rather than comparing `ownerId` inline.

All owner-scoped modules (`services`, `branches`, `coupons`, `team`, `reviews`,
`bookings`) now route through the shared guard. To migrate a future module, follow
the same pattern: characterize the current 403/404 contract in a real-DB test using
`createTestDb` + `seedChain`, then replace inline ownership checks with the
appropriate guard method.
```

- [ ] **Step 2: Run lint on changed source files**

```bash
bunx biome check workers/api/src/modules/bookings/bookings.service.ts \
  workers/api/src/modules/branches/branches.service.ts \
  workers/api/src/modules/coupons/coupons.service.ts \
  workers/api/src/modules/team/team.service.ts \
  workers/api/src/modules/reviews/reviews.service.ts \
  workers/api/src/middleware/services.ts
```

Expected: at most 5 infos (non-null assertions — already biome-ignored), no errors.

- [ ] **Step 3: Run full test suite + build**

```bash
bun run --filter @repo/core test && bun run --filter @repo/api test
cd workers/api && bunx wrangler deploy --dry-run --outdir /tmp/api-build-f2p2
```

Expected: all tests pass, wrangler dry-run succeeds.

- [ ] **Step 4: Commit**

```bash
git add docs/guides/api-query-repository-pattern.md
git commit -m "docs(api): mark F2 Phase 2 complete — all modules migrated to auth guard

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review Notes (for the implementer)

- **PRD #26 coverage after this phase:** stories 1–7 (cross-owner 403 for venues/branches/services/coupons/bookings/team/reviews), 8–9 (branch-scope for managers/staff), 10 (404/403 distinction), 12–13 (centralized ownership chains), 16 (all modules route through guard), 17 (suite stays green). Stories 14–15 (`requireRole`/`requireVenueStaff` convergence) are still deferred.
- **`venuesRepo` becomes unused** in `injectServices` once all 5 modules are migrated. Leave it in place — `branchesService` and `bookingsService` still reference `venuesRepo` indirectly via the guard's constructor. The guard is constructed from `venuesRepo`. Do not remove `venuesRepo`.
- **Existing test files replaced with real-DB versions** for branches/coupons/team/reviews — this is intentional. The mock tests were written against old constructors and tested authorization paths that the guard now owns. The real-DB tests are more valuable at this seam.
- **Bookings keeps mock tests** for `create` (slot conflict, working hours, coupon validation) because that logic doesn't route through the guard and is best verified with controlled mocks.
- **`bookings.service.auth.test.ts` is a separate file** to avoid mixing mock and real-DB setups in one module. Both files run via `bun run --filter @repo/api test -- bookings.service`.
- **Behavior differences to note in commit messages:** bare `ForbiddenError()` messages normalized; orphaned-venue edge returns 404 instead of 403.
- **After all tasks complete:** check off F2 in issue #23 by commenting on it. Issue #26 can be closed — the PRD is implemented (route middleware convergence is a separate follow-up per the PRD's Out of Scope section).
