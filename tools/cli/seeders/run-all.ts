import type { DbClient } from "../core/db.ts";
import { log } from "../core/logger.ts";
import { seedBookings } from "./bookings.seeder.ts";
import { seedBranches } from "./branches.seeder.ts";
import { seedBusinesses } from "./businesses.seeder.ts";
import { seedCoupons } from "./coupons.seeder.ts";
import { seedCustomerAddresses } from "./customer-addresses.seeder.ts";
import { seedOrders } from "./orders.seeder.ts";
import { seedPayments } from "./payments.seeder.ts";
import { seedProducts } from "./products.seeder.ts";
import { seedReviews } from "./reviews.seeder.ts";
import { seedRewards } from "./rewards.seeder.ts";
import type { SeedOptions } from "./seeder.types.ts";
import { seedServices } from "./services.seeder.ts";
import { TRUNCATE_ORDER } from "./tables.ts";
import { seedTeam } from "./team.seeder.ts";
import { seedUsers } from "./users.seeder.ts";

/** Truncate all domain tables in FK-safe order (local bun:sqlite). */
export function truncateAll(db: DbClient): void {
	const sqlite = db.$client;
	sqlite.exec("PRAGMA foreign_keys = OFF");
	for (const table of TRUNCATE_ORDER) {
		try {
			sqlite.exec(`DELETE FROM "${table}"`);
			log.step(`cleared ${table}`);
		} catch {
			log.dim(`  skipped ${table} (table may not exist)`);
		}
	}
	sqlite.exec("PRAGMA foreign_keys = ON");
}

/** Populate a db client with a full faker dataset. Returns total rows inserted. */
export async function seedAll(
	db: DbClient,
	opts: SeedOptions,
): Promise<number> {
	const results: Array<{ inserted: number }> = [];

	log.info(`Seeding ${opts.count} users worth of data…`);

	const users = await seedUsers(db, opts);
	results.push(users);
	log.step(
		`users: ${users.inserted} (${users.ownerIds.length} owners, ${users.staffIds.length} staff, ${users.userIds.length} customers)`,
	);

	const businesses = await seedBusinesses(db, users.ownerIds);
	results.push(businesses);
	log.step(`businesses + photos: ${businesses.inserted}`);

	const branches = await seedBranches(
		db,
		businesses.businessIds,
		businesses.businessCities,
	);
	results.push(branches);
	log.step(`branches: ${branches.inserted}`);

	const services = await seedServices(db, branches.businessBranches);
	results.push(services);
	log.step(`services: ${services.inserted}`);

	const products = await seedProducts(
		db,
		businesses.commerceBusinessIds,
		branches.businessBranches,
	);
	results.push(products);
	log.step(`products: ${products.inserted}`);

	const team = await seedTeam(
		db,
		businesses.businessIds,
		branches.businessBranches,
		users.ownerIds,
		users.staffIds,
	);
	results.push(team);
	log.step(`team members: ${team.inserted}`);

	const bookings = await seedBookings(
		db,
		users.userIds,
		businesses.businessIds,
		branches.businessBranches,
		services.branchServices,
		services.servicePrices,
	);
	results.push(bookings);
	log.step(`bookings: ${bookings.inserted}`);

	const orders = await seedOrders(
		db,
		businesses.commerceBusinessIds,
		branches.businessBranches,
		products.branchProducts,
		products.productPrices,
		products.productStock,
		users.userIds,
	);
	results.push(orders);
	log.step(`orders: ${orders.orderCount} (+ ${orders.itemCount} order items)`);

	const payments = await seedPayments(
		db,
		orders.deliveredTotals,
		businesses.businessOwnerIds,
	);
	results.push(payments);
	log.step(`payments: ${payments.paymentCount}`);

	const customerAddresses = await seedCustomerAddresses(db, users.userIds);
	results.push(customerAddresses);
	log.step(`customer addresses: ${customerAddresses.inserted}`);

	const coupons = await seedCoupons(db, businesses.businessIds);
	results.push(coupons);
	log.step(`coupons: ${coupons.inserted}`);

	const reviews = await seedReviews(db, bookings.bookingRefs);
	results.push(reviews);
	log.step(`reviews: ${reviews.inserted}`);

	const allUserIds = [...users.userIds, ...users.ownerIds, ...users.staffIds];
	const rewards = await seedRewards(db, allUserIds, bookings.bookingRefs);
	results.push(rewards);
	log.step(`rewards (txns + balances): ${rewards.inserted}`);

	return results.reduce((sum, r) => sum + r.inserted, 0);
}
