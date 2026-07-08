import { router, useLocalSearchParams } from "expo-router";
import * as Icons from "lucide-react-native";
import type { ComponentType } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { formatMoney } from "../../lib/format";
import { Colors, Radius } from "../../tokens";
import { Button } from "../ui";

export default function WalkInConfirmScreen() {
	const insets = useSafeAreaInsets();
	const { isAuthed } = useApp();
	const params = useLocalSearchParams<{
		localId: string;
		serverId?: string;
		vertical: "booking" | "commerce";
		businessName: string;
		title: string;
		subtitle?: string;
		total: string;
	}>();

	if (!params.localId) {
		router.replace("/walk-in/scan");
		return null;
	}

	const receiptPayload = JSON.stringify({ localId: params.localId });
	const isBooking = params.vertical === "booking";

	return (
		<View className="flex-1 bg-primary-900">
			<View
				className="flex-1 items-center px-6"
				style={{
					paddingTop: insets.top + 24,
					paddingBottom: insets.bottom + 16,
				}}
			>
				<View
					className="items-center justify-center border"
					style={{
						width: 76,
						height: 76,
						borderRadius: 38,
						backgroundColor: "rgba(255,255,255,0.1)",
						borderColor: "rgba(255,255,255,0.18)",
					}}
				>
					<Icons.Check size={36} color={Colors.primary200} strokeWidth={2} />
				</View>

				<Text
					className="text-white text-center"
					style={{
						marginTop: 26,
						fontSize: 28,
						fontWeight: "400",
						lineHeight: 34,
					}}
				>
					{isBooking ? "You're booked in." : "Order placed."}
				</Text>
				<Text
					className="text-primary-200 text-center"
					style={{ marginTop: 12, fontSize: 15.5, lineHeight: 24 }}
				>
					{isBooking
						? `Show this receipt to staff at ${params.businessName}.`
						: `Pay at the counter when you collect from ${params.businessName}.`}
				</Text>

				<View
					className="w-full border"
					style={{
						marginTop: 28,
						backgroundColor: "rgba(255,255,255,0.06)",
						borderRadius: Radius.lg,
						borderColor: "rgba(255,255,255,0.12)",
						padding: 18,
					}}
				>
					<DetailRow icon="Store" label={params.businessName} />
					<DetailRow
						icon={isBooking ? "Scissors" : "Package"}
						label={params.title}
					/>
					{params.subtitle ? (
						<DetailRow
							icon={isBooking ? "Clock" : "List"}
							label={params.subtitle}
						/>
					) : null}
					<DetailRow
						icon="Banknote"
						label={formatMoney(Number(params.total) || 0)}
						last
					/>
				</View>

				<View
					className="items-center bg-white"
					style={{
						marginTop: 28,
						padding: 16,
						borderRadius: Radius.lg,
					}}
				>
					<QRCode value={receiptPayload} size={180} />
					<Text
						style={{
							marginTop: 12,
							fontSize: 12,
							color: Colors.ink500,
							textAlign: "center",
						}}
					>
						Staff can scan this receipt
					</Text>
				</View>

				<View style={{ marginTop: 28, width: "100%", gap: 10 }}>
					{isAuthed && (
						<Button
							variant="subtle"
							onPress={() =>
								router.replace({
									pathname: "/(tabs)/account",
									params: isBooking ? {} : { view: "orders" },
								})
							}
						>
							{isBooking ? "View my bookings" : "View my orders"}
						</Button>
					)}
					<TouchableOpacity
						onPress={() => router.replace("/(tabs)")}
						style={{ paddingVertical: 12 }}
					>
						<Text
							className="text-primary-200 text-center"
							style={{ fontSize: 15, fontWeight: "600" }}
						>
							Back to search
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	);
}

function DetailRow({
	icon,
	label,
	last,
}: {
	icon: keyof typeof Icons;
	label: string;
	last?: boolean;
}) {
	const Comp = Icons[icon] as ComponentType<{
		size?: number;
		color?: string;
		strokeWidth?: number;
	}>;
	return (
		<View
			className="flex-row items-center"
			style={{
				gap: 12,
				paddingVertical: 10,
				borderBottomWidth: last ? 0 : 1,
				borderBottomColor: "rgba(255,255,255,0.1)",
			}}
		>
			{Comp && <Comp size={18} color={Colors.primary300} strokeWidth={1.75} />}
			<Text className="text-white" style={{ fontSize: 15, flex: 1 }}>
				{label}
			</Text>
		</View>
	);
}
