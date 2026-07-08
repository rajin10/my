import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Icons from "lucide-react-native";
import { useCallback, useState } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import type { Business } from "../../data";
import { useFavouriteBusinesses } from "../../hooks/useFavouriteBusinesses";
import { formatMoney } from "../../lib/format";
import { Colors, Radius, Shadow } from "../../tokens";
import { ScreenContainer } from "../ScreenContainer";
import { SignInPrompt } from "../SignInPrompt";
import { EmptyState, Photo, Stars } from "../ui";

function FavBusinessCard({ business }: { business: Business }) {
	const { openBusiness, toggleSave, saved } = useApp();
	const isSaved = saved.has(business.id);
	return (
		<TouchableOpacity
			onPress={() => openBusiness(business)}
			style={[styles.card, Shadow.sm]}
			activeOpacity={0.9}
			accessibilityRole="button"
			accessibilityLabel={`${business.name}, ${business.category}, ${business.city}, rated ${business.rating}`}
		>
			<Photo tone={business.tone} height={150} uri={business.coverPhotoUrl}>
				<TouchableOpacity
					onPress={(e) => {
						e.stopPropagation?.();
						toggleSave(business);
					}}
					style={styles.heartBtn}
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel={
						isSaved
							? `Remove ${business.name} from favourites`
							: `Save ${business.name} to favourites`
					}
					accessibilityState={{ checked: isSaved }}
				>
					<Icons.Heart
						size={18}
						color={isSaved ? Colors.danger : Colors.ink700}
						fill={isSaved ? Colors.danger : "transparent"}
						strokeWidth={1.75}
					/>
				</TouchableOpacity>
				{business.premium && (
					<View style={styles.premiumBadge}>
						<Icons.Sparkles
							size={12}
							color={Colors.gold300}
							strokeWidth={1.75}
						/>
						<Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "600" }}>
							Premium
						</Text>
					</View>
				)}
			</Photo>
			<View style={{ padding: 14, paddingBottom: 16 }}>
				<Text style={styles.cardName}>{business.name}</Text>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 5,
						marginTop: 4,
					}}
				>
					<Icons.MapPin size={14} color={Colors.ink500} strokeWidth={1.75} />
					<Text style={{ fontSize: 13.5, color: Colors.ink500 }}>
						{business.city}
					</Text>
				</View>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 6,
						marginTop: 10,
					}}
				>
					<Stars value={business.rating} />
					<Text
						style={{ fontWeight: "700", fontSize: 13.5, color: Colors.ink700 }}
					>
						{business.rating}
					</Text>
					<Text style={{ color: Colors.ink400, fontSize: 13.5 }}>
						({business.reviews})
					</Text>
					<Text style={{ color: Colors.ink300 }}>·</Text>
					<Text style={{ color: Colors.ink500, fontSize: 13.5 }}>
						{business.category}
					</Text>
				</View>
				<View
					style={{
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "baseline",
						marginTop: 12,
						paddingTop: 12,
						borderTopWidth: 1,
						borderTopColor: Colors.lineSoft,
					}}
				>
					<Text style={{ fontSize: 12.5, color: Colors.ink400 }}>From</Text>
					<Text
						style={{ fontSize: 15, fontWeight: "700", color: Colors.ink900 }}
					>
						{formatMoney(business.from)}
					</Text>
				</View>
			</View>
		</TouchableOpacity>
	);
}

export default function FavouritesScreen() {
	const insets = useSafeAreaInsets();
	const { isAuthed, authLoading } = useApp();
	const { businesses: list, isLoading } = useFavouriteBusinesses();
	const qc = useQueryClient();
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await qc.invalidateQueries({ queryKey: ["favourites"] });
		await qc.invalidateQueries({ queryKey: ["business-photos"] });
		setRefreshing(false);
	}, [qc]);

	return (
		<ScreenContainer>
			<View className="flex-1 bg-paper">
				<View
					style={{
						paddingTop: insets.top + 12,
						paddingHorizontal: 16,
						paddingBottom: 6,
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
						Favourites
					</Text>
					<Text style={{ fontSize: 14.5, color: Colors.ink500, marginTop: 6 }}>
						Private to you — only you can see these.
					</Text>
				</View>

				{authLoading ? (
					<View
						style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
					>
						<ActivityIndicator color={Colors.primary600} />
					</View>
				) : !isAuthed ? (
					<SignInPrompt
						icon="Heart"
						title="Sign in to save favourites"
						body="Tap the heart on any business while signed in — your saved places sync across devices."
					/>
				) : isLoading ? (
					<View
						style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
					>
						<ActivityIndicator color={Colors.primary600} />
					</View>
				) : list.length === 0 ? (
					<EmptyState
						icon="Heart"
						title="No favourites yet"
						body="Tap the heart on any business to save it here, so you never have to search twice."
						cta="Discover businesses"
						onCta={() => router.navigate("/(tabs)")}
					/>
				) : (
					<ScrollView
						showsVerticalScrollIndicator={false}
						contentContainerStyle={{
							gap: 16,
							paddingHorizontal: 16,
							paddingTop: 8,
							paddingBottom: 24,
						}}
						refreshControl={
							<RefreshControl
								refreshing={refreshing}
								onRefresh={onRefresh}
								tintColor={Colors.primary600}
								colors={[Colors.primary600]}
							/>
						}
					>
						{list.map((v) => (
							<FavBusinessCard key={v.id} business={v} />
						))}
					</ScrollView>
				)}
			</View>
		</ScreenContainer>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: Colors.surface,
		borderRadius: Radius.lg,
		borderWidth: 1,
		borderColor: Colors.line,
		overflow: "hidden",
	},
	cardName: {
		fontSize: 21,
		fontWeight: "500",
		letterSpacing: -0.25,
		color: Colors.ink900,
		marginBottom: 4,
	},
	heartBtn: {
		position: "absolute",
		top: 12,
		right: 12,
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "rgba(251,250,246,0.92)",
		alignItems: "center",
		justifyContent: "center",
	},
	premiumBadge: {
		position: "absolute",
		top: 14,
		left: 14,
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		paddingVertical: 4,
		paddingHorizontal: 10,
		borderRadius: Radius.pill,
		backgroundColor: "rgba(8,54,44,0.55)",
	},
});
