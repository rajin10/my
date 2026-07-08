import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../../core/errors";
import { FavouritesService } from "../../../modules/favourites/favourites.service";

const fakeFav = {
	id: "fav-1",
	userId: "user-1",
	businessId: "business-1",
	createdAt: "2026-01-01T00:00:00.000Z",
};

const mockRepo = {
	findByUser: vi.fn(),
	findOne: vi.fn(),
	add: vi.fn(),
	remove: vi.fn(),
};

describe("FavouritesService.add", () => {
	it("throws ConflictError when already favourited", async () => {
		mockRepo.findOne.mockResolvedValue(fakeFav);
		const svc = new FavouritesService(mockRepo as never);
		await expect(svc.add("user-1", "business-1")).rejects.toThrow(
			ConflictError,
		);
	});
});

describe("FavouritesService.remove", () => {
	it("throws NotFoundError when not in favourites", async () => {
		mockRepo.findOne.mockResolvedValue(null);
		const svc = new FavouritesService(mockRepo as never);
		await expect(svc.remove("user-1", "business-1")).rejects.toThrow(
			NotFoundError,
		);
	});
});
