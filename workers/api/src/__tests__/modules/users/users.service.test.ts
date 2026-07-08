import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ConflictError,
	NotFoundError,
	ValidationError,
} from "../../../core/errors";
import { UsersService } from "../../../modules/users/users.service";

const mockRepo = {
	findAll: vi.fn(),
	findOne: vi.fn(),
	create: vi.fn(),
	updateOne: vi.fn(),
	deleteOne: vi.fn(),
};

const mockStorage = {
	upload: vi.fn(),
	delete: vi.fn(),
	url: vi.fn(),
};

const mockAuthService = {
	verifyAccountAction: vi.fn().mockResolvedValue(undefined),
};

function makeService() {
	return new UsersService(
		mockRepo as never,
		mockStorage as never,
		mockAuthService as never,
	);
}

const fakeUser = {
	id: "user-1",
	email: "user@example.com",
	name: "Test User",
	role: "customer",
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: null,
};

beforeEach(() => {
	vi.clearAllMocks();
	mockAuthService.verifyAccountAction.mockResolvedValue(undefined);
});

describe("UsersService.list", () => {
	it("delegates to repository findAll", async () => {
		const expected = {
			data: [fakeUser],
			query: { total: 1, page: 1, limit: 10 },
		};
		mockRepo.findAll.mockResolvedValue(expected);
		const svc = makeService();
		const result = await svc.list({ page: 1, limit: 10 });
		expect(result).toEqual(expected);
		expect(mockRepo.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
	});
});

describe("UsersService.get", () => {
	it("returns user when found", async () => {
		mockRepo.findOne.mockResolvedValue({ data: fakeUser });
		const svc = makeService();
		const result = await svc.get("user-1");
		expect(result).toEqual(fakeUser);
	});

	it("throws NotFoundError when not found", async () => {
		mockRepo.findOne.mockResolvedValue({ data: null });
		const svc = makeService();
		await expect(svc.get("missing")).rejects.toThrow(NotFoundError);
	});
});

describe("UsersService.create", () => {
	it("creates and returns new user", async () => {
		mockRepo.create.mockResolvedValue({ data: fakeUser });
		const svc = makeService();
		const result = await svc.create({
			name: "Test User",
			email: "user@example.com",
			role: "customer",
		} as never);
		expect(result).toEqual(fakeUser);
	});
});

describe("UsersService.update", () => {
	it("updates and returns user", async () => {
		const updated = { ...fakeUser, name: "Updated" };
		mockRepo.updateOne.mockResolvedValue({ data: updated });
		const svc = makeService();
		const result = await svc.update("user-1", { name: "Updated" });
		expect(result.name).toBe("Updated");
	});

	it("throws NotFoundError when not found", async () => {
		mockRepo.updateOne.mockResolvedValue({ data: null });
		const svc = makeService();
		await expect(svc.update("missing", { name: "X" })).rejects.toThrow(
			NotFoundError,
		);
	});
});

describe("UsersService.delete", () => {
	const proof = { password: "secret123" };

	it("deletes and returns user", async () => {
		mockRepo.deleteOne.mockResolvedValue({ data: fakeUser });
		const svc = makeService();
		const result = await svc.delete("user-1", proof);
		expect(result).toEqual(fakeUser);
		expect(mockAuthService.verifyAccountAction).toHaveBeenCalledWith(
			"user-1",
			proof,
		);
	});

	it("throws NotFoundError when not found", async () => {
		mockAuthService.verifyAccountAction.mockResolvedValue(undefined);
		mockRepo.deleteOne.mockResolvedValue({ data: null });
		const svc = makeService();
		await expect(svc.delete("missing", proof)).rejects.toThrow(NotFoundError);
	});
});

describe("UsersService.update — unique conflicts", () => {
	it("maps a duplicate email constraint to ConflictError", async () => {
		mockRepo.updateOne.mockRejectedValue(
			new Error(
				"D1_ERROR: UNIQUE constraint failed: users.email: SQLITE_CONSTRAINT_UNIQUE",
			),
		);
		const svc = makeService();
		await expect(
			svc.update("user-1", { email: "taken@example.com" }),
		).rejects.toThrow(ConflictError);
	});

	it("maps a duplicate phone constraint to ConflictError with a phone message", async () => {
		mockRepo.updateOne.mockRejectedValue(
			new Error(
				"D1_ERROR: UNIQUE constraint failed: users.phone: SQLITE_CONSTRAINT_UNIQUE",
			),
		);
		const svc = makeService();
		await expect(
			svc.update("user-1", { phone: "01700000000" }),
		).rejects.toThrow(/phone number is already in use/i);
	});

	it("rethrows non-constraint errors unchanged", async () => {
		const boom = new Error("some other failure");
		mockRepo.updateOne.mockRejectedValue(boom);
		const svc = makeService();
		await expect(svc.update("user-1", { name: "X" })).rejects.toThrow(
			"some other failure",
		);
	});
});

function fakeFile(type: string, sizeBytes = 1000, name = "avatar.png"): File {
	return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("UsersService.uploadPhoto", () => {
	it("rejects a non-image content type", async () => {
		const svc = makeService();
		await expect(
			svc.uploadPhoto("u1", fakeFile("application/pdf")),
		).rejects.toThrow(ValidationError);
		expect(mockStorage.upload).not.toHaveBeenCalled();
	});

	it("rejects a file larger than 5MB", async () => {
		const svc = makeService();
		await expect(
			svc.uploadPhoto("u1", fakeFile("image/png", 6 * 1024 * 1024)),
		).rejects.toThrow(ValidationError);
	});

	it("uploads, sets photoUrl, and deletes the previous object", async () => {
		mockRepo.findOne.mockResolvedValue({
			data: { id: "u1", photoUrl: "https://storage.test/users/u1/old.png" },
		});
		mockStorage.upload.mockResolvedValue(
			"https://storage.test/users/u1/new.png",
		);
		mockRepo.updateOne.mockResolvedValue({
			data: { id: "u1", photoUrl: "https://storage.test/users/u1/new.png" },
		});
		const svc = makeService();

		const result = await svc.uploadPhoto("u1", fakeFile("image/png"));

		expect(result).toEqual({ url: "https://storage.test/users/u1/new.png" });
		expect(mockStorage.upload).toHaveBeenCalledTimes(1);
		expect(mockRepo.updateOne).toHaveBeenCalledWith(
			"u1",
			{ photoUrl: "https://storage.test/users/u1/new.png" },
			{},
		);
		expect(mockStorage.delete).toHaveBeenCalledWith("users/u1/old.png");
	});

	it("derives the old key from a scheme-less stored URL (production format)", async () => {
		// PUBLIC_R2_URL is stored scheme-less (e.g. "storage.talash.bd"), so the
		// previous photoUrl has no scheme — the delete must still find the key.
		mockRepo.findOne.mockResolvedValue({
			data: { id: "u1", photoUrl: "storage.talash.bd/users/u1/old.png" },
		});
		mockStorage.upload.mockResolvedValue("storage.talash.bd/users/u1/new.png");
		mockRepo.updateOne.mockResolvedValue({
			data: { id: "u1", photoUrl: "storage.talash.bd/users/u1/new.png" },
		});
		const svc = makeService();

		await svc.uploadPhoto("u1", fakeFile("image/png"));

		expect(mockStorage.delete).toHaveBeenCalledWith("users/u1/old.png");
	});

	it("keys the object by the validated MIME type, not the uploaded filename", async () => {
		// A JPEG uploaded with a misleading, extensionless filename must still be
		// stored as `.jpg` — the extension comes from the content type, never the name.
		mockRepo.findOne.mockResolvedValue({ data: { id: "u1", photoUrl: null } });
		mockStorage.upload.mockResolvedValue("https://storage.test/key.jpg");
		mockRepo.updateOne.mockResolvedValue({ data: { id: "u1" } });
		const svc = makeService();

		await svc.uploadPhoto("u1", fakeFile("image/jpeg", 1000, "selfie"));

		const storedKey = mockStorage.upload.mock.calls[0][0] as string;
		expect(storedKey).toMatch(/^users\/u1\/[\w-]+\.jpg$/);
	});

	it("does not delete when there was no previous photo", async () => {
		mockRepo.findOne.mockResolvedValue({ data: { id: "u1", photoUrl: null } });
		mockStorage.upload.mockResolvedValue(
			"https://storage.test/users/u1/new.png",
		);
		mockRepo.updateOne.mockResolvedValue({
			data: { id: "u1", photoUrl: "https://storage.test/users/u1/new.png" },
		});
		const svc = makeService();
		await svc.uploadPhoto("u1", fakeFile("image/png"));
		expect(mockStorage.delete).not.toHaveBeenCalled();
	});
});
