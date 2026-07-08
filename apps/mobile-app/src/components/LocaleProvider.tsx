import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { refreshLocaleFromDevice } from "../lib/i18n";

/** Re-syncs `t()` when the app becomes active (device locale may have changed). */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		refreshLocaleFromDevice();
		const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
			if (state === "active") refreshLocaleFromDevice();
		});
		return () => sub.remove();
	}, []);

	return children;
}
