import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../../core/errors";
import { PaymentsService } from "../../../modules/payments/payments.service";

const repo = {
	create: vi.fn(),
	findOne: vi.fn(),
	voidPayment: vi.fn(),
	findByBusinessCustomer: vi.fn(),
};
const authz = { assertBusinessOwner: vi.fn(), assertOrderAccess: vi.fn() };

function makeService() {
	return new PaymentsService(repo as never, authz as never);
}

beforeEach(() => vi.clearAllMocks());

describe("PaymentsService.record", () => {
	it("records a payment for the owner with recordedBy = actor", async () => {
		authz.assertBusinessOwner.mockResolvedValue({
			id: "biz1",
			ownerId: "owner-1",
		});
		repo.create.mockResolvedValue({ id: "pay1", amount: 500 });
		const res = await makeService().record("owner-1", {
			businessId: "biz1",
			userId: "u1",
			amount: 500,
			note: "cash",
		});
		expect(res).toEqual({ id: "pay1", amount: 500 });
		expect(authz.assertBusinessOwner).toHaveBeenCalledWith("owner-1", "biz1");
		expect(repo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				businessId: "biz1",
				userId: "u1",
				amount: 500,
				note: "cash",
				recordedBy: "owner-1",
				orderId: null,
			}),
		);
	});

	it("defaults note to null when omitted", async () => {
		authz.assertBusinessOwner.mockResolvedValue({
			id: "biz1",
			ownerId: "owner-1",
		});
		repo.create.mockResolvedValue({ id: "pay2" });
		await makeService().record("owner-1", {
			businessId: "biz1",
			userId: "u1",
			amount: 300,
		});
		expect(repo.create).toHaveBeenCalledWith(
			expect.objectContaining({ note: null, orderId: null }),
		);
	});

	it("rejects a non-owner with ForbiddenError", async () => {
		authz.assertBusinessOwner.mockRejectedValue(new ForbiddenError("no"));
		await expect(
			makeService().record("owner-1", {
				businessId: "biz1",
				userId: "u1",
				amount: 500,
			}),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(repo.create).not.toHaveBeenCalled();
	});

	it("rejects a non-integer amount with ValidationError (before auth)", async () => {
		await expect(
			makeService().record("owner-1", {
				businessId: "biz1",
				userId: "u1",
				amount: 1.5,
			}),
		).rejects.toBeInstanceOf(ValidationError);
		expect(authz.assertBusinessOwner).not.toHaveBeenCalled();
	});

	it("rejects a non-positive amount with ValidationError (before auth)", async () => {
		await expect(
			makeService().record("owner-1", {
				businessId: "biz1",
				userId: "u1",
				amount: 0,
			}),
		).rejects.toBeInstanceOf(ValidationError);
		expect(authz.assertBusinessOwner).not.toHaveBeenCalled();
	});

	it("records with an orderId that belongs to the same business + customer", async () => {
		authz.assertBusinessOwner.mockResolvedValue({ id: "biz1" });
		authz.assertOrderAccess.mockResolvedValue({
			id: "ord1",
			businessId: "biz1",
			userId: "u1",
		});
		repo.create.mockResolvedValue({ id: "pay3", orderId: "ord1" });
		await makeService().record("owner-1", {
			businessId: "biz1",
			userId: "u1",
			amount: 500,
			orderId: "ord1",
		});
		expect(authz.assertOrderAccess).toHaveBeenCalledWith(
			"owner-1",
			"ord1",
			null,
		);
		expect(repo.create).toHaveBeenCalledWith(
			expect.objectContaining({ orderId: "ord1" }),
		);
	});

	it("rejects an orderId from a different business with ValidationError", async () => {
		authz.assertBusinessOwner.mockResolvedValue({ id: "biz1" });
		authz.assertOrderAccess.mockResolvedValue({
			id: "ord1",
			businessId: "biz2",
			userId: "u1",
		});
		await expect(
			makeService().record("owner-1", {
				businessId: "biz1",
				userId: "u1",
				amount: 500,
				orderId: "ord1",
			}),
		).rejects.toBeInstanceOf(ValidationError);
		expect(repo.create).not.toHaveBeenCalled();
	});

	it("rejects an orderId belonging to a different customer with ValidationError", async () => {
		authz.assertBusinessOwner.mockResolvedValue({ id: "biz1" });
		authz.assertOrderAccess.mockResolvedValue({
			id: "ord1",
			businessId: "biz1",
			userId: "someone-else",
		});
		await expect(
			makeService().record("owner-1", {
				businessId: "biz1",
				userId: "u1",
				amount: 500,
				orderId: "ord1",
			}),
		).rejects.toBeInstanceOf(ValidationError);
		expect(repo.create).not.toHaveBeenCalled();
	});

	it("propagates a NotFound/Forbidden from assertOrderAccess for a bogus orderId", async () => {
		authz.assertBusinessOwner.mockResolvedValue({ id: "biz1" });
		authz.assertOrderAccess.mockRejectedValue(
			new NotFoundError("Order not found"),
		);
		await expect(
			makeService().record("owner-1", {
				businessId: "biz1",
				userId: "u1",
				amount: 500,
				orderId: "ghost",
			}),
		).rejects.toBeInstanceOf(NotFoundError);
		expect(repo.create).not.toHaveBeenCalled();
	});
});

describe("PaymentsService.void", () => {
	it("soft-deletes a payment the owner owns", async () => {
		repo.findOne.mockResolvedValue({ id: "pay1", businessId: "biz1" });
		authz.assertBusinessOwner.mockResolvedValue({
			id: "biz1",
			ownerId: "owner-1",
		});
		await makeService().void("owner-1", "pay1");
		expect(authz.assertBusinessOwner).toHaveBeenCalledWith("owner-1", "biz1");
		expect(repo.voidPayment).toHaveBeenCalledWith("pay1", expect.any(String));
	});

	it("404s a missing payment", async () => {
		repo.findOne.mockResolvedValue(null);
		await expect(makeService().void("owner-1", "nope")).rejects.toBeInstanceOf(
			NotFoundError,
		);
		expect(authz.assertBusinessOwner).not.toHaveBeenCalled();
	});

	it("403s a cross-business void", async () => {
		repo.findOne.mockResolvedValue({ id: "pay1", businessId: "biz1" });
		authz.assertBusinessOwner.mockRejectedValue(new ForbiddenError("no"));
		await expect(makeService().void("owner-1", "pay1")).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(repo.voidPayment).not.toHaveBeenCalled();
	});
});
