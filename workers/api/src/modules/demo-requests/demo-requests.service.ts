import type { DemoRequestsRepository } from "@repo/core/src/database/repositories/demo-requests.repository";
import type { DemoRequestInsert } from "@repo/core/src/database/schema";

export class DemoRequestsService {
	constructor(private readonly repo: DemoRequestsRepository) {}

	create(body: DemoRequestInsert) {
		return this.repo.create(body);
	}
}
