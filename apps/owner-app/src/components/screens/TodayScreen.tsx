import { useOutbox } from "@repo/mobile-query";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
	Alert,
	RefreshControl,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import {
	type Booking,
	isBusinessStatusToggleable,
	money,
	shortMoney,
} from "../../data";
import { useLayout } from "../../hooks/useLayout";
import { OWNER_APP_ID } from "../../lib/query-client";
import { Colors, Radius, Shadow } from "../../tokens";
import { TodayScreenSkeleton } from "../LoadingScreen";
import { ScreenContainer } from "../ScreenContainer";
import {
	Avatar,
	BranchSwitcher,
	Button,
	Card,
	Icon,
	SectionTitle,
	StatCard,
	StatusPill,
} from "../ui";
import { useWalkInHub } from "../WalkInHubProvider";

function AppHeader() {
	const { greeting, business, status, toggleStatus, setOverlay, hasUnread } =
		useApp();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const toggleable = isBusinessStatusToggleable(status);
	return (
		<View
			className="px-4 bg-paper"
			style={{ paddingTop: insets.top + 12, paddingBottom: 14 }}
		>
			<View
				className="flex-row items-start justify-between"
				style={{ gap: 12 }}
			>
				<View className="min-w-0 flex-1">
					<Text
						style={{ fontSize: 14, color: Colors.ink500, fontWeight: "500" }}
					>
						{greeting}
					</Text>
					<Text
						style={{
							marginTop: 2,
							fontSize: 26,
							fontWeight: "400",
							letterSpacing: -0.4,
							color: Colors.ink900,
						}}
						numberOfLines={1}
					>
						{business.name}
					</Text>
				</View>
				<View
					className="flex-row items-center"
					style={{ gap: 8, paddingTop: 4 }}
				>
					<TouchableOpacity
						onPress={() => router.push("/walk-in")}
						style={[
							{
								height: 42,
								paddingHorizontal: 14,
								borderRadius: 21,
								borderWidth: 1,
								borderColor: Colors.line,
								backgroundColor: Colors.surface,
								alignItems: "center",
								justifyContent: "center",
							},
							Shadow.xs,
						]}
					>
						<Text
							style={{
								fontSize: 13.5,
								fontWeight: "600",
								color: Colors.primary700,
							}}
						>
							Walk-in
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => setOverlay("notifications")}
						style={[
							{
								position: "relative",
								width: 42,
								height: 42,
								borderRadius: 21,
								borderWidth: 1,
								borderColor: Colors.line,
								backgroundColor: Colors.surface,
								alignItems: "center",
								justifyContent: "center",
							},
							Shadow.xs,
						]}
					>
						<Icon name="Bell" size={20} color={Colors.ink700} />
						{hasUnread && (
							<View
								style={{
									position: "absolute",
									top: 9,
									right: 10,
									width: 9,
									height: 9,
									borderRadius: 5,
									backgroundColor: Colors.danger,
									borderWidth: 2,
									borderColor: Colors.surface,
								}}
							/>
						)}
					</TouchableOpacity>
					<TouchableOpacity onPress={() => setOverlay("account")}>
						<Avatar
							name={business.owner.name}
							size={42}
							bg={Colors.primary900}
							fg="#fff"
						/>
					</TouchableOpacity>
				</View>
			</View>

			{/* Status toggle */}
			<TouchableOpacity
				onPress={toggleable ? toggleStatus : undefined}
				disabled={!toggleable}
				accessibilityRole="switch"
				accessibilityLabel={
					status === "Suspended"
						? "Business is suspended by Talash"
						: status === "Active"
							? "Business is live. Tap to switch to Draft"
							: "Business is Draft. Tap to go live"
				}
				accessibilityState={{
					checked: status === "Active",
					disabled: !toggleable,
				}}
				style={[
					{
						marginTop: 12,
						alignSelf: "flex-start",
						flexDirection: "row",
						alignItems: "center",
						gap: 9,
						paddingVertical: 7,
						paddingRight: 7,
						paddingLeft: 13,
						borderRadius: Radius.pill,
						borderWidth: 1,
						borderColor: Colors.line,
						backgroundColor: Colors.surface,
					},
					Shadow.xs,
				]}
			>
				<View
					style={{
						width: 8,
						height: 8,
						borderRadius: 4,
						backgroundColor:
							status === "Active"
								? Colors.success
								: status === "Suspended"
									? Colors.danger
									: Colors.ink400,
					}}
				/>
				<Text
					style={{ fontSize: 13.5, fontWeight: "600", color: Colors.ink800 }}
				>
					{status === "Active"
						? "Live · accepting bookings"
						: status === "Suspended"
							? "Suspended · hidden from customers"
							: "Draft · hidden from customers"}
				</Text>
				{toggleable ? (
					<View
						className="flex-row items-center bg-primary-50 rounded-full"
						style={{ gap: 4, paddingHorizontal: 10, paddingVertical: 4 }}
					>
						<Icon name="Repeat" size={13} color={Colors.primary700} />
						<Text
							style={{
								fontSize: 12.5,
								fontWeight: "600",
								color: Colors.primary700,
							}}
						>
							{status === "Active" ? "Set to Draft" : "Go live"}
						</Text>
					</View>
				) : (
					<Text
						style={{
							fontSize: 12.5,
							fontWeight: "600",
							color: Colors.ink400,
							paddingHorizontal: 6,
						}}
					>
						Managed by Talash
					</Text>
				)}
			</TouchableOpacity>
		</View>
	);
}

