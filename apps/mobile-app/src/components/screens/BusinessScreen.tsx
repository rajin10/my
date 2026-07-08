import { useQueries, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Icons from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	Dimensions,
	FlatList,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import type { Service } from "../../data";
import { useBusinessDetail } from "../../hooks/useBusinessDetail";
import { api } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import { Colors, Radius, Shadow } from "../../tokens";
import { NetworkError } from "../NetworkError";
import { Button, Divider, Eyebrow, Stars } from "../ui";

function ReviewCard({
	r,
}: {
	r: {
		id: string;
		name: string;
		date: string;
		rating: number;
		service: string;
		text: string;
	};
}) {
	const initials = r.name
		.split(" ")
		.map((p: string) => p[0])
		.join("")
		.slice(0, 2);
	return (
		<View style={[styles.reviewCard, Shadow.xs]}>
			<View className="flex-row items-center" style={{ gap: 11 }}>
				<View style={styles.reviewAvatar}>
					<Text
						style={{
							color: Colors.primary700,
							fontWeight: "700",
							fontSize: 14,
						}}
					>
						{initials}
					</Text>
				</View>
				<View className="flex-1">
					<Text
						style={{ fontSize: 14.5, fontWeight: "600", color: Colors.ink900 }}
					>
						{r.name}
					</Text>
					<Text style={{ fontSize: 12.5, color: Colors.ink400 }}>
						{r.date} · {r.service}
					</Text>
				</View>
				<Stars value={r.rating} sizePx={13} />
			</View>
			<Text
				style={{
					marginTop: 12,
					fontSize: 14.5,
					lineHeight: 23,
					color: Colors.ink700,
				}}
			>
				{r.text}
			</Text>
		</View>
	);
}

function formatReviewDate(iso: string): string {
	const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (diff < 86400) return "Today";
	if (diff < 172800) return "Yesterday";
	return formatDate(iso, { day: "numeric", month: "short" });
}

const SCREEN_W = Dimensions.get("window").width;
const GALLERY_H = 300;

function PhotoGallery({
	tone,
	photos,
}: {
	tone: [string, string];
	photos: string[];
}) {
	const [activeIdx, setActiveIdx] = useState(0);
	const slides = photos.length > 0 ? photos : ["", "", ""];

	function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
		const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
		setActiveIdx(idx);
	}

	return (
		<View style={{ height: GALLERY_H }}>
			<FlatList
				data={slides}
				keyExtractor={(_, i) => String(i)}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onScroll={onScroll}
				scrollEventThrottle={16}
				getItemLayout={(_, i) => ({
					length: SCREEN_W,
					offset: SCREEN_W * i,
					index: i,
				})}
				renderItem={({ item, index }) =>
					item ? (
						<Image
							source={{ uri: item }}
							style={{ width: SCREEN_W, height: GALLERY_H }}
							contentFit="cover"
							transition={200}
						/>
					) : (
						<View
							style={{
								width: SCREEN_W,
								height: GALLERY_H,
								backgroundColor: tone[1],
							}}
						>
							<View
								style={[
									StyleSheet.absoluteFill,
									{ backgroundColor: tone[0], opacity: 0.5 + index * 0.1 },
								]}
							/>
						</View>
					)
				}
			/>
			{/* Dot indicators */}
			{slides.length > 1 && (
				<View
					style={{
						position: "absolute",
						bottom: 54,
						alignSelf: "center",
						flexDirection: "row",
						gap: 5,
					}}
				>
					{slides.map((slide, i) => (
						<View
							key={slide || i}
							style={{
								width: i === activeIdx ? 16 : 5,
								height: 5,
								borderRadius: 3,
								backgroundColor:
									i === activeIdx ? "#fff" : "rgba(255,255,255,0.5)",
							}}
						/>
					))}
				</View>
			)}
		</View>
	);
}

