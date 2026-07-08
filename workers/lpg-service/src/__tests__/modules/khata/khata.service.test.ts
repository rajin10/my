import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../../../core/errors";
import { KhataService } from "../../../modules/khata/khata.service";

const khataRepo = {
	customerDue: vi.fn(),
	businessDues: vi.fn(),
	deliveredOrders: vi.fn(),
	customerName: vi.fn(),
};
const paymentsRepo = { findByBusinessCustomer: vi.fn() };
const authz = { assertBusinessOwner: vi.fn() };

function makeService() {
	return new KhataService(
		khataRepo as never,
		paymentsRepo as never,
		authz as never,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("KhataService.dues", () => {
	it("returns the dues list for the owner", async () => {
		authz.assertBusinessOwner.mockResolvedValue({
			id: "biz1",
			ownerId: "owner-1",
		});
		khataRepo.businessDues.mockResolvedValue([
			{ userId: "u1", name: "Karim", due: 1200 },
		]);
		const res = await makeService().dues("owner-1", "biz1");
		expect(res).toEqual([{ userId: "u1", name: "Karim", due: 1200 }]);
		expect(authz.assertBusinessOwner).toHaveBeenCalledWith("owner-1", "biz1");
	});

	it("rejects a non-owner", async () => {
		authz.assertBusinessOwner.mockRejectedValue(new ForbiddenError("no"));
		await expect(makeService().dues("owner-1", "biz1")).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(khataRepo.businessDues).not.toHaveBeenCalled();
	});
});

describe("KhataService.customerLedger", () => {
	it("composes due + delivered orders + payments + name", async () => {
		authz.assertBusinessOwner.mockResolvedValue({
			id: "biz1",
			ownerId: "owner-1",
		});
		khataRepo.customerDue.mockResolvedValue({
			due: 700,
			totalDelivered: 1200,
			totalPaid: 500,
		});
		khataRepo.deliveredOrders.mockResolvedValue([
			{ id: "o1", total: 1200, deliveredAt: "2026-06-01" },
		]);
		khataRepo.customerName.mockResolvedValue("Karim");
		paymentsRepo.findByBusinessCustomer.mockResolvedValue([
			{
				id: "p1",
				amount: 500,
				note: null,
				createdAt: "2026-06-02",
				recordedBy: "owner-1",
			},
		]);

		const res = await makeService().customerLedger("owner-1", "biz1", "u1");
		expect(res).toEqual({
			userId: "u1",
			name: "Karim",
			due: 700,
			totalDelivered: 1200,
			totalPaid: 500,
			deliveredOrders: [{ id: "o1", total: 1200, deliveredAt: "2026-06-01" }],
			payments: [
				{
					id: "p1",
					amount: 500,
					note: null,
					createdAt: "2026-06-02",
					recordedBy: "owner-1",
				},
			],
		});
	});

	it("rejects a non-owner before any read", async () => {
		authz.assertBusinessOwner.mockRejectedValue(new ForbiddenError("no"));
		await expect(
			makeService().customerLedger("owner-1", "biz1", "u1"),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(khataRepo.customerDue).not.toHaveBeenCalled();
		expect(khataRepo.deliveredOrders).not.toHaveBeenCalled();
		expect(paymentsRepo.findByBusinessCustomer).not.toHaveBeenCalled();
	});

	it("falls back to 'Unknown' when the customer name is null", async () => {
		authz.assertBusinessOwner.mockResolvedValue({
			id: "biz1",
			ownerId: "owner-1",
		});
		khataRepo.customerDue.mockResolvedValue({
			due: 0,
			totalDelivered: 0,
			totalPaid: 0,
		});
		khataRepo.deliveredOrders.mockResolvedValue([]);
		khataRepo.customerName.mockResolvedValue(null);
		paymentsRepo.findByBusinessCustomer.mockResolvedValue([]);
		const res = await makeService().customerLedger("owner-1", "biz1", "u1");
		expect(res.name).toBe("Unknown");
	});
});
