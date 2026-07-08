import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ConflictError,
	ForbiddenError,
	ValidationError,
} from "../../../core/errors";
import { OrdersService } from "../../../modules/orders/orders.service";

const repo = {
	findAll: vi.fn(),
	findOne: vi.fn(),
	findByUser: vi.fn(),
	findByBranch: vi.fn(),
	findItems: vi.fn(),
	placeOrder: vi.fn(),
	cancelAndRestore: vi.fn(),
	updateStatus: vi.fn(),
};
const addressesRepo = { findOne: vi.fn() };
const branchesRepo = { findOne: vi.fn() };
const productsRepo = { findOne: vi.fn() };
const authz = {
	assertOrderAccess: vi.fn(),
	assertCustomerOwnsOrder: vi.fn(),
	assertBranchAccess: vi.fn(),
};
const queue = { send: vi.fn() };

function makeService() {
	return new OrdersService(
		repo as never,
		addressesRepo as never,
		branchesRepo as never,
		productsRepo as never,
		authz as never,
		queue as never,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("OrdersService.create", () => {
	it("snapshots address + prices, derives businessId, places the order", async () => {
		branchesRepo.findOne.mockResolvedValue({
			data: { id: "b1", businessId: "biz1" },
		});
		addressesRepo.findOne.mockResolvedValue({
			data: {
				id: "a1",
				userId: "u1",
				line: "12 Road",
				area: "Banani",
				city: "Dhaka",
				lat: 1,
				lng: 2,
			},
		});
		productsRepo.findOne.mockResolvedValueOnce({
			data: { id: "p1", branchId: "b1", price: 1200, stock: 10 },
		});
		repo.placeOrder.mockResolvedValue(undefined);

		const order = await makeService().create("u1", {
			branchId: "b1",
			addressId: "a1",
			items: [{ productId: "p1", quantity: 2 }],
		});

		expect(order.businessId).toBe("biz1");
		expect(order.total).toBe(2400);
		expect(order.deliveryLine).toBe("12 Road");
		expect(repo.placeOrder).toHaveBeenCalledOnce();
	});

	it("maps a CHECK constraint violation to 409 (oversell)", async () => {
		branchesRepo.findOne.mockResolvedValue({
			data: { id: "b1", businessId: "biz1" },
		});
		addressesRepo.findOne.mockResolvedValue({
			data: { id: "a1", userId: "u1", line: "x" },
		});
		productsRepo.findOne.mockResolvedValue({
			data: { id: "p1", branchId: "b1", price: 100, stock: 1 },
		});
		repo.placeOrder.mockRejectedValue(
			Object.assign(
				new Error("CHECK constraint failed: products_stock_nonneg"),
				{
					code: "SQLITE_CONSTRAINT_CHECK",
				},
			),
		);

		await expect(
			makeService().create("u1", {
				branchId: "b1",
				addressId: "a1",
				items: [{ productId: "p1", quantity: 5 }],
			}),
		).rejects.toBeInstanceOf(ConflictError);
	});

	it("rejects an address that belongs to another user", async () => {
		branchesRepo.findOne.mockResolvedValue({
			data: { id: "b1", businessId: "biz1" },
		});
		addressesRepo.findOne.mockResolvedValue({
			data: { id: "a1", userId: "someone-else", line: "x" },
		});
		await expect(
			makeService().create("u1", {
				branchId: "b1",
				addressId: "a1",
				items: [{ productId: "p1", quantity: 1 }],
			}),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("rejects a product that belongs to a different branch (422)", async () => {
		branchesRepo.findOne.mockResolvedValue({
			data: { id: "b1", businessId: "biz1" },
		});
		addressesRepo.findOne.mockResolvedValue({
			data: { id: "a1", userId: "u1", line: "x" },
		});
		productsRepo.findOne.mockResolvedValue({
			data: { id: "p1", branchId: "OTHER", price: 100, stock: 10 },
		});
		await expect(
			makeService().create("u1", {
				branchId: "b1",
				addressId: "a1",
				items: [{ productId: "p1", quantity: 1 }],
			}),
		).rejects.toBeInstanceOf(ValidationError);
	});
});

describe("OrdersService.updateStatus", () => {
	it("allows Pending -> Confirmed", async () => {
		authz.assertOrderAccess.mockResolvedValue({ id: "o1", status: "Pending" });
		repo.updateStatus.mockResolvedValue({
			data: { id: "o1", status: "Confirmed" },
		});
		const res = await makeService().updateStatus(
			"owner",
			"o1",
			"Confirmed",
			null,
		);
		expect(res.status).toBe("Confirmed");
	});

	it("rejects Delivered -> Pending (422)", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Delivered",
		});
		await expect(
			makeService().updateStatus("owner", "o1", "Pending", null),
		).rejects.toBeInstanceOf(ValidationError);
	});

	it("stamps deliveredAt when moving to Delivered", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "OutForDelivery",
		});
		repo.updateStatus.mockResolvedValue({
			data: { id: "o1", status: "Delivered" },
		});
		await makeService().updateStatus("owner", "o1", "Delivered", null);
		const extra = repo.updateStatus.mock.calls[0][3];
		expect(extra.deliveredAt).toBeTruthy();
	});
});

