import { AuthRepository } from "@repo/core/src/database/repositories/auth.repository";
import { UserRole } from "@repo/core/src/database/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../helpers/test-db";

type Db = ReturnType<typeof createTestDb>;

describe("AuthRepository.findOrCreateUserByGoogle (per-role identifiers)", () => {
	let db: Db;
	let repo: AuthRepository;

	beforeEach(() => {
		db = createTestDb();
		repo = new AuthRepository(db as never);
	});

	it("creates a new account on first sign-in for a role", async () => {
		const { user, isNew } = await repo.findOrCreateUserByGoogle(
			"google-1",
			"a@example.com",
			"Alice",
			UserRole.USER,
		);
		expect(isNew).toBe(true);
		expect(user.role).toBe(UserRole.USER);
		expect(user.email).toBe("a@example.com");
	});

	it("returns the same account on repeat sign-in for the same role", async () => {
		const first = await repo.findOrCreateUserByGoogle(
			"google-1",
			"a@example.com",
			"Alice",
			UserRole.USER,
		);
		const second = await repo.findOrCreateUserByGoogle(
			"google-1",
			"a@example.com",
			"Alice",
			UserRole.USER,
		);
		expect(second.isNew).toBe(false);
		expect(second.user.id).toBe(first.user.id);
	});

	it("lets the same email/Google account hold a separate account per role", async () => {
		const asUser = await repo.findOrCreateUserByGoogle(
			"google-1",
			"a@example.com",
			"Alice",
			UserRole.USER,
		);
		const asOwner = await repo.findOrCreateUserByGoogle(
			"google-1",
			"a@example.com",
			"Alice",
			UserRole.OWNER,
		);

		expect(asOwner.isNew).toBe(true);
		expect(asOwner.user.id).not.toBe(asUser.user.id);
		expect(asOwner.user.role).toBe(UserRole.OWNER);
		expect(asUser.user.role).toBe(UserRole.USER);
		// Same identifiers, two distinct rows
		expect(asOwner.user.email).toBe(asUser.user.email);
		expect(asOwner.user.googleId).toBe(asUser.user.googleId);
	});

	it("links an existing same-role email account to the Google ID instead of duplicating", async () => {
		// Pre-existing email-only account for the USER role
		const created = await repo.findOrCreateUserByGoogle(
			"google-1",
			"a@example.com",
			"Alice",
			UserRole.USER,
		);
		// A different Google ID, same email + role -> should link, not create
		const linked = await repo.findOrCreateUserByGoogle(
			"google-2",
			"a@example.com",
			"Alice",
			UserRole.USER,
		);
		expect(linked.isNew).toBe(false);
		expect(linked.user.id).toBe(created.user.id);
		expect(linked.user.googleId).toBe("google-2");
	});

	it("defaults to the user role when none is supplied", async () => {
		const { user } = await repo.findOrCreateUserByGoogle(
			"google-1",
			"a@example.com",
			"Alice",
		);
		expect(user.role).toBe(UserRole.USER);
	});
});
