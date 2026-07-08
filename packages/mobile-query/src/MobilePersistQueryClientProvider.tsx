import {
	PersistQueryClientProvider,
	type PersistQueryClientProviderProps,
} from "@tanstack/react-query-persist-client";
import { type ReactNode, useMemo } from "react";
import type { MobileAppId } from "./app-id";
import { clearPersistedCache } from "./clear-persisted-cache";
import { createQueryPersister } from "./create-query-persister";
import { shouldDehydrateQuery } from "./should-dehydrate-query";

type MobilePersistQueryClientProviderProps = {
	appId: MobileAppId;
	children: ReactNode;
} & Pick<PersistQueryClientProviderProps, "client">;

export function MobilePersistQueryClientProvider({
	appId,
	client,
	children,
}: MobilePersistQueryClientProviderProps) {
	const persister = useMemo(() => createQueryPersister(appId), [appId]);

	return (
		<PersistQueryClientProvider
			client={client}
			persistOptions={{
				persister,
				maxAge: Number.POSITIVE_INFINITY,
				buster: "",
				dehydrateOptions: {
					shouldDehydrateQuery,
				},
			}}
			onError={() => {
				console.warn(
					`[mobile-query] Failed to rehydrate cache for ${appId}; clearing.`,
				);
				clearPersistedCache(appId);
			}}
		>
			{children}
		</PersistQueryClientProvider>
	);
}
