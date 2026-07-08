import { useCallback } from "react";
import { useNetworkStatus } from "./use-network-status";

export const OFFLINE_ACTION_MESSAGE =
	"You're offline. Connect to the internet to do this.";

export function useOfflineAction() {
	const { isOnline } = useNetworkStatus();

	return {
		canAct: isOnline,
		offlineMessage: OFFLINE_ACTION_MESSAGE,
	};
}

/** Returns true when the action may proceed; shows toast and returns false when offline. */
export function useOnlineGuard(showToast: (message: string) => void) {
	const { canAct, offlineMessage } = useOfflineAction();

	return useCallback(() => {
		if (canAct) return true;
		showToast(offlineMessage);
		return false;
	}, [canAct, offlineMessage, showToast]);
}
