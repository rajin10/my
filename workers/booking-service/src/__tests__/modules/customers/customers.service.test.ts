import { describe, expect, it, vi } from "vitest";
import { CustomersService } from "../../../modules/customers/customers.service";

const mockRepo = {
	listByBusiness: vi.fn().mockResolvedValue([]),
	getCustomerVisits: vi.fn().mockResolvedValue([]),
};
const mockAuthz = {
	assertBusinessOwner: vi.fn().mockResolvedValue({ id: "b1" }),
};

describe("CustomersService.list", () => {
	it("asserts business ownership then calls repo", async () => {
		const svc = new CustomersService(mockRepo as never, mockAuthz as never);
		await svc.list("owner-1", "b1");
		expect(mockAuthz.assertBusinessOwner).toHaveBeenCalledWith("owner-1", "b1");
		expect(mockRepo.listByBusiness).toHaveBeenCalledWith("b1");
	});
});

describe("CustomersService.visits", () => {
	it("asserts business ownership then calls repo", async () => {
		const svc = new CustomersService(mockRepo as never, mockAuthz as never);
		await svc.visits("owner-1", "b1", "user-1");
		expect(mockAuthz.assertBusinessOwner).toHaveBeenCalledWith("owner-1", "b1");
		expect(mockRepo.getCustomerVisits).toHaveBeenCalledWith("b1", "user-1");
	});
});
