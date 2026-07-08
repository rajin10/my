import { useQueryClient } from "@tanstack/react-query";
import * as Icons from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { useRedeemRewards } from "../../hooks/useRewards";
import { formatNumber } from "../../lib/format";
import { Colors, Radius } from "../../tokens";
import { ScreenContainer } from "../ScreenContainer";
import { SignInPrompt } from "../SignInPrompt";
import { Button } from "../ui";

type HistoryEntry = { label: string; when: string; points: number };

function HistoryRow({ item, isLast }: { item: HistoryEntry; isLast: boolean }) {
	return (
		<View
			className="flex-row items-center"
			style={{
				gap: 14,
				paddingVertical: 14,
				borderBottomWidth: isLast ? 0 : 1,
				borderBottomColor: Colors.lineSoft,
			}}
			accessible
			accessibilityLabel={`${item.label}, ${item.when}, +${item.points} points`}
		>
			<View
				className="items-center justify-center"
				style={{
					width: 38,
					height: 38,
					borderRadius: 19,
					backgroundColor: Colors.gold100,
				}}
			>
				<Icons.Gift size={18} color={Colors.gold700} strokeWidth={1.75} />
			</View>
			<View className="flex-1">
				<Text className="text-ink-900 font-semibold" style={{ fontSize: 15 }}>
					{item.label}
				</Text>
				<Text className="text-ink-500" style={{ fontSize: 13 }}>
					{item.when}
				</Text>
			</View>
			<Text className="text-success-fg font-bold" style={{ fontSize: 15 }}>
				+{item.points}
			</Text>
		</View>
	);
}

const BalanceCard = React.memo(({ points }: { points: number }) => (
	<View
		className="mx-4 overflow-hidden rounded-xl bg-primary-900"
		style={{ padding: 22 }}
	>
		<View
			className="absolute bg-[rgba(201,160,99,0.35)]"
			style={{
				top: -30,
				right: -30,
				width: 140,
				height: 140,
				borderRadius: 70,
			}}
		/>
		<Text
			className="text-gold-300 font-semibold uppercase"
			style={{ fontSize: 12, letterSpacing: 2 }}
		>
			Talash points
		</Text>
		<View className="flex-row items-end" style={{ gap: 8, marginTop: 10 }}>
			<Text
				className="text-white"
				style={{ fontSize: 52, fontWeight: "400", lineHeight: 56 }}
			>
				{formatNumber(points)}
			</Text>
			<Icons.Sparkles
				size={22}
				color={Colors.gold300}
				strokeWidth={1.75}
				style={{ marginBottom: 6 }}
			/>
		</View>
		<Text
			className="text-primary-200"
			style={{ marginTop: 14, fontSize: 14, lineHeight: 22, maxWidth: 280 }}
		>
			You earn points automatically every time a business confirms your booking —
			no codes to enter.
		</Text>
	</View>
));

