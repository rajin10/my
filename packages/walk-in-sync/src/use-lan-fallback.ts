import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/** True when the device has a route but cannot reach the public internet. */
export function useLanFallbackEligible() {
	const [eligible, setEligible] = useState(false);

	useEffect(() => {
		const update = (state: {
			isConnected?: boolean | null;
			isInternetReachable?: boolean | null;
		}) => {
			const connected = state.isConnected ?? false;
			const internet = state.isInternetReachable;
			setEligible(connected && internet === false);
		};

		const unsubscribe = NetInfo.addEventListener(update);
		void NetInfo.fetch().then(update);
		return unsubscribe;
	}, []);

	return eligible;
}