export default function BusinessScreen() {
	const { selectedBusiness, closeOverlay, saved, toggleSave, startBooking } =
		useApp();
	const businessId = selectedBusiness?.id ?? null;
	const detailQuery = useBusinessDetail(businessId);
	// biome-ignore lint/style/noNonNullAssertion: screen is only rendered when selectedBusiness is set
	const business = detailQuery.data ?? selectedBusiness!;
	const insets = useSafeAreaInsets();
	const [branch, setBranch] = useState(business.branches[0]?.id ?? "");
	const isSaved = saved.has(business.id);

	useEffect(() => {
		if (business.branches[0]?.id) setBranch(business.branches[0].id);
	}, [business.branches[0]?.id]);

	const reviewsQuery = useQuery({
		queryKey: ["reviews", "business", business.id],
		queryFn: () => api.reviews.list({ businessId: business.id, limit: 10 }),
		staleTime: 60_000,
	});

	const couponsQuery = useQuery({
		queryKey: ["business-coupons", business.id],
		queryFn: () => api.coupons.list({ businessId: business.id, limit: 10 }),
		staleTime: 120_000,
	});
	const reviews = (reviewsQuery.data?.data ?? [])
		.filter((r) => r.status === "Published")
		.map((r) => ({
			id: r.id,
			name: r.userName ?? "Guest",
			date: formatReviewDate(r.createdAt),
			rating: r.rating,
			service: "",
			text: r.text,
		}));

	const activeCoupons = (couponsQuery.data?.data ?? []).filter(
		(c) => c.status === "Active",
	);

	const hoursQueries = useQueries({
		queries: business.branches.map((b) => ({
			queryKey: ["branch-hours", b.id],
			queryFn: () => api.branches.getHours(b.id),
			staleTime: 300_000,
		})),
	});
	const branchHoursMap: Record<string, (typeof hoursQueries)[0]["data"]> = {};
	business.branches.forEach((b, i) => {
		branchHoursMap[b.id] = hoursQueries[i]?.data;
	});
	const selectedBranchHours = (branchHoursMap[branch] ?? []).filter(
		(h) => h != null,
	);

	function handleBook(service: Service) {
		const selectedBranch =
			business.branches.find((b) => b.id === branch) ?? business.branches[0];
		if (!selectedBranch) return;
		startBooking(business, service, selectedBranch);
	}

	if (detailQuery.isError && !detailQuery.data) {
		return (
			<NetworkError
				message="We couldn't load this business. Check your connection and try again."
				onRetry={() => detailQuery.refetch()}
			/>
		);
	}

	if (detailQuery.isLoading && !detailQuery.data) {
		return (
			<View className="flex-1 bg-paper">
				{/* Gallery placeholder */}
				<View
					style={{
						height: GALLERY_H,
						backgroundColor: Colors.line,
					}}
				/>
				<View style={{ padding: 18, gap: 14 }}>
					<View
						style={{
							height: 32,
							width: "60%",
							borderRadius: 8,
							backgroundColor: Colors.line,
						}}
					/>
					<View
						style={{
							height: 18,
							width: "40%",
							borderRadius: 6,
							backgroundColor: Colors.line,
						}}
					/>
					<View
						style={{
							height: 14,
							width: "80%",
							borderRadius: 6,
							backgroundColor: Colors.line,
						}}
					/>
					<View style={{ gap: 10, marginTop: 8 }}>
						{[1, 2, 3].map((i) => (
							<View
								key={i}
								style={{
									height: 64,
									borderRadius: 10,
									backgroundColor: Colors.line,
								}}
							/>
						))}
					</View>
				</View>
			</View>
		);
	}

	const branchServices = business.services.filter(
		(s) => !branch || !s.branchId || s.branchId === branch,
	);

	return (
		<View className="flex-1 bg-paper">
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 28 }}
			>
				{/* Photo gallery header */}
				<View style={{ position: "relative" }}>
					<PhotoGallery tone={business.tone} photos={business.photoUrls ?? []} />
					{/* Back + save buttons */}
					<View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
						<TouchableOpacity onPress={closeOverlay} style={styles.iconBtn}>
							<Icons.ChevronLeft
								size={20}
								color={Colors.ink800}
								strokeWidth={2}
							/>
						</TouchableOpacity>
						<TouchableOpacity
							onPress={() => toggleSave(business)}
							style={styles.iconBtn}
						>
							<Icons.Heart
								size={19}
								color={isSaved ? Colors.danger : Colors.ink800}
								fill={isSaved ? Colors.danger : "transparent"}
								strokeWidth={1.75}
							/>
						</TouchableOpacity>
					</View>
				</View>

				{/* Title block */}
				<View style={{ padding: 16, paddingTop: 20 }}>
					{business.premium && (
						<Eyebrow color={Colors.gold600} style={{ marginBottom: 8 }}>
							Premium business
						</Eyebrow>
					)}
					<Text style={styles.businessName}>{business.name}</Text>
					<View
						className="flex-row items-center"
						style={{ gap: 6, marginTop: 10 }}
					>
						<Stars value={business.rating} sizePx={14} />
						<Text
							style={{ fontWeight: "700", fontSize: 14, color: Colors.ink700 }}
						>
							{business.rating}
						</Text>
						<Text style={{ color: Colors.ink400, fontSize: 14 }}>
							({business.reviews} reviews)
						</Text>
					</View>
					<View
						className="flex-row items-center"
						style={{ gap: 6, marginTop: 8 }}
					>
						<Icons.MapPin size={15} color={Colors.ink500} strokeWidth={1.75} />
						<Text style={{ fontSize: 14, color: Colors.ink500 }}>
							{business.city}
						</Text>
					</View>
					<Text
						style={{
							marginTop: 16,
							fontSize: 15.5,
							lineHeight: 25,
							color: Colors.ink700,
						}}
					>
						{business.blurb}
					</Text>
				</View>

				{/* Branch selector */}
				{business.branches.length > 1 && (
					<View style={{ paddingHorizontal: 16, paddingTop: 22 }}>
						<Text style={styles.sectionLabel}>Choose a branch</Text>
						<View style={{ flexDirection: "row", gap: 8 }}>
							{business.branches.map((b) => {
								const on = b.id === branch;
								return (
									<TouchableOpacity
										key={b.id}
										onPress={() => setBranch(b.id)}
										style={[
											styles.branchBtn,
											on ? styles.branchActive : styles.branchInactive,
										]}
									>
										<Text
											style={{
												fontSize: 14.5,
												fontWeight: "600",
												color: Colors.ink900,
											}}
										>
											{b.name}
										</Text>
										<Text
											style={{
												fontSize: 12.5,
												color: Colors.ink500,
												marginTop: 2,
											}}
										>
											{b.address}
										</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>
				)}

				{/* Opening hours */}
				{selectedBranchHours.length > 0 && (
					<View style={{ paddingHorizontal: 16, paddingTop: 22 }}>
						<Text style={styles.h2}>Opening hours</Text>
						<View style={{ marginTop: 12, gap: 6 }}>
							{selectedBranchHours
								.sort((a, b) => a.dayOfWeek - b.dayOfWeek)
								.map((h) => (
									<View
										key={h.id}
										style={{
											flexDirection: "row",
											justifyContent: "space-between",
										}}
									>
										<Text
											style={{
												fontSize: 13.5,
												color: Colors.ink700,
												width: 90,
											}}
										>
											{DAY_NAMES[h.dayOfWeek]}
										</Text>
										{h.isClosed ? (
											<Text style={{ fontSize: 13.5, color: Colors.ink400 }}>
												Closed
											</Text>
										) : (
											<Text
												style={{
													fontSize: 13.5,
													color: Colors.ink900,
													fontWeight: "600",
												}}
											>
												{h.openTime} – {h.closeTime}
											</Text>
										)}
									</View>
								))}
						</View>
					</View>
				)}

				{/* Services */}
				<View style={{ paddingHorizontal: 16, paddingTop: 26 }}>
					<Text style={styles.h2}>Services</Text>
					{branchServices.length === 0 ? (
						<Text style={{ fontSize: 14, color: Colors.ink500 }}>
							No services at this branch yet.
						</Text>
					) : (
						branchServices.map((s, i) => (
							<View key={s.id}>
								<View style={styles.serviceRow}>
									{s.photoUrl ? (
										<Image
											source={{ uri: s.photoUrl }}
											style={{
												width: 56,
												height: 56,
												borderRadius: 10,
												marginRight: 12,
											}}
											contentFit="cover"
										/>
									) : null}
									<View className="flex-1">
										<Text
											style={{
												fontSize: 16,
												fontWeight: "600",
												color: Colors.ink900,
											}}
										>
											{s.name}
										</Text>
										{s.desc && (
											<Text
												style={{
													fontSize: 13.5,
													color: Colors.ink500,
													marginTop: 3,
													lineHeight: 20,
												}}
											>
												{s.desc}
											</Text>
										)}
										<View
											className="flex-row items-center"
											style={{ gap: 12, marginTop: 8 }}
										>
											<View
												className="flex-row items-center"
												style={{ gap: 4 }}
											>
												<Icons.Clock
													size={14}
													color={Colors.ink500}
													strokeWidth={1.75}
												/>
												<Text style={{ fontSize: 13, color: Colors.ink500 }}>
													{s.duration} min
												</Text>
											</View>
											<Text
												style={{
													fontWeight: "700",
													color: Colors.ink900,
													fontSize: 14,
												}}
											>
												{formatMoney(s.price)}
											</Text>
										</View>
									</View>
									<Button
										variant="subtle"
										size="sm"
										onPress={() => handleBook(s)}
										style={{ marginTop: 2 }}
									>
										Book
									</Button>
								</View>
								{i < branchServices.length - 1 && <Divider />}
							</View>
						))
					)}
				</View>

				{/* Active offers */}
				{activeCoupons.length > 0 && (
					<View style={{ paddingHorizontal: 16, paddingTop: 28 }}>
						<Text style={styles.h2}>Active offers</Text>
						<View style={{ gap: 10, marginTop: 14 }}>
							{activeCoupons.map((c) => (
								<View
									key={c.id}
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "space-between",
										padding: 14,
										borderRadius: Radius.lg,
										borderWidth: 1,
										borderColor: Colors.gold300,
										backgroundColor: Colors.gold100,
									}}
								>
									<View>
										<Text
											style={{
												fontSize: 14.5,
												fontWeight: "700",
												letterSpacing: 0.5,
												color: Colors.ink900,
												fontVariant: ["tabular-nums"],
											}}
										>
											{c.code}
										</Text>
										<Text
											style={{
												fontSize: 12.5,
												color: Colors.ink500,
												marginTop: 2,
											}}
										>
											Expires{" "}
											{formatDate(c.expiresAt, {
												day: "numeric",
												month: "short",
											})}
										</Text>
									</View>
									<Text
										style={{
											fontSize: 14.5,
											fontWeight: "700",
											color: Colors.gold700,
										}}
									>
										{c.type === "Percentage"
											? `${c.value}% off`
											: `${formatMoney(c.value)} off`}
									</Text>
								</View>
							))}
						</View>
					</View>
				)}

				{/* Reviews */}
				{reviews.length > 0 && (
					<View style={{ paddingHorizontal: 16, paddingTop: 30 }}>
						<View
							style={{
								flexDirection: "row",
								alignItems: "baseline",
								justifyContent: "space-between",
								marginBottom: 4,
							}}
						>
							<Text style={styles.h2}>Reviews</Text>
							<View className="flex-row items-center" style={{ gap: 6 }}>
								<Stars value={business.rating} sizePx={13} />
								<Text
									style={{
										fontWeight: "700",
										fontSize: 14,
										color: Colors.ink700,
									}}
								>
									{business.rating}
								</Text>
								<Text style={{ color: Colors.ink400, fontSize: 14 }}>
									· {business.reviews}
								</Text>
							</View>
						</View>
						<View style={{ gap: 12, marginTop: 14 }}>
							{reviews.map((r) => (
								<ReviewCard key={r.id} r={r} />
							))}
						</View>
					</View>
				)}
			</ScrollView>
		</View>
	);
}

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

