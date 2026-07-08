import type { UsersRepository } from "@repo/core/src/database/repositories/users.repository";
import type { UserInsert } from "@repo/core/src/database/schema";
import type { PaginatedQueryDto } from "@repo/core/src/http/response";
import { ConflictError, NotFoundError } from "../../core/errors";
import { validateImageUpload } from "../../core/storage/image-upload";
import type { R2Storage } from "../../core/storage/r2";
import type { AccountActionProof, AuthService } from "../auth/auth.service";

export class UsersService {
	constructor(
		private readonly repo: UsersRepository,
		private readonly storage: R2Storage,
		private readonly authService: AuthService,
	) {}

	list(query: PaginatedQueryDto) {
		return this.repo.findAll(query);
	}

	async get(id: string) {
		const result = await this.repo.findOne(id, {});
		if (!result.data) throw new NotFoundError("User not found");
		return result.data;
	}

	async create(data: UserInsert) {
		const result = await this.repo.create(data);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(id: string, data: Partial<UserInsert>) {
		let result: Awaited<ReturnType<UsersRepository["updateOne"]>>;
		try {
			result = await this.repo.updateOne(id, data, {});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (/UNIQUE constraint failed:[^:]*users\.email/i.test(message))
				throw new ConflictError("This email is already in use");
			if (/UNIQUE constraint failed:[^:]*users\.phone/i.test(message))
				throw new ConflictError("This phone number is already in use");
			throw err;
		}
		if (!result.data) throw new NotFoundError("User not found");
		return result.data;
	}

	async delete(id: string, proof: AccountActionProof) {
		await this.authService.verifyAccountAction(id, proof);
		const result = await this.repo.deleteOne(id, {});
		if (!result.data) throw new NotFoundError("User not found");
		return result.data;
	}

	async restore(id: string) {
		const result = await this.repo.restoreOne(id);
		if (!result.data) throw new NotFoundError("User not found or not deleted");
		return result.data;
	}

	async uploadPhoto(userId: string, file: File): Promise<{ url: string }> {
		const { ext } = validateImageUpload(file);

		const current = await this.repo.findOne(userId, {});
		if (!current.data) throw new NotFoundError("User not found");
		const oldUrl =
			(current.data as { photoUrl?: string | null }).photoUrl ?? null;

		const key = `users/${userId}/${crypto.randomUUID()}.${ext}`;
		const url = await this.storage.upload(
			key,
			await file.arrayBuffer(),
			file.type,
		);

		await this.repo.updateOne(
			userId,
			{ photoUrl: url } as Partial<UserInsert>,
			{},
		);

		if (oldUrl) {
			const oldKey = oldUrl
				.replace(/^https?:\/\//, "")
				.split("/")
				.slice(1)
				.join("/");
			try {
				if (oldKey) await this.storage.delete(oldKey);
			} catch {
				/* best-effort */
			}
		}
		return { url };
	}
}
