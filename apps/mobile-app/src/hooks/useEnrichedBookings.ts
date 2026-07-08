import type {
	Booking as ApiBooking,
	Branch as ApiBranch,
	Service as ApiService,
	Business as ApiBusiness,
} from "@repo/api-client";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Booking, Branch, Service, Business } from "../data";
import { adaptApiBooking, adaptBranch, adaptService } from "../lib/adapters";
import { api } from "../lib/api";

function unwrap<T extends { id: string }>(res: { data?: T } | T): T {
	return ("data" in res && res.data ? res.data : res) as T;
}

function businessShell(v: ApiBusiness, branch?: Branch, service?: Service): Business {
	return {
		id: v.id,
		name: v.name,
		vertical: v.vertical,
		category: v.category,
		city: v.city,
		rating: 0,
		reviews: 0,
		from: service?.price ?? 0,
		tone: ["#e8f5e9", "#1b5e20"],
		blurb: v.description ?? "",
		branches: branch ? [branch] : [],
		services: service ? [service] : [],
	};
}

export function useEnrichedBookings(
	apiBookings: ApiBooking[],
	enabled: boolean,
): Booking[] {
	const businessIds = useMemo(
		() => [...new Set(apiBookings.map((b) => b.businessId))],
		[apiBookings],
	);
	const serviceIds = useMemo(
		() => [...new Set(apiBookings.map((b) => b.serviceId))],
		[apiBookings],
	);
	const branchIds = useMemo(
		() => [...new Set(apiBookings.map((b) => b.branchId))],
		[apiBookings],
	);

	const businessQueries = useQueries({
		queries: businessIds.map((id) => ({
			queryKey: ["business", id],
			queryFn: async () => unwrap(await api.businesses.get(id)),
			enabled: enabled && !!id,
			staleTime: 5 * 60_000,
		})),
	});

	const serviceQueries = useQueries({
		queries: serviceIds.map((id) => ({
			queryKey: ["service", id],
			queryFn: async () => unwrap(await api.services.get(id)),
			enabled: enabled && !!id,
			staleTime: 5 * 60_000,
		})),
	});

	const branchQueries = useQueries({
		queries: branchIds.map((id) => ({
			queryKey: ["branch", id],
			queryFn: async () => unwrap(await api.branches.get(id)),
			enabled: enabled && !!id,
			staleTime: 5 * 60_000,
		})),
	});

	const businessById = useMemo(() => {
		const m = new Map<string, ApiBusiness>();
		businessIds.forEach((id, i) => {
			const v = businessQueries[i]?.data;
			if (v) m.set(id, v);
		});
		return m;
	}, [businessIds, businessQueries]);

	const serviceById = useMemo(() => {
		const m = new Map<string, ApiService>();
		serviceIds.forEach((id, i) => {
			const s = serviceQueries[i]?.data;
			if (s) m.set(id, s);
		});
		return m;
	}, [serviceIds, serviceQueries]);

	const branchById = useMemo(() => {
		const m = new Map<string, ApiBranch>();
		branchIds.forEach((id, i) => {
			const b = branchQueries[i]?.data;
			if (b) m.set(id, b);
		});
		return m;
	}, [branchIds, branchQueries]);

	return useMemo(
		() =>
			apiBookings.map((b) => {
				const business = businessById.get(b.businessId);
				const service = serviceById.get(b.serviceId);
				const branch = branchById.get(b.branchId);
				const uiService = service ? adaptService(service) : undefined;
				const uiBranch = branch ? adaptBranch(branch) : undefined;
				const uiBusiness = business
					? businessShell(business, uiBranch, uiService)
					: undefined;
				return adaptApiBooking(b, {
					business: uiBusiness,
					service: uiService,
					branch: uiBranch,
				});
			}),
		[apiBookings, businessById, serviceById, branchById],
	);
}
