import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../../../core/errors";
import { BusinessesService } from "../../../modules/businesses/businesses.service";

const mockRepo = {
	findAll: vi.fn(),
	findOne: vi.fn(),
	create: vi.fn(),
	updateOne: vi.fn(),
	deleteOne: vi.fn(),
	addPhoto: vi.fn(),
	listPhotos: vi.fn(),
	findPhoto: vi.fn(),
	deletePhoto: vi.fn(),
	reorderPhotos: vi.fn(),
	restoreOne: vi.fn(),
};

const mockAuthz = {
	assertBusinessOwner: vi.fn(),
};

const mockStorage = { upload: vi.fn() };

function makeService() {
	return new BusinessesService(
		mockRepo as never,
		mockStorage as never,
		undefined,
		mockAuthz as never,
	);
}

const fakeBusiness = {
	id: "business-1",
	name: "Test Business",
	ownerId: "owner-1",
	category: "Beauty",
	city: "Dhaka",
	vertical: "booking" as const,
	status: "Active" as const,
	description: null,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: null,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("BusinessesService.list", () => {
	it("delegates to repository findAll", async () => {
		const expected = { data: [fakeBusiness] };
		mockRepo.findAll.mockResolvedValue(expected);
		const svc = makeService();
		const result = await svc.list({ page: 1, limit: 10 });
		expect(result).toEqual(expected);
	});
});

describe("BusinessesService.get", () => {
	it("returns business when found", async () => {
		mockRepo.findOne.mockResolvedValue({ data: fakeBusiness });
		const svc = makeService();
		const result = await svc.get("business-1");
		expect(result).toEqual(fakeBusiness);
	});

	it("throws NotFoundError when not found", async () => {
		mockRepo.findOne.mockResolvedValue({ data: null });
		const svc = makeService();
		await expect(svc.get("missing")).rejects.toThrow(NotFoundError);
	});
});

describe("BusinessesService.create", () => {
	it("creates business with ownerId", async () => {
		mockRepo.create.mockResolvedValue({ data: fakeBusiness });
		const svc = makeService();
		const result = await svc.create("owner-1", {
			name: "Test Business",
			category: "Beauty",
			city: "Dhaka",
			vertical: "booking",
			status: "Active",
		} as never);
		expect(result).toEqual(fakeBusiness);
		expect(mockRepo.create).toHaveBeenCalledWith(
			expect.objectContaining({ ownerId: "owner-1", vertical: "booking" }),
		);
	});
});

describe("BusinessesService.update — delegates to authz guard", () => {
	it("calls assertBusinessOwner and updates when guard passes", async () => {
		mockAuthz.assertBusinessOwner.mockResolvedValue(fakeBusiness);
		mockRepo.updateOne.mockResolvedValue({
			data: { ...fakeBusiness, name: "Updated" },
		});
		const svc = makeService();
		const result = await svc.update("owner-1", "business-1", {
			name: "Updated",
		});
		expect(mockAuthz.assertBusinessOwner).toHaveBeenCalledWith(
			"owner-1",
			"business-1",
		);
		expect(result.name).toBe("Updated");
	});

	it("forwards a brand palette to the repository once the owner guard passes", async () => {
		const palette = {
			primary: "#5B2A86",
			accent: "#C9A063",
			foreground: "#1A1320",
			surface: "#FDFBFF",
		};
		mockAuthz.assertBusinessOwner.mockResolvedValue(fakeBusiness);
		mockRepo.updateOne.mockResolvedValue({
			data: { ...fakeBusiness, brandPalette: palette },
		});
		const svc = makeService();
		const result = await svc.update("owner-1", "business-1", {
			brandPalette: palette,
		} as never);
		expect(mockRepo.updateOne).toHaveBeenCalledWith(
			"business-1",
			expect.objectContaining({ brandPalette: palette }),
		);
		expect((result as { brandPalette: unknown }).brandPalette).toEqual(palette);
	});

	it("rejects a palette that fails WCAG AA contrast and does not write (#59)", async () => {
		mockAuthz.assertBusinessOwner.mockResolvedValue(fakeBusiness);
		const svc = makeService();
		await expect(
			svc.update("owner-1", "business-1", {
				brandPalette: {
					primary: "#0e7c66",
					accent: "#c9a063",
					foreground: "#f3f3f3", // light grey body text on white surface
					surface: "#ffffff",
				},
			} as never),
		).rejects.toThrow(/WCAG AA contrast/);
		expect(mockRepo.updateOne).not.toHaveBeenCalled();
	});

	it("allows clearing the palette with null (no contrast check)", async () => {
		mockAuthz.assertBusinessOwner.mockResolvedValue(fakeBusiness);
		mockRepo.updateOne.mockResolvedValue({
			data: { ...fakeBusiness, brandPalette: null },
		});
		const svc = makeService();
		await svc.update("owner-1", "business-1", { brandPalette: null } as never);
		expect(mockRepo.updateOne).toHaveBeenCalledWith(
			"business-1",
			expect.objectContaining({ brandPalette: null }),
		);
	});

	it("propagates ForbiddenError from guard", async () => {
		mockAuthz.assertBusinessOwner.mockRejectedValue(
			new ForbiddenError("You do not own this business"),
		);
		const svc = makeService();
		await expect(
			svc.update("owner-2", "business-1", { name: "X" }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("rejects an attempt to change the immutable vertical", async () => {
		const svc = makeService();
		await expect(
			// vertical is immutable; the guard must fire before any repo/authz work
			svc.update("owner-1", "business-1", { vertical: "commerce" } as never),
		).rejects.toThrow("vertical cannot be changed");
		expect(mockAuthz.assertBusinessOwner).not.toHaveBeenCalled();
		expect(mockRepo.updateOne).not.toHaveBeenCalled();
	});

	it("propagates NotFoundError from guard", async () => {
		mockAuthz.assertBusinessOwner.mockRejectedValue(
			new NotFoundError("Business not found"),
		);
		const svc = makeService();
		await expect(
			svc.update("owner-1", "missing", { name: "X" }),
		).rejects.toBeInstanceOf(NotFoundError);
	});

	it("validates status transition using business returned by guard", async () => {
		mockAuthz.assertBusinessOwner.mockResolvedValue({
			...fakeBusiness,
			status: "Suspended",
		});
		const svc = makeService();
		// Suspended → Draft is invalid
		await expect(
			svc.update("owner-1", "business-1", { status: "Draft" }),
		).rejects.toThrow("Cannot transition");
	});
});

describe("BusinessesService.delete — delegates to authz guard", () => {
	it("calls assertBusinessOwner and deletes", async () => {
		mockAuthz.assertBusinessOwner.mockResolvedValue(fakeBusiness);
		mockRepo.deleteOne.mockResolvedValue({ data: fakeBusiness });
		const svc = makeService();
		const result = await svc.delete("owner-1", "business-1");
		expect(mockAuthz.assertBusinessOwner).toHaveBeenCalledWith(
			"owner-1",
			"business-1",
		);
		expect(result).toEqual(fakeBusiness);
	});

	it("propagates ForbiddenError from guard", async () => {
		mockAuthz.assertBusinessOwner.mockRejectedValue(new ForbiddenError());
		const svc = makeService();
		await expect(svc.delete("owner-2", "business-1")).rejects.toBeInstanceOf(
			ForbiddenError,
		);
	});
});

describe("BusinessesService.restore — raw ownership check (soft-delete path)", () => {
	it("restores when owner matches soft-deleted record", async () => {
		mockRepo.findOne.mockResolvedValue({
			data: { ...fakeBusiness, deletedAt: "2026-03-01T00:00:00Z" },
		});
		mockRepo.restoreOne.mockResolvedValue({ data: fakeBusiness });
		const svc = makeService();
		const result = await svc.restore("owner-1", "business-1");
		expect(result).toEqual(fakeBusiness);
		expect(mockRepo.findOne).toHaveBeenCalledWith("business-1", {
			withDeleted: true,
		});
	});

	it("throws NotFoundError when soft-deleted record missing", async () => {
		mockRepo.findOne.mockResolvedValue({ data: null });
		const svc = makeService();
		await expect(svc.restore("owner-1", "missing")).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});

	it("throws ForbiddenError when owner does not match soft-deleted record", async () => {
		mockRepo.findOne.mockResolvedValue({
			data: {
				...fakeBusiness,
				ownerId: "other-owner",
				deletedAt: "2026-03-01T00:00:00Z",
			},
		});
		const svc = makeService();
		await expect(svc.restore("owner-1", "business-1")).rejects.toBeInstanceOf(
			ForbiddenError,
		);
	});
});

function fakeFile(type: string, sizeBytes = 1000, name = "photo.png"): File {
	return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("BusinessesService.uploadPhoto — validates content type + size", () => {
	it("rejects a non-image content type after the ownership check", async () => {
		mockAuthz.assertBusinessOwner.mockResolvedValue(fakeBusiness);
		const svc = makeService();
		await expect(
			svc.uploadPhoto("owner-1", "business-1", fakeFile("application/pdf")),
		).rejects.toBeInstanceOf(ValidationError);
		expect(mockStorage.upload).not.toHaveBeenCalled();
		expect(mockRepo.addPhoto).not.toHaveBeenCalled();
	});

	it("rejects an SVG payload disguised by filename", async () => {
		mockAuthz.assertBusinessOwner.mockResolvedValue(fakeBusiness);
		const svc = makeService();
		await expect(
			svc.uploadPhoto(
				"owner-1",
				"business-1",
				fakeFile("image/svg+xml", 1000, "logo.png"),
			),
		).rejects.toBeInstanceOf(ValidationError);
		expect(mockStorage.upload).not.toHaveBeenCalled();
	});

	it("rejects a file larger than 5MB", async () => {
		mockAuthz.assertBusinessOwner.mockResolvedValue(fakeBusiness);
		const svc = makeService();
		await expect(
			svc.uploadPhoto(
				"owner-1",
				"business-1",
				fakeFile("image/png", 6 * 1024 * 1024),
			),
		).rejects.toBeInstanceOf(ValidationError);
		expect(mockStorage.upload).not.toHaveBeenCalled();
	});

	it("keys the object by the validated MIME type, not the uploaded filename", async () => {
		mockAuthz.assertBusinessOwner.mockResolvedValue(fakeBusiness);
		mockStorage.upload.mockResolvedValue(
			"https://storage.test/businesses/business-1/x.jpg",
		);
		mockRepo.addPhoto.mockResolvedValue(undefined);
		const svc = makeService();

		const result = await svc.uploadPhoto(
			"owner-1",
			"business-1",
			fakeFile("image/jpeg", 1000, "no-extension"),
		);

		expect(result).toEqual({
			url: "https://storage.test/businesses/business-1/x.jpg",
		});
		const storedKey = mockStorage.upload.mock.calls[0][0] as string;
		expect(storedKey).toMatch(/^businesses\/business-1\/[\w-]+\.jpg$/);
		expect(mockRepo.addPhoto).toHaveBeenCalledTimes(1);
	});
});