describe("OrdersService queue + owner-cancel", () => {
	it("updateStatus (forward) enqueues an order_status_changed job", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Pending",
			userId: "u1",
		});
		repo.updateStatus.mockResolvedValue({
			data: { id: "o1", status: "Confirmed" },
		});
		await makeService().updateStatus("owner", "o1", "Confirmed", null);
		expect(queue.send).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "notification.order_status_changed",
				orderId: "o1",
				status: "Confirmed",
			}),
		);
	});

	it("owner cancels via updateStatus('Cancelled'): assertOrderAccess, restores stock, enqueues Cancelled, no plain update", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Confirmed",
			userId: "u1",
		});
		repo.findItems.mockResolvedValue([{ productId: "p1", quantity: 2 }]);
		repo.cancelAndRestore.mockResolvedValue(true);
		repo.findOne.mockResolvedValue({ data: { id: "o1", status: "Cancelled" } });
		const res = await makeService().updateStatus(
			"owner",
			"o1",
			"Cancelled",
			null,
		);
		expect(authz.assertOrderAccess).toHaveBeenCalledWith("owner", "o1", null);
		expect(repo.cancelAndRestore).toHaveBeenCalledOnce();
		expect(repo.updateStatus).not.toHaveBeenCalled();
		expect(res.status).toBe("Cancelled");
		expect(queue.send).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "notification.order_status_changed",
				orderId: "o1",
				status: "Cancelled",
			}),
		);
	});

	it("forward transition whose CAS misses (status changed under us) throws 422 and does not enqueue", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Pending",
			userId: "u1",
		});
		repo.updateStatus.mockResolvedValue({ data: null }); // CAS miss
		repo.findOne.mockResolvedValue({ data: { id: "o1", status: "Confirmed" } });
		await expect(
			makeService().updateStatus("owner", "o1", "Confirmed", null),
		).rejects.toBeInstanceOf(ValidationError);
		expect(queue.send).not.toHaveBeenCalled();
	});

	it("owner updateStatus('Cancelled') on a Delivered order is rejected (422)", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Delivered",
		});
		await expect(
			makeService().updateStatus("owner", "o1", "Cancelled", null),
		).rejects.toBeInstanceOf(ValidationError);
	});

	it("customer cancel uses assertCustomerOwnsOrder, restores stock, enqueues Cancelled", async () => {
		authz.assertCustomerOwnsOrder.mockResolvedValue({
			id: "o1",
			status: "Pending",
			userId: "u1",
		});
		repo.findItems.mockResolvedValue([]);
		repo.cancelAndRestore.mockResolvedValue(true);
		await makeService().cancel("u1", "o1");
		expect(authz.assertCustomerOwnsOrder).toHaveBeenCalledWith("u1", "o1");
		expect(queue.send).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "notification.order_status_changed",
				orderId: "o1",
				status: "Cancelled",
			}),
		);
	});

	it("forward transition on a guest/counter order (userId null) succeeds without enqueueing", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Pending",
			userId: null,
		});
		repo.updateStatus.mockResolvedValue({
			data: { id: "o1", status: "Confirmed" },
		});
		const result = await makeService().updateStatus(
			"owner",
			"o1",
			"Confirmed",
			null,
		);
		expect(result.status).toBe("Confirmed");
		expect(queue.send).not.toHaveBeenCalled();
	});

	it("sequential double-cancel (second load already Cancelled) is idempotent — no items read, no batch, no enqueue", async () => {
		authz.assertCustomerOwnsOrder.mockResolvedValue({
			id: "o1",
			status: "Cancelled",
			userId: "u1",
		});
		await expect(makeService().cancel("u1", "o1")).resolves.toBeUndefined();
		expect(repo.findItems).not.toHaveBeenCalled();
		expect(repo.cancelAndRestore).not.toHaveBeenCalled();
		expect(queue.send).not.toHaveBeenCalled();
	});

	it("duplicate/concurrent cancel on an already-Cancelled order is idempotent — no throw, no enqueue", async () => {
		authz.assertCustomerOwnsOrder.mockResolvedValue({
			id: "o1",
			status: "Confirmed",
			userId: "u1",
		});
		repo.findItems.mockResolvedValue([{ productId: "p1", quantity: 1 }]);
		repo.cancelAndRestore.mockResolvedValue(false); // lost the race
		repo.findOne.mockResolvedValue({ data: { id: "o1", status: "Cancelled" } });
		await expect(makeService().cancel("u1", "o1")).resolves.toBeUndefined();
		expect(queue.send).not.toHaveBeenCalled();
	});

	it("cancel that lost to a forward transition throws 422", async () => {
		authz.assertCustomerOwnsOrder.mockResolvedValue({
			id: "o1",
			status: "Confirmed",
			userId: "u1",
		});
		repo.findItems.mockResolvedValue([{ productId: "p1", quantity: 1 }]);
		repo.cancelAndRestore.mockResolvedValue(false);
		repo.findOne.mockResolvedValue({
			data: { id: "o1", status: "OutForDelivery" },
		});
		await expect(makeService().cancel("u1", "o1")).rejects.toBeInstanceOf(
			ValidationError,
		);
		expect(queue.send).not.toHaveBeenCalled();
	});

	it("guest/walk-in order (no userId) is cancelled but enqueues no notification", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Confirmed",
			userId: null,
		});
		repo.findItems.mockResolvedValue([{ productId: "p1", quantity: 1 }]);
		repo.cancelAndRestore.mockResolvedValue(true);
		repo.findOne.mockResolvedValue({ data: { id: "o1", status: "Cancelled" } });
		await makeService().updateStatus("owner", "o1", "Cancelled", null);
		expect(repo.cancelAndRestore).toHaveBeenCalledOnce();
		expect(queue.send).not.toHaveBeenCalled();
	});

	it("owner-cancel returns the persisted row (with updatedAt), not a synthesized snapshot", async () => {
		authz.assertOrderAccess.mockResolvedValue({
			id: "o1",
			status: "Confirmed",
			userId: "u1",
		});
		repo.findItems.mockResolvedValue([]);
		repo.cancelAndRestore.mockResolvedValue(true);
		repo.findOne.mockResolvedValue({
			data: {
				id: "o1",
				status: "Cancelled",
				updatedAt: "2026-06-13T00:00:00.000Z",
			},
		});
		const res = await makeService().updateStatus(
			"owner",
			"o1",
			"Cancelled",
			null,
		);
		expect(res).toMatchObject({
			id: "o1",
			status: "Cancelled",
			updatedAt: "2026-06-13T00:00:00.000Z",
		});
	});
});

