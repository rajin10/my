import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import type { Review } from "../../data";
import { Colors } from "../../tokens";
import { ReviewCardSkeleton } from "../LoadingScreen";
import { ScreenContainer } from "../ScreenContainer";
import {
	Avatar,
	Button,
	Card,
	Empty,
	SectionTitle,
	Stars,
	StatusPill,
} from "../ui";

function ReviewCard({
	r,
	onApprove,
	onReject,
}: {
	r: Review;
	onApprove?: () => void;
	onReject?: () => void;
}) {
	return (
		<Card pad={16}>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
				<Avatar name={r.name} size={40} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text
						style={{ fontSize: 14.5, fontWeight: "700", color: Colors.ink900 }}
					>
						{r.name}
					</Text>
					<Text
						style={{ fontSize: 12.5, color: Colors.ink400, marginTop: 1 }}
						numberOfLines={1}
					>
						{r.service} · {r.date}
					</Text>
				</View>
				<Stars value={r.rating} size={14} />
			</View>
			<Text
				style={{
					marginTop: 12,
					fontSize: 14,
					lineHeight: 22,
					color: Colors.ink700,
				}}
			>
				"{r.text}"
			</Text>
			{r.status === "Pending" ? (
				<View
					style={{
						flexDirection: "row",
						gap: 9,
						marginTop: 14,
						paddingTop: 14,
						borderTopWidth: 1,
						borderTopColor: Colors.lineSoft,
					}}
				>
					<Button
						variant="primary"
						size="sm"
						icon="Check"
						full
						onPress={() => {
							Haptics.notificationAsync(
								Haptics.NotificationFeedbackType.Success,
							);
							onApprove?.();
						}}
					>
						Approve &amp; publish
					</Button>
					<Button
						variant="ghost"
						size="sm"
						icon="X"
						full
						onPress={() => {
							Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
							onReject?.();
						}}
					>
						Reject
					</Button>
				</View>
			) : (
				<View
					style={{
						marginTop: 12,
						paddingTop: 12,
						borderTopWidth: 1,
						borderTopColor: Colors.lineSoft,
					}}
				>
					<StatusPill status="Published" size="sm" />
				</View>
			)}
		</Card>
	);
}

export default function ReviewsScreen() {
	const insets = useSafeAreaInsets();
	const { reviews, approveReview, rejectReview, business } = useApp();
	const qc = useQueryClient();
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await qc.invalidateQueries({ queryKey: ["reviews"] });
		setRefreshing(false);
	}, [qc]);
	const pending = reviews.filter((r) => r.status === "Pending");
	const published = reviews.filter((r) => r.status === "Published");

	const isInitialLoad = !business.name && !refreshing;

	return (
		<ScreenContainer>
			<View className="flex-1 bg-paper">
				<View
					style={{
						paddingHorizontal: 16,
						paddingTop: insets.top + 12,
						paddingBottom: 8,
						backgroundColor: Colors.paper,
					}}
				>
					<Text
						style={{
							fontSize: 32,
							fontWeight: "400",
							letterSpacing: -0.5,
							color: Colors.ink900,
						}}
					>
						Reviews
					</Text>
					{business.rating > 0 && (
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 8,
								marginTop: 8,
							}}
						>
							<Stars value={business.rating} size={15} />
							<Text
								style={{
									fontSize: 14,
									fontWeight: "700",
									color: Colors.ink900,
								}}
							>
								{business.rating}
							</Text>
							<Text style={{ fontSize: 13.5, color: Colors.ink400 }}>
								· {business.reviews} reviews
							</Text>
						</View>
					)}
				</View>

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
					{isInitialLoad ? (
						<View style={{ gap: 12, paddingHorizontal: 16, marginTop: 18 }}>
							{[0, 1, 2].map((i) => (
								<ReviewCardSkeleton key={i} />
							))}
						</View>
					) : (
						<>
							{pending.length > 0 && (
								<View style={{ marginTop: 18 }}>
									<SectionTitle count={pending.length}>
										Awaiting approval
									</SectionTitle>
									<View
										style={{ gap: 12, paddingHorizontal: 16, marginTop: 14 }}
									>
										{pending.map((r) => (
											<ReviewCard
												key={r.id}
												r={r}
												onApprove={() => approveReview(r.id)}
												onReject={() => rejectReview(r.id)}
											/>
										))}
									</View>
								</View>
							)}

							<View style={{ marginTop: 26 }}>
								<SectionTitle>Published</SectionTitle>
								<View style={{ gap: 12, paddingHorizontal: 16, marginTop: 14 }}>
									{published.length === 0 ? (
										<Empty
											icon="MessageSquareQuote"
											title="No published reviews"
											body="Approved reviews appear on your public profile."
										/>
									) : (
										published.map((r) => <ReviewCard key={r.id} r={r} />)
									)}
								</View>
							</View>
						</>
					)}
				</ScrollView>
			</View>
		</ScreenContainer>
	);
}