function ConfirmAction({ onPress }: { onPress: () => void }) {
	return (
		<TouchableOpacity
			onPress={onPress}
			className="items-center justify-center bg-success-bg"
			style={{ width: 72, borderRadius: 16, marginRight: 8 }}
		>
			<Icon name="Check" size={20} color={Colors.successFg} />
			<Text
				style={{
					fontSize: 11,
					fontWeight: "700",
					color: Colors.successFg,
					marginTop: 3,
				}}
			>
				Confirm
			</Text>
		</TouchableOpacity>
	);
}

function DeclineAction({ onPress }: { onPress: () => void }) {
	return (
		<TouchableOpacity
			onPress={onPress}
			className="items-center justify-center bg-danger-bg"
			style={{ width: 72, borderRadius: 16, marginLeft: 8 }}
		>
			<Icon name="X" size={20} color={Colors.dangerFg} />
			<Text
				style={{
					fontSize: 11,
					fontWeight: "700",
					color: Colors.dangerFg,
					marginTop: 3,
				}}
			>
				Decline
			</Text>
		</TouchableOpacity>
	);
}

function BookingCard({ b, compact }: { b: Booking; compact?: boolean }) {
	const {
		confirmBooking,
		declineBooking,
		cancelBooking,
		completeBooking,
		setSheet,
	} = useApp();
	const { hasPendingForBooking } = useOutbox(OWNER_APP_ID);
	const isPending = b.status === "Pending";
	const syncPending = hasPendingForBooking(b.id);

	const card = (
		<Card
			onPress={() => setSheet({ type: "booking", b })}
			pad={15}
			style={{ gap: 12 }}
		>
			<View className="flex-row items-start" style={{ gap: 12 }}>
				<Avatar name={b.customer} size={42} />
				<View className="flex-1 min-w-0">
					<View
						className="flex-row items-baseline justify-between"
						style={{ gap: 8 }}
					>
						<Text
							className="flex-1 text-ink-900 font-bold"
							numberOfLines={1}
							style={{ fontSize: 15.5 }}
						>
							{b.customer}
						</Text>
						<Text
							style={{
								fontSize: 15,
								fontWeight: "700",
								color: Colors.ink900,
								flexShrink: 0,
							}}
						>
							{money(b.price)}
						</Text>
					</View>
					<Text
						style={{ fontSize: 14, color: Colors.ink600, marginTop: 2 }}
						numberOfLines={1}
					>
						{b.service}
					</Text>
					{syncPending ? (
						<Text
							style={{
								fontSize: 12,
								color: Colors.pendingFg,
								marginTop: 6,
								fontWeight: "600",
							}}
						>
							Pending sync
						</Text>
					) : null}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 12,
							marginTop: 8,
						}}
					>
						<View
							style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
						>
							<Icon name="Calendar" size={13} color={Colors.ink500} />
							<Text style={{ fontSize: 12.5, color: Colors.ink500 }}>
								{b.date}, {b.time}
							</Text>
						</View>
						<View
							style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
						>
							<Icon name="Clock" size={13} color={Colors.ink500} />
							<Text style={{ fontSize: 12.5, color: Colors.ink500 }}>
								{b.duration} min
							</Text>
						</View>
						<View
							style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
						>
							<Icon name="MapPin" size={13} color={Colors.ink500} />
							<Text style={{ fontSize: 12.5, color: Colors.ink500 }}>
								{b.branch}
							</Text>
						</View>
					</View>
				</View>
			</View>

			{!compact && (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 8,
						paddingTop: 12,
						borderTopWidth: 1,
						borderTopColor: Colors.lineSoft,
					}}
				>
					{b.status === "Pending" ? (
						<>
							<Button
								variant="primary"
								size="sm"
								icon="Check"
								full
								onPress={() => {
									Haptics.notificationAsync(
										Haptics.NotificationFeedbackType.Success,
									);
									confirmBooking(b.id);
								}}
							>
								Confirm
							</Button>
							<Button
								variant="ghost"
								size="sm"
								icon="X"
								full
								onPress={() => {
									Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
									Alert.alert(
										"Decline booking?",
										`Decline this booking for ${b.service}?`,
										[
											{ text: "Keep", style: "cancel" },
											{
												text: "Decline",
												style: "destructive",
												onPress: () => declineBooking(b.id),
											},
										],
									);
								}}
							>
								Decline
							</Button>
						</>
					) : b.status === "Confirmed" ? (
						<>
							<StatusPill status="Confirmed" size="sm" />
							<View style={{ flex: 1 }} />
							<Button
								variant="primary"
								size="sm"
								icon="CheckCheck"
								onPress={() => {
									Haptics.notificationAsync(
										Haptics.NotificationFeedbackType.Success,
									);
									completeBooking(b.id);
								}}
							>
								Complete
							</Button>
							<Button
								variant="quiet"
								size="sm"
								onPress={() => {
									Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
									Alert.alert(
										"Cancel booking?",
										`Cancel the confirmed booking for ${b.customer}?`,
										[
											{ text: "Keep", style: "cancel" },
											{
												text: "Cancel booking",
												style: "destructive",
												onPress: () => cancelBooking(b.id),
											},
										],
									);
								}}
							>
								Cancel
							</Button>
						</>
					) : (
						<StatusPill status={b.status} size="sm" />
					)}
				</View>
			)}
		</Card>
	);

	if (!compact && isPending) {
		return (
			<Swipeable
				renderLeftActions={() => (
					<ConfirmAction
						onPress={() => {
							Haptics.notificationAsync(
								Haptics.NotificationFeedbackType.Success,
							);
							confirmBooking(b.id);
						}}
					/>
				)}
				renderRightActions={() => (
					<DeclineAction
						onPress={() => {
							Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
							Alert.alert(
								"Decline booking?",
								`Decline this booking for ${b.service}?`,
								[
									{ text: "Keep", style: "cancel" },
									{
										text: "Decline",
										style: "destructive",
										onPress: () => declineBooking(b.id),
									},
								],
							);
						}}
					/>
				)}
				leftThreshold={60}
				rightThreshold={60}
				friction={2}
				overshootLeft={false}
				overshootRight={false}
			>
				{card}
			</Swipeable>
		);
	}
	return card;
}

