import { ApiError } from "@repo/api-client";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";
import { toast } from "../components/Toast";
import { api } from "../lib/api";
import { parseWalkInUrl, walkInRouteParams } from "../lib/walk-in-url";
import { walkInContextRoute } from "./useWalkIn";

async function openWalkInFromUrl(url: string): Promise<void> {
	const parsed = parseWalkInUrl(url);
	if (!parsed) return;

	try {
		const context = await api.walkIn.getContext({
			branchId: parsed.branchId,
			session: parsed.session,
			signature: parsed.signature,
		});
		router.push({
			pathname: walkInContextRoute(context),
			params: walkInRouteParams(parsed),
		});
	} catch (err) {
		const message =
			err instanceof ApiError
				? err.message
				: "Could not open this shop link. Try scanning the QR again.";
		toast.show({ message, tone: "danger" });
	}
}

/** Listen for walk-in universal links and app deep links. */
export function useWalkInDeepLink() {
	useEffect(() => {
		let active = true;

		Linking.getInitialURL().then((url) => {
			if (active && url) void openWalkInFromUrl(url);
		});

		const sub = Linking.addEventListener("url", ({ url }) => {
			void openWalkInFromUrl(url);
		});

		return () => {
			active = false;
			sub.remove();
		};
	}, []);
}
