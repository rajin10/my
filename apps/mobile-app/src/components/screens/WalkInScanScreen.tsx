import { ApiError } from "@repo/api-client";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import * as Icons from "lucide-react-native";
import { useCallback, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { walkInContextRoute } from "../../hooks/useWalkIn";
import { api } from "../../lib/api";
import { parseWalkInUrl, walkInRouteParams } from "../../lib/walk-in-url";
import { Colors, Radius, Shadow } from "../../tokens";
import { toast } from "../Toast";
import { Button } from "../ui";

export default function WalkInScanScreen() {
	const insets = useSafeAreaInsets();
	const [permission, requestPermission] = useCameraPermissions();
	const [busy, setBusy] = useState(false);

	const handleScan = useCallback(
		async (raw: string) => {
			if (busy) return;
			const parsed = parseWalkInUrl(raw);
			if (!parsed) {
				toast.show({ message: "Invalid QR code", tone: "danger" });
				return;
			}

			setBusy(true);
			try {
				const context = await api.walkIn.getContext({
					branchId: parsed.branchId,
					session: parsed.session,
					signature: parsed.signature,
				});
				router.replace({
					pathname: walkInContextRoute(context),
					params: walkInRouteParams(parsed),
				});
			} catch (err) {
				const message =
					err instanceof ApiError
						? err.message
						: "Could not load this shop. Check your connection and try again.";
				toast.show({ message, tone: "danger" });
				setBusy(false);
			}
		},
		[busy],
	);

	if (!permission) {
		return (
			<View className="flex-1 bg-paper items-center justify-center p-8">
				<Text className="text-ink-600">Checking camera permission…</Text>
			</View>
		);
	}

	if (!permission.granted) {
		return (
			<View className="flex-1 bg-paper">
				<Header insetTop={insets.top} />
				<View className="flex-1 items-center justify-center px-8">
					<Icons.ScanLine size={48} color={Colors.ink400} strokeWidth={1.75} />
					<Text
						className="text-ink-900 text-center font-bold"
						style={{ fontSize: 18, marginTop: 16 }}
					>
						Camera access needed
					</Text>
					<Text
						className="text-ink-500 text-center"
						style={{ fontSize: 15, lineHeight: 22, marginTop: 8 }}
					>
						Allow camera access to scan a shop QR code at the counter.
					</Text>
					<View style={{ marginTop: 24, width: "100%" }}>
						<Button onPress={requestPermission}>Allow camera</Button>
					</View>
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-ink-900">
			<Header insetTop={insets.top} />
			<View className="flex-1 overflow-hidden">
				<CameraView
					style={{ flex: 1 }}
					barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
					onBarcodeScanned={({ data }) => {
						void handleScan(data);
					}}
				/>
				<View
					pointerEvents="none"
					className="absolute inset-0 items-center justify-center"
				>
					<View
						style={{
							width: 240,
							height: 240,
							borderWidth: 2,
							borderColor: "rgba(255,255,255,0.85)",
							borderRadius: Radius.lg,
						}}
					/>
				</View>
			</View>
			<View
				className="px-6"
				style={{ paddingBottom: insets.bottom + 20, paddingTop: 16 }}
			>
				<Text
					className="text-white text-center"
					style={{ fontSize: 15, lineHeight: 22 }}
				>
					Point your camera at the shop QR code
				</Text>
				{busy && (
					<Text
						className="text-primary-200 text-center"
						style={{ fontSize: 14, marginTop: 8 }}
					>
						Loading shop…
					</Text>
				)}
			</View>
		</View>
	);
}

function Header({ insetTop }: { insetTop: number }) {
	return (
		<View
			className="flex-row items-center px-4"
			style={{ paddingTop: insetTop + 8, paddingBottom: 12, gap: 12 }}
		>
			<TouchableOpacity
				onPress={() => router.back()}
				style={{
					width: 40,
					height: 40,
					borderRadius: 20,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "rgba(255,255,255,0.12)",
					...Shadow.xs,
				}}
				accessibilityRole="button"
				accessibilityLabel="Go back"
			>
				<Icons.ChevronLeft size={22} color="#fff" strokeWidth={2} />
			</TouchableOpacity>
			<Text className="text-white" style={{ fontSize: 20, fontWeight: "600" }}>
				Scan shop QR
			</Text>
		</View>
	);
}