describe("OrdersService.listByBranch", () => {
	it("returns the branch's orders after asserting branch access", async () => {
		authz.assertBranchAccess.mockResolvedValue({ id: "b1" });
		repo.findByBranch.mockResolvedValue([{ id: "o1" }]);
		const res = await makeService().listByBranch("owner", "b1", null);
		expect(authz.assertBranchAccess).toHaveBeenCalledWith("owner", "b1", null);
		expect(res).toEqual([{ id: "o1" }]);
	});

	it("propagates a ForbiddenError when the actor does not own the branch (cross-business)", async () => {
		authz.assertBranchAccess.mockRejectedValue(new ForbiddenError("nope"));
		await expect(
			makeService().listByBranch("owner-A", "branch-of-B", null),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(repo.findByBranch).not.toHaveBeenCalled();
	});
});

describe("OrdersService.cancel", () => {
	it("restores stock and cancels a Pending order", async () => {
		authz.assertCustomerOwnsOrder.mockResolvedValue({
			id: "o1",
			status: "Pending",
		});
		repo.findItems.mockResolvedValue([{ productId: "p1", quantity: 2 }]);
		repo.cancelAndRestore.mockResolvedValue(true);
		await makeService().cancel("u1", "o1");
		expect(repo.cancelAndRestore).toHaveBeenCalledOnce();
	});

	it("rejects cancelling a Delivered order (422)", async () => {
		authz.assertCustomerOwnsOrder.mockResolvedValue({
			id: "o1",
			status: "Delivered",
		});
		await expect(makeService().cancel("u1", "o1")).rejects.toBeInstanceOf(
			ValidationError,
		);
	});
});
