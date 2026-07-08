import type { DbClient } from "../client";
import type { DemoRequestInsert, DemoRequestSelect } from "../schema";
import { demoRequestsSchema } from "../schema";

export class DemoRequestsRepository {
	constructor(private readonly db: DbClient) {}

	async create(data: DemoRequestInsert): Promise<DemoRequestSelect> {
		const rows = await this.db
			.insert(demoRequestsSchema)
			.values(data)
			.returning();
		return rows[0];
	}
}
