import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function useNetworkStatus() {
	const [isOnline, setIsOnline] = useState(true);

	useEffect(() => {
		const unsubscribe = NetInfo.addEventListener((state) => {
			setIsOnline(state.isConnected ?? false);
		});

		void NetInfo.fetch().then((state) => {
			setIsOnline(state.isConnected ?? false);
		});

		return unsubscribe;
	}, []);

	return { isOnline };
}
