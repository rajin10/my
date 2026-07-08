import type {
	WalkInContext,
	WalkInSubmitBody,
	WalkInSubmitResponse,
} from "@repo/api-client";
import { useNetworkStatus, useOnlineGuard } from "@repo/mobile-query";
import {
	discoverHub,
	enqueueWalkInSubmission,
	fetchHubContext,
	submitToHub,
	useLanFallbackEligible,
} from "@repo/walk-in-sync";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "../components/Toast";
import { useApp } from "../context";
import { api } from "../lib/api";
import { MOBILE_APP_ID } from "../lib/query-client";

export type WalkInContextParams = {
	branchId: string;
	session?: string;
	signature?: string;
};

export function useWalkInContext(params: WalkInContextParams | undefined) {
	const lanEligible = useLanFallbackEligible();
	const { isOnline } = useNetworkStatus();

	return useQuery({
		queryKey: [
			"walk-in",
			"context",
			params?.branchId,
			params?.session,
			params?.signature,
			isOnline ? "online" : lanEligible ? "lan" : "offline",
		],
		queryFn: async (): Promise<WalkInContext> => {
			if (!params?.branchId) {
				throw new Error("Missing branch");
			}

			if (isOnline) {
				return api.walkIn.getContext({
					branchId: params.branchId,
					session: params.session,
					signature: params.signature,
				});
			}

			if (lanEligible) {
				const hub = await discoverHub(params.branchId);
				if (!hub) {
					throw new Error(
						"Could not find the shop on this Wi‑Fi. Ask staff to turn on walk-in mode.",
					);
				}
				const context = await fetchHubContext(hub, params.session);
				return context as WalkInContext;
			}

			throw new Error("offline");
		},
		enabled: !!params?.branchId && (isOnline || lanEligible),
		staleTime: 30_000,
	});
}

export function useWalkInSubmit(sessionToken?: string) {
	const { authedUser } = useApp();
	const lanEligible = useLanFallbackEligible();
	const { isOnline } = useNetworkStatus();
	const ensureOnline = useOnlineGuard((message) =>
		toast.show({ message, tone: "info" }),
	);

	return useMutation({
		mutationFn: async (
			body: WalkInSubmitBody,
		): Promise<WalkInSubmitResponse> => {
			const customer =
				authedUser?.id && !body.customer.guestName
					? { userId: authedUser.id }
					: body.customer;
			const payload = { ...body, customer };

			if (isOnline) {
				if (!ensureOnline()) {
					throw new Error("offline");
				}
				return api.walkIn.submit(payload);
			}

			if (lanEligible) {
				const hub = await discoverHub(body.branchId);
				if (!hub) {
					throw new Error(
						"Could not reach the shop on this Wi‑Fi. Ask staff to turn on walk-in mode.",
					);
				}
				const accepted = await submitToHub(hub, payload, sessionToken);
				enqueueWalkInSubmission(MOBILE_APP_ID, payload);
				return {
					localId: accepted.localId,
					serverId: accepted.localId,
					status: "accepted",
				};
			}

			if (!ensureOnline()) {
				throw new Error("offline");
			}
			throw new Error("offline");
		},
	});
}

export function walkInContextRoute(
	context: WalkInContext,
): "/walk-in/booking" | "/walk-in/order" {
	return context.vertical === "booking" ? "/walk-in/booking" : "/walk-in/order";
}

export type { WalkInContext, WalkInSubmitBody, WalkInSubmitResponse };
