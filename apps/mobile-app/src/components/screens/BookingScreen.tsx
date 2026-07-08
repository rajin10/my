import type { ValidateCouponResponse } from "@repo/api-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Icons from "lucide-react-native";
import { useMemo, useState } from "react";
import {
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { PAY_AT_BUSINESS } from "../../data";
import { api } from "../../lib/api";
import { addDaysIso, formatSlotTime, todayIso } from "../../lib/booking-slots";
import { t } from "../../lib/i18n";
import { Colors, Radius, Shadow } from "../../tokens";
import { Button, FieldLabel, Icon, type IconName } from "../ui";

function PriceRow({
	label,
	value,
	bold,
	green,
}: {
	label: string;
	value: string;
	bold?: boolean;
	green?: boolean;
}) {
	return (
		<View
			style={{
				flexDirection: "row",
				justifyContent: "space-between",
				paddingVertical: 3,
			}}
		>
			<Text
				style={{
					fontSize: bold ? 16 : 14,
					fontWeight: bold ? "700" : "500",
					color: green
						? Colors.successFg
						: bold
							? Colors.ink900
							: Colors.ink600,
				}}
			>
				{label}
			</Text>
			<Text
				style={{
					fontSize: bold ? 16 : 14,
					fontWeight: bold ? "700" : "500",
					color: green
						? Colors.successFg
						: bold
							? Colors.ink900
							: Colors.ink600,
				}}
			>
				{value}
			</Text>
		</View>
	);
}

export default function BookingScreen() {
	const { pendingBooking, closeOverlay, confirmBooking, bookingPending } =
		useApp();
	// biome-ignore lint/style/noNonNullAssertion: screen is only rendered when pendingBooking is set
	const { business, service, branch: initBranch } = pendingBooking!;
	const insets = useSafeAreaInsets();

	const days = useMemo(() => {
		const base = todayIso();
		const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		return Array.from({ length: 7 }, (_, i) => {
			const iso = addDaysIso(base, i);
			const d = new Date(iso);
			return {
				key: i,
				iso,
				wd: wd[d.getDay()] ?? "Sun",
				n: d.getDate(),
				label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : null,
			};
		});
	}, []);

	const [dayKey, setDayKey] = useState(0);
	// biome-ignore lint/style/noNonNullAssertion: days is always length 7
	const selectedDay = days.find((d) => d.key === dayKey) ?? days[0]!;
	const [slotIso, setSlotIso] = useState<string | null>(null);
	const [branch, setBranch] = useState(initBranch || business.branches[0]);
	const [couponCode, setCouponCode] = useState("");
	const [couponResult, setCouponResult] =
		useState<ValidateCouponResponse | null>(null);

	const availabilityQuery = useQuery({
		queryKey: ["branch-availability", branch?.id, selectedDay.iso, service.id],
		queryFn: () =>
			api.branches.getAvailability(branch!.id, {
				date: selectedDay.iso,
				serviceId: service.id,
			}),
		enabled: !!branch?.id,
		staleTime: 60_000,
	});
	const branchClosed = availabilityQuery.data?.isClosed ?? false;
	const slots = availabilityQuery.data?.slots ?? [];

	const validateCoupon = useMutation({
		mutationFn: (code: string) =>
			api.coupons.validate({ code, businessId: business.id }),
		onSuccess: (res) => setCouponResult(res),
	});

	const discount =
		couponResult?.valid && couponResult.discount != null
			? couponResult.discount
			: 0;
	const total = service.price - discount;
	const activeSlot = slotIso ?? slots[0] ?? null;

	function applyCode() {
		const code = couponCode.trim();
		if (!code) return;
		validateCoupon.mutate(code.toUpperCase());
	}

	if (!branch) return null;

	function handleConfirm() {
		if (!activeSlot) return;
		confirmBooking({
			business,
			service,
			branch,
			slotIso: activeSlot,
			total,
			discount,
			coupon:
				couponResult?.valid && couponResult.coupon
					? couponResult.coupon.code
					: null,
			payment: PAY_AT_BUSINESS,
		});
	}

	return (
		<View className="flex-1 bg-paper">
			<View style={[styles.topBar, { paddingTop: insets.top }]}>
				<TouchableOpacity onPress={closeOverlay} style={styles.closeBtn}>
					<Icons.X size={20} color={Colors.ink800} strokeWidth={2} />
				</TouchableOpacity>
				<Text style={styles.topTitle}>{t("booking.confirmTitle")}</Text>
				<View style={{ width: 40 }} />
			</View>

			<ScrollView
				contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
				showsVerticalScrollIndicator={false}
			>
				<View style={[styles.serviceSummary, Shadow.sm]}>
					<View
						style={{
							width: 56,
							height: 56,
							borderRadius: Radius.md,
							backgroundColor: business.tone[1],
							overflow: "hidden",
						}}
					>
						<View
							style={[
								StyleSheet.absoluteFill,
								{ backgroundColor: business.tone[0], opacity: 0.6 },
							]}
						/>
					</View>
					<View className="flex-1">
						<Text
							style={{
								fontSize: 15.5,
								fontWeight: "700",
								color: Colors.ink900,
							}}
						>
							{service.name}
						</Text>
						<Text
							style={{ fontSize: 13.5, color: Colors.ink500, marginTop: 2 }}
						>
							{business.name}
						</Text>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 5,
								marginTop: 6,
							}}
						>
							<Icons.Clock size={13} color={Colors.ink500} strokeWidth={1.75} />
							<Text style={{ fontSize: 13, color: Colors.ink500 }}>
								{service.duration} min
							</Text>
						</View>
					</View>
				</View>

				{business.branches.length > 1 && (
					<View style={{ marginTop: 22 }}>
						<FieldLabel icon="MapPin">Branch</FieldLabel>
						{business.branches.map((b) => {
							const on = b.id === branch.id;
							return (
								<TouchableOpacity
									key={b.id}
									onPress={() => {
										setBranch(b);
										setSlotIso(null);
									}}
									style={[
										styles.selectRow,
										on ? styles.selectRowActive : styles.selectRowInactive,
										{ marginBottom: 8 },
									]}
								>
									<View
										style={[
											styles.radio,
											{ borderColor: on ? Colors.primary600 : Colors.ink300 },
										]}
									>
										{on && <View style={styles.radioDot} />}
									</View>
									<View>
										<Text
											style={{
												fontSize: 14.5,
												fontWeight: "600",
												color: Colors.ink900,
											}}
										>
											{b.name}
										</Text>
										<Text style={{ fontSize: 12.5, color: Colors.ink500 }}>
											{b.address}
										</Text>
									</View>
								</TouchableOpacity>
							);
						})}
					</View>
				)}

				<View style={{ marginTop: 22 }}>
					<FieldLabel icon="Calendar">Date</FieldLabel>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ gap: 8 }}
					>
						{days.map((d) => {
							const on = d.key === dayKey;
							return (
								<TouchableOpacity
									key={d.key}
									onPress={() => {
										setDayKey(d.key);
										setSlotIso(null);
									}}
									style={[
										styles.dayBtn,
										on ? styles.dayBtnActive : styles.dayBtnInactive,
									]}
								>
									<Text
										style={{
											fontSize: 11.5,
											fontWeight: "600",
											color: on ? "rgba(255,255,255,0.8)" : Colors.ink500,
										}}
									>
										{d.wd}
									</Text>
									<Text
										style={{
											fontSize: 19,
											fontWeight: "700",
											marginTop: 2,
											color: on ? "#fff" : Colors.ink700,
										}}
									>
										{d.n}
									</Text>
								</TouchableOpacity>
							);
						})}
					</ScrollView>
				</View>

				<View style={{ marginTop: 22 }}>
					<FieldLabel icon="Clock">Time</FieldLabel>
					{branchClosed ? (
						<Text
							style={{ fontSize: 14, color: Colors.ink500, lineHeight: 22 }}
						>
							{t("booking.closedDay")}
						</Text>
					) : slots.length === 0 ? (
						<Text style={{ fontSize: 14, color: Colors.ink500 }}>
							{t("booking.noSlots")}
						</Text>
					) : (
						<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
							{slots.map((iso) => {
								const on = iso === activeSlot;
								const label = formatSlotTime(iso);
								return (
									<TouchableOpacity
										key={iso}
										onPress={() => setSlotIso(iso)}
										style={[
											styles.slotBtn,
											on ? styles.slotActive : styles.slotInactive,
										]}
									>
										<Text
											style={{
												fontSize: 14.5,
												fontWeight: "600",
												color: on ? Colors.primary700 : Colors.ink700,
											}}
										>
											{label}
										</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					)}
				</View>

				<View style={{ marginTop: 22 }}>
					<FieldLabel icon="Ticket">Coupon</FieldLabel>
					<View style={{ flexDirection: "row", gap: 8 }}>
						<View
							style={[
								styles.couponInput,
								{
									borderColor:
										couponResult && !couponResult.valid
											? Colors.danger
											: Colors.lineStrong,
								},
							]}
						>
							<TextInput
								value={couponCode}
								onChangeText={(v) => {
									setCouponCode(v);
									setCouponResult(null);
								}}
								placeholder="Enter a code"
								placeholderTextColor={Colors.ink400}
								autoCapitalize="characters"
								style={{
									flex: 1,
									fontSize: 15,
									color: Colors.ink900,
									padding: 0,
									fontFamily: "monospace",
								}}
							/>
						</View>
						<Button
							variant="ghost"
							onPress={applyCode}
							disabled={!couponCode.trim() || validateCoupon.isPending}
						>
							{validateCoupon.isPending ? "…" : "Apply"}
						</Button>
					</View>
					{couponResult?.valid && (
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 5,
								marginTop: 8,
							}}
						>
							<Icons.CheckCircle
								size={14}
								color={Colors.successFg}
								strokeWidth={1.75}
							/>
							<Text style={{ fontSize: 13, color: Colors.successFg }}>
								{couponResult.coupon?.code} applied — ৳
								{couponResult.discount ?? 0} off
							</Text>
						</View>
					)}
					{couponResult && !couponResult.valid && (
						<Text
							style={{ marginTop: 8, fontSize: 13, color: Colors.dangerFg }}
						>
							{couponResult.message ?? "Invalid coupon code."}
						</Text>
					)}
				</View>

				<View style={[styles.payRow, { marginTop: 22 }]}>
					<View style={[styles.payTile, { backgroundColor: Colors.creamDeep }]}>
						<Icon
							name={PAY_AT_BUSINESS.icon as IconName}
							sizePx={17}
							color={Colors.ink700}
						/>
					</View>
					<View className="flex-1">
						<Text
							style={{
								fontSize: 14.5,
								fontWeight: "600",
								color: Colors.ink900,
							}}
						>
							{PAY_AT_BUSINESS.label}
						</Text>
						<Text
							style={{ fontSize: 12.5, color: Colors.ink500, marginTop: 1 }}
						>
							{PAY_AT_BUSINESS.detail}. Online payments are coming soon.
						</Text>
					</View>
				</View>

				<View style={[styles.priceBox, { marginTop: 24 }]}>
					<PriceRow
						label="Service"
						value={`৳${service.price.toLocaleString("en-BD")}`}
					/>
					{discount > 0 && (
						<PriceRow
							label="Discount"
							value={`−৳${discount.toLocaleString("en-BD")}`}
							green
						/>
					)}
					<View
						style={{
							height: 1,
							backgroundColor: Colors.line,
							marginVertical: 12,
						}}
					/>
					<PriceRow
						label="Total"
						value={`৳${total.toLocaleString("en-BD")}`}
						bold
					/>
				</View>
			</ScrollView>

			<View
				style={[styles.stickyAction, { paddingBottom: insets.bottom + 12 }]}
			>
				<View
					style={{
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: 10,
					}}
				>
					<Text style={{ fontSize: 13.5, color: Colors.ink600 }}>
						{selectedDay.label || `${selectedDay.wd} ${selectedDay.n}`} ·{" "}
						{activeSlot ? formatSlotTime(activeSlot) : "—"} · {branch.name}
					</Text>
					<Text
						style={{ fontSize: 15, fontWeight: "700", color: Colors.ink900 }}
					>
						৳{total.toLocaleString("en-BD")}
					</Text>
				</View>
				<Button
					full
					size="lg"
					onPress={handleConfirm}
					disabled={
						!activeSlot || bookingPending || slots.length === 0 || branchClosed
					}
				>
					{bookingPending ? t("booking.confirming") : t("booking.confirm")}
				</Button>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	topBar: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 12,
		paddingBottom: 10,
		borderBottomWidth: 1,
		borderBottomColor: Colors.line,
		backgroundColor: Colors.surface,
	},
	topTitle: {
		flex: 1,
		textAlign: "center",
		fontSize: 17,
		fontWeight: "600",
		color: Colors.ink900,
	},
	closeBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	serviceSummary: {
		flexDirection: "row",
		gap: 14,
		padding: 14,
		backgroundColor: Colors.surface,
		borderRadius: Radius.lg,
		borderWidth: 1,
		borderColor: Colors.line,
	},
	selectRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		padding: 12,
		paddingHorizontal: 14,
		borderRadius: Radius.md,
		borderWidth: 1,
	},
	selectRowActive: {
		backgroundColor: Colors.primary50,
		borderColor: Colors.primary600,
	},
	selectRowInactive: {
		backgroundColor: Colors.surface,
		borderColor: Colors.lineStrong,
	},
	radio: {
		width: 18,
		height: 18,
		borderRadius: 9,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
	radioDot: {
		width: 9,
		height: 9,
		borderRadius: 5,
		backgroundColor: Colors.primary600,
	},
	dayBtn: {
		width: 58,
		paddingVertical: 10,
		borderRadius: Radius.md,
		alignItems: "center",
		borderWidth: 1,
	},
	dayBtnActive: {
		backgroundColor: Colors.primary900,
		borderColor: Colors.primary900,
	},
	dayBtnInactive: {
		backgroundColor: Colors.surface,
		borderColor: Colors.lineStrong,
	},
	slotBtn: {
		paddingVertical: 11,
		paddingHorizontal: 12,
		borderRadius: Radius.md,
		borderWidth: 1,
		minWidth: "22%",
		alignItems: "center",
	},
	slotActive: {
		backgroundColor: Colors.primary50,
		borderColor: Colors.primary600,
	},
	slotInactive: {
		backgroundColor: Colors.surface,
		borderColor: Colors.lineStrong,
	},
	couponInput: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 14,
		borderRadius: Radius.md,
		borderWidth: 1,
		backgroundColor: Colors.surface,
		height: 48,
	},
	payRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 13,
		padding: 12,
		paddingHorizontal: 14,
		borderRadius: Radius.md,
		backgroundColor: Colors.surface,
		borderWidth: 1,
		borderColor: Colors.lineStrong,
	},
	payTile: {
		width: 42,
		height: 30,
		borderRadius: Radius.xs,
		alignItems: "center",
		justifyContent: "center",
	},
	priceBox: {
		padding: 16,
		backgroundColor: Colors.surface,
		borderRadius: Radius.lg,
		borderWidth: 1,
		borderColor: Colors.line,
	},
	stickyAction: {
		paddingHorizontal: 16,
		paddingTop: 12,
		backgroundColor: "rgba(251,250,246,0.92)",
		borderTopWidth: 1,
		borderTopColor: Colors.line,
	},
	overlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(8,54,44,0.4)",
	},
	sheet: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: Colors.surface,
		borderTopLeftRadius: Radius.xl,
		borderTopRightRadius: Radius.xl,
		padding: 18,
		shadowColor: "#08362C",
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.12,
		shadowRadius: 24,
		elevation: 12,
	},
	sheetHandle: {
		width: 38,
		height: 5,
		borderRadius: Radius.pill,
		backgroundColor: Colors.lineStrong,
		alignSelf: "center",
		marginBottom: 16,
	},
	sheetTitle: {
		fontSize: 21,
		fontWeight: "500",
		color: Colors.ink900,
		marginBottom: 14,
	},
	paySheetRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 13,
		padding: 12,
		paddingHorizontal: 14,
		borderRadius: Radius.md,
		borderWidth: 1.5,
		marginBottom: 10,
	},
	paySheetRowActive: {
		backgroundColor: Colors.primary50,
		borderColor: Colors.primary600,
	},
	paySheetRowInactive: {
		backgroundColor: Colors.surface,
		borderColor: Colors.line,
	},
	radioCircle: {
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
});
