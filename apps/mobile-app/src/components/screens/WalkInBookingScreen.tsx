import { ApiError } from "@repo/api-client";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as Icons from "lucide-react-native";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { useWalkInContext, useWalkInSubmit } from "../../hooks/useWalkIn";
import { formatSlotTime } from "../../lib/booking-slots";
import { formatMoney } from "../../lib/format";
import { Colors, Radius } from "../../tokens";
import { NetworkError } from "../NetworkError";
import { toast } from "../Toast";
import { Button, FieldLabel, Input } from "../ui";

const GUEST_PHONE_RE = /^01[3-9]\d{8}$/;

export default function WalkInBookingScreen() {
	const insets = useSafeAreaInsets();
	const { isAuthed } = useApp();
	const params = useLocalSearchParams<{
		branchId: string;
		session?: string;
		signature?: string;
	}>();

	const contextParams = useMemo(
		() =>
			params.branchId
				? {
						branchId: params.branchId,
						session: params.session,
						signature: params.signature,
					}
				: undefined,
		[params.branchId, params.session, params.signature],
	);

	const contextQuery = useWalkInContext(contextParams);
	const submitMut = useWalkInSubmit(params.session);

	const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
		null,
	);
	const [guestName, setGuestName] = useState("");
	const [guestPhone, setGuestPhone] = useState("");

	const context =
		contextQuery.data?.vertical === "booking" ? contextQuery.data : null;
	const services = context?.services ?? [];
	const selected = services.find((s) => s.id === selectedServiceId);

	function validateGuest(): boolean {
		if (isAuthed) return true;
		const name = guestName.trim();
		if (name.length < 2) {
			toast.show({
				message: "Enter your name (at least 2 characters)",
				tone: "info",
			});
			return false;
		}
		if (!GUEST_PHONE_RE.test(guestPhone.trim())) {
			toast.show({
				message: "Enter a valid Bangladesh mobile number",
				tone: "info",
			});
			return false;
		}
		return true;
	}

	function handleBookNow() {
		if (!context || !selected) {
			toast.show({ message: "Choose a service first", tone: "info" });
			return;
		}
		if (!selected.nextSlot) {
			toast.show({
				message: "No slots available right now. Ask staff for help.",
				tone: "info",
			});
			return;
		}
		if (!validateGuest()) return;

		const localId = crypto.randomUUID();
		submitMut.mutate(
			{
				localId,
				branchId: context.branchId,
				vertical: "booking",
				customer: isAuthed
					? {}
					: { guestName: guestName.trim(), guestPhone: guestPhone.trim() },
				booking: { serviceId: selected.id, slot: selected.nextSlot },
				total: selected.price,
				submittedAt: Date.now(),
			},
			{
				onSuccess: (res) => {
					void Haptics.notificationAsync(
						Haptics.NotificationFeedbackType.Success,
					);
					router.replace({
						pathname: "/walk-in/confirm",
						params: {
							localId: res.localId,
							serverId: res.serverId,
							vertical: "booking",
							businessName: context.businessName,
							title: selected.name,
							subtitle: formatSlotTime(selected.nextSlot!),
							total: String(selected.price),
						},
					});
				},
				onError: (err) => {
					const message =
						err instanceof ApiError
							? err.message
							: "Could not complete your booking. Try again.";
					toast.show({ message, tone: "danger" });
					if (err instanceof ApiError && err.code === "CONFLICT") {
						contextQuery.refetch();
					}
				},
			},
		);
	}

	if (!params.branchId) {
		router.replace("/walk-in/scan");
		return null;
	}

	return (
		<View className="flex-1 bg-paper">
			<SubHeader
				title={context?.businessName ?? "Walk-in booking"}
				insetTop={insets.top}
			/>

			{contextQuery.isLoading ? (
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator color={Colors.primary600} />
				</View>
			) : contextQuery.isError || !context ? (
				<NetworkError
					message="We couldn't load this shop. Check your connection or scan the QR again."
					onRetry={() => contextQuery.refetch()}
				/>
			) : (
				<>
					<ScrollView
						contentContainerStyle={{
							padding: 16,
							paddingBottom: insets.bottom + 120,
						}}
					>
						<Text style={{ fontSize: 14, color: Colors.ink500 }}>
							Choose a service — we'll book the next available slot.
						</Text>

						<View style={{ gap: 10, marginTop: 16 }}>
							{services.map((svc) => {
								const active = svc.id === selectedServiceId;
								return (
									<TouchableOpacity
										key={svc.id}
										onPress={() => setSelectedServiceId(svc.id)}
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 12,
											padding: 14,
											borderRadius: Radius.lg,
											borderWidth: 1.5,
											borderColor: active
												? Colors.primary600
												: Colors.lineStrong,
											backgroundColor: active
												? Colors.primary50
												: Colors.surface,
										}}
									>
										{svc.photoUrl ? (
											<Image
												source={{ uri: svc.photoUrl }}
												style={{
													width: 56,
													height: 56,
													borderRadius: Radius.md,
												}}
												contentFit="cover"
											/>
										) : (
											<View
												style={{
													width: 56,
													height: 56,
													borderRadius: Radius.md,
													backgroundColor: Colors.line,
													alignItems: "center",
													justifyContent: "center",
												}}
											>
												<Icons.Scissors
													size={22}
													color={Colors.ink500}
													strokeWidth={1.75}
												/>
											</View>
										)}
										<View style={{ flex: 1 }}>
											<Text
												style={{
													fontSize: 16,
													fontWeight: "600",
													color: Colors.ink900,
												}}
											>
												{svc.name}
											</Text>
											<Text style={{ fontSize: 13, color: Colors.ink500 }}>
												{svc.duration} min
												{svc.nextSlot
													? ` · Next ${formatSlotTime(svc.nextSlot)}`
													: " · No slot today"}
											</Text>
										</View>
										<Text
											style={{
												fontSize: 15,
												fontWeight: "700",
												color: Colors.primary700,
											}}
										>
											{formatMoney(svc.price)}
										</Text>
									</TouchableOpacity>
								);
							})}
						</View>

						{!isAuthed && (
							<View style={{ marginTop: 24, gap: 12 }}>
								<Text
									style={{
										fontSize: 16,
										fontWeight: "600",
										color: Colors.ink900,
									}}
								>
									Your details
								</Text>
								<View>
									<FieldLabel>Name</FieldLabel>
									<Input
										value={guestName}
										onChangeText={setGuestName}
										placeholder="Your name"
										autoCapitalize="words"
									/>
								</View>
								<View>
									<FieldLabel>Mobile number</FieldLabel>
									<Input
										value={guestPhone}
										onChangeText={setGuestPhone}
										placeholder="01XXXXXXXXX"
										keyboardType="phone-pad"
									/>
								</View>
							</View>
						)}
					</ScrollView>

					<View
						className="border-t border-line-soft bg-paper px-4"
						style={{ paddingBottom: insets.bottom + 12, paddingTop: 12 }}
					>
						<Button
							onPress={handleBookNow}
							disabled={!selected || submitMut.isPending}
						>
							{submitMut.isPending ? "Booking…" : "Book now"}
						</Button>
					</View>
				</>
			)}
		</View>
	);
}

function SubHeader({ title, insetTop }: { title: string; insetTop: number }) {
	return (
		<View
			className="px-4 border-b border-line-soft bg-paper flex-row items-center"
			style={{ paddingTop: insetTop + 4, paddingBottom: 12, gap: 12 }}
		>
			<TouchableOpacity
				onPress={() => router.back()}
				accessibilityRole="button"
			>
				<Icons.ChevronLeft size={24} color={Colors.ink700} strokeWidth={2} />
			</TouchableOpacity>
			<Text
				style={{
					flex: 1,
					fontSize: 22,
					fontWeight: "500",
					color: Colors.ink900,
				}}
				numberOfLines={1}
			>
				{title}
			</Text>
		</View>
	);
}