const styles = StyleSheet.create({
	headerBar: {
		position: "absolute",
		left: 0,
		right: 0,
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: 12,
		paddingBottom: 10,
	},
	iconBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(251,250,246,0.92)",
		alignItems: "center",
		justifyContent: "center",
		shadowColor: "#08362C",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 8,
		elevation: 2,
	},
	businessName: {
		fontSize: 30,
		fontWeight: "400",
		letterSpacing: -0.4,
		color: Colors.ink900,
		lineHeight: 34,
	},
	sectionLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: Colors.ink700,
		marginBottom: 10,
	},
	branchBtn: {
		flex: 1,
		padding: 12,
		paddingHorizontal: 14,
		borderRadius: Radius.md,
		borderWidth: 1,
	},
	branchActive: {
		backgroundColor: Colors.primary50,
		borderColor: Colors.primary600,
	},
	branchInactive: {
		backgroundColor: Colors.surface,
		borderColor: Colors.lineStrong,
	},
	h2: {
		fontSize: 22,
		fontWeight: "500",
		color: Colors.ink900,
		marginBottom: 4,
	},
	serviceRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 14,
		paddingVertical: 16,
	},
	reviewCard: {
		backgroundColor: Colors.surface,
		borderWidth: 1,
		borderColor: Colors.line,
		borderRadius: Radius.lg,
		padding: 16,
	},
	reviewAvatar: {
		width: 38,
		height: 38,
		borderRadius: 19,
		backgroundColor: Colors.primary100,
		alignItems: "center",
		justifyContent: "center",
	},
});
