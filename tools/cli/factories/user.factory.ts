import {
	type UserInsert,
	UserRole,
	type UserSelect,
} from "@core/database/schema/users.schema";
import { faker } from "@faker-js/faker";

export function createUser(overrides: Partial<UserInsert> = {}): UserSelect {
	return {
		id: crypto.randomUUID(),
		email: faker.internet.email(),
		phone: faker.datatype.boolean(0.3) ? faker.phone.number() : null,
		name: faker.person.fullName(),
		role: UserRole.USER,
		googleId: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