function WalkInsLiveSection() {
	const { walkInModeActive, pendingWalkIns } = useWalkInHub();

	if (!walkInModeActive || pendingWalkIns.length === 0) return null;

	return (
		<View style={{ marginTop: 20 }}>
			<SectionTitle count={pendingWalkIns.length}>Walk-ins (live)</SectionTitle>
			<View style={{ gap: 11, paddingHorizontal: 16, marginTop: 14 }}>
				{pendingWalkIns.map((entry) => {
					const { submission } = entry;
					const customer =
						submission.customer.guestName?.trim() ||
						(submission.customer.userId ? "Signed-in customer" : "Guest");
					const title =
						submission.vertical === "booking"
							? "Walk-in booking"
							: "Walk-in order";
					return (
						<Card key={entry.localId} pad={15} style={{ gap: 8 }}>
							<View className="flex-row items-center justify-between">
								<Text
									style={{
										fontSize: 15,
										fontWeight: "700",
										color: Colors.ink900,
									}}
								>
									{customer}
								</Text>
								<Text
									style={{
										fontSize: 12,
										fontWeight: "600",
										color: Colors.pendingFg,
									}}
								>
									Local · pending sync
								</Text>
							</View>
							<Text style={{ fontSize: 14, color: Colors.ink600 }}>
								{title} · {money(submission.total)}
							</Text>
						</Card>
					);
				})}
			</View>
		</View>
	);
}

