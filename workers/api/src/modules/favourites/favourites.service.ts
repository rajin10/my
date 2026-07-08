import type { FavouritesRepository } from "@repo/core/src/database/repositories/favourites.repository";
import { ConflictError, NotFoundError } from "../../core/errors";

export class FavouritesService {
	constructor(private readonly repo: FavouritesRepository) {}

	list(userId: string) {
		return this.repo.findByUser(userId);
	}

	async check(userId: string, businessId: string) {
		const fav = await this.repo.findOne(userId, businessId);
		return { isFavourited: !!fav };
	}

	async add(userId: string, businessId: string) {
		const existing = await this.repo.findOne(userId, businessId);
		if (existing) throw new ConflictError("Already favourited");
		return this.repo.add({ userId, businessId });
	}

	async remove(userId: string, businessId: string) {
		const existing = await this.repo.findOne(userId, businessId);
		if (!existing) throw new NotFoundError("Not in favourites");
		await this.repo.remove(userId, businessId);
	}
}
