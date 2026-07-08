import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

let configured = false;

/** Wire TanStack Query onlineManager to NetInfo (call once per app process). */
export function setupOnlineManager(): void {
	if (configured) return;
	configured = true;

	onlineManager.setEventListener((setOnline) => {
		return NetInfo.addEventListener((state) => {
			setOnline(state.isConnected ?? false);
		});
	});
}