function RedeemSection({ balance }: { balance: number }) {
	const redeemMut = useRedeemRewards();
	const [open, setOpen] = useState(false);
	const [amount, setAmount] = useState("");

	if (balance <= 0) return null;

	const pts = Number(amount);
	const canRedeem = pts > 0 && pts <= balance && !redeemMut.isPending;

	return (
		<View
			style={{
				marginHorizontal: 16,
				marginTop: 16,
				padding: 16,
				borderRadius: Radius.lg,
				borderWidth: 1,
				borderColor: Colors.line,
				backgroundColor: Colors.surface,
			}}
		>
			{!open ? (
				<TouchableOpacity
					onPress={() => setOpen(true)}
					style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
				>
					<Icons.Coins size={18} color={Colors.primary700} strokeWidth={1.75} />
					<Text
						style={{
							fontSize: 15,
							fontWeight: "600",
							color: Colors.primary700,
						}}
					>
						Redeem points
					</Text>
				</TouchableOpacity>
			) : (
				<View style={{ gap: 12 }}>
					<Text style={{ fontSize: 14, color: Colors.ink600 }}>
						Enter points to redeem (max {formatNumber(balance)})
					</Text>
					<TextInput
						value={amount}
						onChangeText={setAmount}
						keyboardType="number-pad"
						placeholder={`Max ${balance}`}
						placeholderTextColor={Colors.ink400}
						style={{
							padding: 13,
							borderRadius: Radius.md,
							borderWidth: 1,
							borderColor: Colors.lineStrong,
							backgroundColor: Colors.paper,
							fontSize: 15,
							color: Colors.ink900,
						}}
					/>
					<View style={{ flexDirection: "row", gap: 10 }}>
						<Button
							variant="ghost"
							full
							onPress={() => {
								setOpen(false);
								setAmount("");
							}}
						>
							Cancel
						</Button>
						<Button
							variant="primary"
							full
							disabled={!canRedeem}
							onPress={() => {
								redeemMut.mutate(pts, {
									onSuccess: () => {
										setOpen(false);
										setAmount("");
									},
								});
							}}
						>
							{redeemMut.isPending ? "Redeeming…" : "Redeem"}
						</Button>
					</View>
				</View>
			)}
		</View>
	);
}

export default function RewardsScreen() {
	const { points, history, isAuthed, authLoading } = useApp();
	const insets = useSafeAreaInsets();
	const qc = useQueryClient();
	const [refreshing, setRefreshing] = useState(false);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await qc.invalidateQueries({ queryKey: ["rewards"] });
		setRefreshing(false);
	}, [qc]);

	if (authLoading) {
		return (
			<ScreenContainer>
				<View className="flex-1 items-center justify-center bg-paper">
					<ActivityIndicator size="large" color={Colors.primary600} />
				</View>
			</ScreenContainer>
		);
	}

	if (!isAuthed) {
		return (
			<ScreenContainer>
				<View className="flex-1 bg-paper">
					<View
						style={{
							paddingTop: insets.top + 12,
							paddingHorizontal: 16,
							paddingBottom: 10,
						}}
					>
						<Text
							className="text-ink-900"
							style={{ fontSize: 32, fontWeight: "400", letterSpacing: -0.5 }}
						>
							Rewards
						</Text>
					</View>
					<SignInPrompt
						icon="Gift"
						title="Sign in to earn rewards"
						body="You earn Talash points automatically when a business confirms your booking."
					/>
				</View>
			</ScreenContainer>
		);
	}

	return (
		<ScreenContainer>
			<FlatList
				className="flex-1 bg-paper"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 24 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={Colors.primary600}
						colors={[Colors.primary600]}
					/>
				}
				data={history}
				keyExtractor={(_, i) => String(i)}
				renderItem={({ item, index }) => (
					<HistoryRow item={item} isLast={index === history.length - 1} />
				)}
				ListHeaderComponent={
					<>
						<View
							style={{
								paddingTop: insets.top + 12,
								paddingHorizontal: 16,
								paddingBottom: 10,
							}}
						>
							<Text
								className="text-ink-900"
								style={{ fontSize: 32, fontWeight: "400", letterSpacing: -0.5 }}
							>
								Rewards
							</Text>
						</View>
						<BalanceCard points={points} />
						<RedeemSection balance={points} />
						<Text
							className="text-ink-900 font-medium"
							style={{
								marginTop: 26,
								marginHorizontal: 16,
								marginBottom: 4,
								fontSize: 22,
							}}
						>
							History
						</Text>
						{history.length === 0 && (
							<Text
								className="text-ink-500"
								style={{
									fontSize: 14.5,
									paddingVertical: 8,
									paddingHorizontal: 16,
								}}
							>
								Your earnings will appear here once a booking is confirmed.
							</Text>
						)}
					</>
				}
				ItemSeparatorComponent={null}
				contentInsetAdjustmentBehavior="automatic"
			/>
		</ScreenContainer>
	);
}
