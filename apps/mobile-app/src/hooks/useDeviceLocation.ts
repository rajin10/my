import * as Location from "expo-location";
import { useCallback, useState } from "react";

export type LocationStatus =
	| "idle"
	| "loading"
	| "granted"
	| "denied"
	| "error";

export interface DeviceLocation {
	lat: number;
	lng: number;
}

/**
 * On-demand device location. Call `request()` (e.g. when the user enters the
 * commerce segment); on denial the caller falls back to the manual area picker.
 */
export function useDeviceLocation() {
	const [status, setStatus] = useState<LocationStatus>("idle");
	const [coords, setCoords] = useState<DeviceLocation | null>(null);

	const request = useCallback(async () => {
		setStatus("loading");
		try {
			const { status: perm } =
				await Location.requestForegroundPermissionsAsync();
			if (perm !== "granted") {
				setStatus("denied");
				return null;
			}
			const pos = await Location.getCurrentPositionAsync({
				accuracy: Location.Accuracy.Balanced,
			});
			const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
			setCoords(next);
			setStatus("granted");
			return next;
		} catch {
			setStatus("error");
			return null;
		}
	}, []);

	const clear = useCallback(() => {
		setCoords(null);
		setStatus("idle");
	}, []);

	return { status, coords, request, clear };
}
