import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import type { ProductsRepository } from "@repo/core/src/database/repositories/products.repository";
import {
	type WalkInCustomer,
	validateWalkInCustomer,
} from "@repo/walk-in-sync/validation";
import type { WalkInSubmitPayload } from "@repo/walk-in-sync/protocol";
import type { AuthorizationService } from "../../core/authorization";
import { NotFoundError, ValidationError } from "../../core/errors";
import type { OrdersService } from "../orders/orders.service";
import { signBranchQr, verifyBranchQr } from "./qr-sign";

const SESSION_TTL_SECS = 900;
const MAX_SYNC_BATCH = 20;

type WalkInSession = {
	branchId: string;
	ownerId: string;
	expiresAt: number;
};

export class WalkInService {
	constructor(
		private readonly branchesRepo: BranchesRepository,
		private readonly businessesRepo: BusinessesRepository,
		private readonly productsRepo: ProductsRepository,
		private readonly ordersRepo: OrdersRepository,
		private readonly ordersService: OrdersService,
		private readonly authz: AuthorizationService,
		private readonly kv: KVNamespace | undefined,
		private readonly jwtSecret: string,
	) {}

	async getContext(branchId: string, session?: string, signature?: string) {
		const branch = await this.branchesRepo.findOne(branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");

		const business = await this.businessesRepo.findOne(branch.data.businessId);
		if (!business.data) throw new NotFoundError("Business not found");

		await this.assertWalkInAccess(branchId, session, signature, branch.data);

		const products = await this.productsRepo.findByBranch(branchId);
		return {
			branchId,
			businessId: business.data.id,
			businessName: business.data.name,
			vertical: "commerce" as const,
			brandPalette: business.data.brandPalette ?? null,
			fulfillment: "counter" as const,
			products: products.map((p) => ({
				id: p.id,
				name: p.name,
				price: p.price,
				stock: p.stock,
				photoUrl: p.imageUrl,
			})),
			snapshotAt: new Date().toISOString(),
		};
	}

	async submit(input: WalkInSubmitPayload, userId?: string) {
		if (input.vertical !== "commerce") {
			throw new ValidationError("This branch accepts commerce walk-ins only");
		}

		const resolvedUserId = userId ?? input.customer.userId ?? null;
		const customer: WalkInCustomer = resolvedUserId
			? { userId: resolvedUserId }
			: {
					guestName: input.customer.guestName,
					guestPhone: input.customer.guestPhone,
				};

		if (
			!resolvedUserId &&
			!input.customer.guestName &&
			!input.customer.guestPhone
		) {
			throw new ValidationError("Signed-in or guest details are required");
		}

		const customerError = validateWalkInCustomer(customer);
		if (customerError) throw new ValidationError(customerError);

		const existingOrder = await this.ordersRepo.findByWalkInLocalId(
			input.localId,
		);
		if (existingOrder) {
			return {
				localId: input.localId,
				serverId: existingOrder.id,
				status: "accepted" as const,
			};
		}

		if (!input.order?.items?.length) {
			throw new ValidationError("Order items are required");
		}

		const order = await this.ordersService.createCounterWalkIn({
			branchId: input.branchId,
			items: input.order.items.map((it) => ({
				productId: it.productId,
				quantity: it.qty,
			})),
			userId: resolvedUserId,
			guestName: customer.guestName ?? null,
			guestPhone: customer.guestPhone ?? null,
			walkInLocalId: input.localId,
		});
		return {
			localId: input.localId,
			serverId: order.id,
			status: "accepted" as const,
		};
	}

	async syncBatch(
		entries: WalkInSubmitPayload[],
		ownerId: string,
		scopedBranchIds: string[] | null,
	) {
		if (entries.length > MAX_SYNC_BATCH) {
			throw new ValidationError(
				`Sync batch cannot exceed ${MAX_SYNC_BATCH} entries`,
			);
		}

		const synced: Record<string, string> = {};
		for (const entry of entries) {
			if (entry.vertical !== "commerce") {
				throw new ValidationError(
					"Only commerce walk-in entries can be synced here",
				);
			}
			await this.authz.assertBranchAccess(
				ownerId,
				entry.branchId,
				scopedBranchIds,
			);
			const result = await this.submit(entry);
			synced[entry.localId] = result.serverId;
		}
		return { synced };
	}

	async regenerateBranchQr(
		ownerId: string,
		branchId: string,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertBranchAccess(ownerId, branchId, scopedBranchIds);

		const branch = await this.branchesRepo.findOne(branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");

		const business = await this.businessesRepo.findOne(branch.data.businessId);
		if (!business.data) throw new NotFoundError("Business not found");

		const version = (branch.data.walkInQrVersion ?? 0) + 1;
		await this.branchesRepo.updateOne(branchId, { walkInQrVersion: version });

		const payload = {
			branchId,
			businessId: business.data.id,
			vertical: "commerce" as const,
			version,
		};
		const signature = await signBranchQr(payload, this.jwtSecret);

		return {
			...payload,
			signature,
			universalUrl: `https://talash.app/w/${branchId}?sig=${signature}`,
			deepLink: `mobileapp://walk-in?branchId=${branchId}&signature=${signature}`,
		};
	}

	async createSession(
		ownerId: string,
		branchId: string,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertBranchAccess(ownerId, branchId, scopedBranchIds);
		if (!this.kv) {
			throw new ValidationError("Walk-in sessions are not available");
		}

		const branch = await this.branchesRepo.findOne(branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");

		const sessionToken = crypto.randomUUID();
		const expiresAt = Date.now() + SESSION_TTL_SECS * 1000;
		const session: WalkInSession = { branchId, ownerId, expiresAt };

		await this.kv.put(
			`walk-in:session:${sessionToken}`,
			JSON.stringify(session),
			{
				expirationTtl: SESSION_TTL_SECS,
			},
		);

		return {
			sessionToken,
			branchId,
			expiresAt,
			universalUrl: `https://talash.app/w/${branchId}?s=${sessionToken}`,
			deepLink: `mobileapp://walk-in?branchId=${branchId}&session=${sessionToken}`,
		};
	}

	async listReceipts(userId: string) {
		const orders = (await this.ordersRepo.findByUser(userId)).filter(
			(o) => o.source === "walk_in" && o.walkInLocalId,
		);
		return {
			orders: orders.map((o) => ({
				localId: o.walkInLocalId,
				serverId: o.id,
				status: o.status,
				total: o.total,
				createdAt: o.createdAt,
			})),
		};
	}

	private async assertWalkInAccess(
		branchId: string,
		session?: string,
		signature?: string,
		branch?: { businessId: string; walkInQrVersion: number },
	) {
		if (session) {
			const valid = await this.validateSession(session, branchId);
			if (valid) return;
		}

		if (signature && branch) {
			const business = await this.businessesRepo.findOne(branch.businessId);
			if (!business.data) throw new NotFoundError("Business not found");

			const payload = {
				branchId,
				businessId: business.data.id,
				vertical: "commerce" as const,
				version: branch.walkInQrVersion ?? 0,
			};
			const ok = await verifyBranchQr(payload, signature, this.jwtSecret);
			if (ok) return;
			throw new ValidationError("Invalid QR code signature");
		}

		throw new ValidationError("A valid session or QR signature is required");
	}

	private async validateSession(sessionToken: string, branchId: string) {
		if (!this.kv) return false;
		const raw = await this.kv.get(`walk-in:session:${sessionToken}`);
		if (!raw) return false;

		let session: WalkInSession;
		try {
			session = JSON.parse(raw) as WalkInSession;
		} catch {
			return false;
		}

		if (session.branchId !== branchId) return false;
		if (session.expiresAt < Date.now()) return false;
		return true;
	}
}
