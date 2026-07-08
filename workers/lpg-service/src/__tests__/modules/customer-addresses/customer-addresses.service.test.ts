import { beforeEach, expect, it, vi } from "vitest";
import { CustomerAddressesService } from "../../../modules/customer-addresses/customer-addresses.service";

const repo = {
	findByUser: vi.fn(),
	findOne: vi.fn(),
	create: vi.fn(),
	updateOne: vi.fn(),
	deleteOne: vi.fn(),
	clearDefault: vi.fn(),
};
const authz = { assertCustomerOwnsAddress: vi.fn() };
const make = () => new CustomerAddressesService(repo as never, authz as never);
beforeEach(() => vi.clearAllMocks());

it("create with isDefault=true clears previous defaults first", async () => {
	repo.create.mockResolvedValue({ data: { id: "a1" } });
	await make().create("u1", { line: "x", isDefault: true });
	expect(repo.clearDefault).toHaveBeenCalledWith("u1");
});

it("create without isDefault does not clear defaults", async () => {
	repo.create.mockResolvedValue({ data: { id: "a1" } });
	await make().create("u1", { line: "x" });
	expect(repo.clearDefault).not.toHaveBeenCalled();
});

it("update asserts ownership", async () => {
	authz.assertCustomerOwnsAddress.mockResolvedValue({ id: "a1", userId: "u1" });
	repo.updateOne.mockResolvedValue({ data: { id: "a1" } });
	await make().update("u1", "a1", { label: "Home" });
	expect(authz.assertCustomerOwnsAddress).toHaveBeenCalledWith("u1", "a1");
});

it("update with isDefault=true clears previous defaults", async () => {
	authz.assertCustomerOwnsAddress.mockResolvedValue({ id: "a1", userId: "u1" });
	repo.updateOne.mockResolvedValue({ data: { id: "a1" } });
	await make().update("u1", "a1", { isDefault: true });
	expect(repo.clearDefault).toHaveBeenCalledWith("u1");
});

it("remove asserts ownership", async () => {
	authz.assertCustomerOwnsAddress.mockResolvedValue({ id: "a1", userId: "u1" });
	repo.deleteOne.mockResolvedValue({ data: { id: "a1" } });
	await make().remove("u1", "a1");
	expect(authz.assertCustomerOwnsAddress).toHaveBeenCalledWith("u1", "a1");
});