export default function TodayScreen() {
	const {
		bookings,
		branch,
		setBranch,
		business,
		pendingReviews,
		setTab,
		setSheet,
	} = useApp();
	const qc = useQueryClient();
	const [refreshing, setRefreshing] = useState(false);

	const inBranch = (b: Booking) =>
		branch === "All branches" || b.branch === branch;
	const scoped = bookings.filter(inBranch);
	const todays = scoped.filter((b) => b.date === "Today");
	const pending = todays.filter((b) => b.status === "Pending");
	const confirmedToday = todays
		.filter((b) => b.status === "Confirmed")
		.sort((a, b) => a.time.localeCompare(b.time));
	const revenueWeek = scoped
		.filter((b) => b.status !== "Cancelled")
		.reduce((s, b) => s + b.price, 0);

	const { isTablet } = useLayout();

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await qc.invalidateQueries({ queryKey: ["bookings"] });
		await qc.invalidateQueries({ queryKey: ["business"] });
		setRefreshing(false);
	}, [qc]);

	// Show skeleton until first business data loads
	if (!business.name && !refreshing) {
		return (
			<ScreenContainer>
				<View style={{ flex: 1 }}>
					<AppHeader />
					<TodayScreenSkeleton />
				</View>
			</ScreenContainer>
		);
	}

	return (
		<ScreenContainer>
			<View className="flex-1 bg-paper">
				<AppHeader />
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: 32 }}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							tintColor={Colors.primary600}
							colors={[Colors.primary600]}
						/>
					}
				>
					<View style={{ paddingTop: 4 }}>
						<BranchSwitcher
							branches={business.branches}
							active={branch}
							onPick={setBranch}
						/>
					</View>

					<WalkInsLiveSection />

					{/* Tablet: side-by-side stats + queue; Phone: stacked */}
					<View
						style={{
							flexDirection: isTablet ? "row" : "column",
							alignItems: isTablet ? "flex-start" : undefined,
						}}
					>
						{/* Stats grid */}
						<View
							style={{
								flexDirection: "row",
								flexWrap: "wrap",
								gap: 11,
								padding: 16,
								paddingTop: 16,
								flex: isTablet ? 1 : undefined,
							}}
						>
							<View style={{ width: "48%" }}>
								<StatCard
									label="Bookings today"
									value={todays.length}
									sub={`${confirmedToday.length} confirmed`}
									icon="CalendarCheck"
								/>
							</View>
							<View style={{ width: "48%" }}>
								<StatCard
									label="Pending approvals"
									value={pending.length}
									sub={pending.length ? "Tap to review" : "All clear"}
									icon="Clock"
									accent={Colors.pending}
								/>
							</View>
							<View style={{ width: "48%" }}>
								<StatCard
									label="Revenue this week"
									value={shortMoney(revenueWeek)}
									sub="Across bookings"
									icon="TrendingUp"
								/>
							</View>
							<View style={{ width: "48%" }}>
								<StatCard
									label="Average rating"
									value={business.rating}
									sub={`${business.reviews} reviews`}
									icon="Star"
									accent={Colors.gold500}
								/>
							</View>
						</View>

						{/* Needs approval — on tablet, sits to the right of stats */}
						{pending.length > 0 && (
							<View
								style={{
									marginTop: isTablet ? 16 : 10,
									flex: isTablet ? 1 : undefined,
									paddingHorizontal: isTablet ? 0 : undefined,
								}}
							>
								<SectionTitle
									count={pending.length}
									action="See all"
									onAction={() => setTab("bookings")}
								>
									Needs your approval
								</SectionTitle>
								<View style={{ gap: 11, paddingHorizontal: 16, marginTop: 14 }}>
									{pending.map((b) => (
										<BookingCard key={b.id} b={b} />
									))}
								</View>
							</View>
						)}

						{/* Today's schedule */}
						<View style={{ marginTop: 26 }}>
							<SectionTitle>Today's schedule</SectionTitle>
							<View style={{ paddingHorizontal: 16, marginTop: 14 }}>
								{confirmedToday.length === 0 ? (
									<Card pad={20}>
										<Text
											style={{
												fontSize: 14,
												color: Colors.ink500,
												textAlign: "center",
											}}
										>
											No confirmed appointments today yet.
										</Text>
									</Card>
								) : (
									<Card pad={4}>
										{confirmedToday.map((b, i) => (
											<TouchableOpacity
												key={b.id}
												onPress={() => setSheet({ type: "booking", b })}
												style={{
													flexDirection: "row",
													alignItems: "center",
													gap: 13,
													paddingHorizontal: 13,
													paddingVertical: 13,
													borderTopWidth: i ? 1 : 0,
													borderTopColor: Colors.lineSoft,
												}}
											>
												<View style={{ width: 52, alignItems: "center" }}>
													<Text
														style={{
															fontSize: 18,
															fontWeight: "400",
															color: Colors.ink900,
														}}
													>
														{b.time}
													</Text>
													<Text
														style={{
															fontSize: 11,
															color: Colors.ink400,
															marginTop: 3,
														}}
													>
														{b.duration}m
													</Text>
												</View>
												<View
													style={{
														width: 1,
														alignSelf: "stretch",
														backgroundColor: Colors.line,
													}}
												/>
												<View style={{ flex: 1, minWidth: 0 }}>
													<Text
														style={{
															fontSize: 14.5,
															fontWeight: "600",
															color: Colors.ink900,
														}}
														numberOfLines={1}
													>
														{b.service}
													</Text>
													<Text
														style={{
															fontSize: 13,
															color: Colors.ink500,
															marginTop: 2,
														}}
													>
														{b.customer} · {b.branch}
													</Text>
												</View>
												<Icon
													name="ChevronRight"
													size={18}
													color={Colors.ink300}
												/>
											</TouchableOpacity>
										))}
									</Card>
								)}
							</View>
						</View>
					</View>
					{/* end tablet row */}

					{/* Reviews nudge */}
					{pendingReviews > 0 && (
						<View style={{ paddingHorizontal: 16, marginTop: 20 }}>
							<Card
								onPress={() => setTab("reviews")}
								pad={16}
								style={{ flexDirection: "row", alignItems: "center", gap: 13 }}
							>
								<View
									style={{
										width: 44,
										height: 44,
										borderRadius: Radius.md,
										backgroundColor: Colors.gold100,
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Icon
										name="MessageSquareQuote"
										size={22}
										color={Colors.gold700}
									/>
								</View>
								<View style={{ flex: 1, minWidth: 0 }}>
									<Text
										style={{
											fontSize: 14.5,
											fontWeight: "600",
											color: Colors.ink900,
										}}
									>
										{pendingReviews}{" "}
										{pendingReviews === 1 ? "review" : "reviews"} to moderate
									</Text>
									<Text
										style={{ fontSize: 13, color: Colors.ink500, marginTop: 2 }}
									>
										Approve genuine feedback to publish it.
									</Text>
								</View>
								<Icon name="ChevronRight" size={20} color={Colors.ink300} />
							</Card>
						</View>
					)}
				</ScrollView>
			</View>
		</ScreenContainer>
	);
}

export { BookingCard };
