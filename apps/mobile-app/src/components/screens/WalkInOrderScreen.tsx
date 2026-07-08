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
import type { CartLine } from "../../data";
import { useWalkInContext, useWalkInSubmit } from "../../hooks/useWalkIn";
import { addToCart, cartTotal, removeFromCart, setQty } from "../../lib/cart";
import { formatMoney } from "../../lib/format";
import { Colors, Radius } from "../../tokens";
import { NetworkError } from "../NetworkError";
import { toast } from "../Toast";
import { Button, FieldLabel, Input } from "../ui";

const GUEST_PHONE_RE = /^01[3-9]\d{8}$/;

export default function WalkInOrderScreen() {
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

	const [cart, setCart] = useState<CartLine[]>([]);
	const [guestName, setGuestName] = useState("");
	const [guestPhone, setGuestPhone] = useState("");

	const context =
		contextQuery.data?.vertical === "commerce" ? contextQuery.data : null;
	const products = context?.products ?? [];

	function qtyOf(productId: string): number {
		return cart.find((l) => l.productId === productId)?.quantity ?? 0;
	}

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

	function handlePlaceOrder() {
		if (!context) return;
		if (cart.length === 0) {
			toast.show({ message: "Add at least one product", tone: "info" });
			return;
		}
		if (!validateGuest()) return;

		const total = cartTotal(cart);
		const localId = crypto.randomUUID();

		submitMut.mutate(
			{
				localId,
				branchId: context.branchId,
				vertical: "commerce",
				customer: isAuthed
					? {}
					: { guestName: guestName.trim(), guestPhone: guestPhone.trim() },
				order: {
					items: cart.map((l) => ({
						productId: l.productId,
						qty: l.quantity,
					})),
				},
				total,
				submittedAt: Date.now(),
			},
			{
				onSuccess: (res) => {
					void Haptics.notificationAsync(
						Haptics.NotificationFeedbackType.Success,
					);
					const summary = cart
						.map((l) => `${l.quantity}× ${l.name}`)
						.join(", ");
					router.replace({
						pathname: "/walk-in/confirm",
						params: {
							localId: res.localId,
							serverId: res.serverId,
							vertical: "commerce",
							businessName: context.businessName,
							title: "Counter order",
							subtitle: summary,
							total: String(total),
						},
					});
				},
				onError: (err) => {
					const message =
						err instanceof ApiError
							? err.message
							: "Could not place your order. Try again.";
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

	const total = cartTotal(cart);

	return (
		<View className="flex-1 bg-paper">
			<SubHeader
				title={context?.businessName ?? "Walk-in order"}
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
							Add products — pay at the counter when you collect.
						</Text>

						<View style={{ gap: 12, marginTop: 16 }}>
							{products.map((p) => {
								const qty = qtyOf(p.id);
								return (
									<View
										key={p.id}
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 12,
											padding: 14,
											borderRadius: Radius.lg,
											borderWidth: 1,
											borderColor: Colors.lineStrong,
											backgroundColor: Colors.surface,
										}}
									>
										{p.photoUrl ? (
											<Image
												source={{ uri: p.photoUrl }}
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
												<Icons.Package
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
												{p.name}
											</Text>
											<Text style={{ fontSize: 13, color: Colors.ink500 }}>
												{formatMoney(p.price)} · {p.stock} in stock
											</Text>
										</View>
										<View
											style={{
												flexDirection: "row",
												alignItems: "center",
												gap: 8,
											}}
										>
											<TouchableOpacity
												onPress={() =>
													setCart((c) =>
														qty <= 1
															? removeFromCart(c, p.id)
															: setQty(c, p.id, qty - 1),
													)
												}
												disabled={qty === 0}
												style={stepperBtnStyle(qty === 0)}
											>
												<Icons.Minus size={16} color={Colors.ink700} />
											</TouchableOpacity>
											<Text
												style={{
													minWidth: 24,
													textAlign: "center",
													fontWeight: "700",
												}}
											>
												{qty}
											</Text>
											<TouchableOpacity
												onPress={() => {
													if (qty >= p.stock) return;
													setCart((c) =>
														addToCart(c, {
															productId: p.id,
															name: p.name,
															unitPrice: p.price,
														}),
													);
												}}
												disabled={qty >= p.stock}
												style={stepperBtnStyle(qty >= p.stock)}
											>
												<Icons.Plus size={16} color={Colors.ink700} />
											</TouchableOpacity>
										</View>
									</View>
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
						<View
							style={{
								flexDirection: "row",
								justifyContent: "space-between",
								marginBottom: 12,
							}}
						>
							<Text style={{ fontSize: 15, color: Colors.ink600 }}>Total</Text>
							<Text
								style={{
									fontSize: 17,
									fontWeight: "700",
									color: Colors.ink900,
								}}
							>
								{formatMoney(total)}
							</Text>
						</View>
						<Button
							onPress={handlePlaceOrder}
							disabled={cart.length === 0 || submitMut.isPending}
						>
							{submitMut.isPending ? "Placing order…" : "Place order"}
						</Button>
					</View>
				</>
			)}
		</View>
	);
}

function stepperBtnStyle(disabled: boolean) {
	return {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: Colors.lineStrong,
		alignItems: "center" as const,
		justifyContent: "center" as const,
		opacity: disabled ? 0.4 : 1,
	};
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
