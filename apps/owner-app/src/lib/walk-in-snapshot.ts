import type { BusinessVertical, WalkInContext } from "@repo/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { Product, Service } from "../data";

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Build a walk-in catalog snapshot from the owner TanStack Query cache (offline-safe). */
export async function buildWalkInSnapshotFromCache(
	qc: QueryClient,
	opts: {
		branchId: string;
		branchName: string;
		businessId: string;
		businessName: string;
		vertical: BusinessVertical;
		services: Service[];
		products: Product[];
	},
): Promise<WalkInContext> {
	const {
		branchId,
		branchName,
		businessId,
		businessName,
		vertical,
		services,
		products,
	} = opts;

	if (vertical === "commerce") {
		const branchProducts = products.filter((p) => p.branch === branchName);
		return {
			branchId,
			businessId,
			businessName,
			vertical: "commerce",
			brandPalette: null,
			fulfillment: "counter",
			products: branchProducts.map((p) => ({
				id: p.id,
				name: p.name,
				price: p.price,
				stock: p.stock ?? 0,
				photoUrl: p.photoUrl ?? null,
			})),
			snapshotAt: new Date().toISOString(),
		};
	}

	const branchServices = services.filter((s) => s.branch === branchName);
	const catalog = await Promise.all(
		branchServices.map(async (svc) => {
			const availability = qc.getQueryData<{
				slots: string[];
				isClosed: boolean;
			}>(["branch-availability", branchId, todayIso(), svc.id]);
			return {
				id: svc.id,
				name: svc.name,
				price: svc.price,
				duration: svc.duration,
				photoUrl: svc.photoUrl ?? null,
				nextSlot: availability?.slots[0] ?? null,
			};
		}),
	);

	return {
		branchId,
		businessId,
		businessName,
		vertical: "booking",
		brandPalette: null,
		services: catalog,
		snapshotAt: new Date().toISOString(),
	};
}
