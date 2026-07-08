import type { KhataDue } from "@repo/api-client";
import { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { money, totalOutstanding } from "../../data";
import {
	useKhataCustomer,
	useKhataDues,
	useVoidPayment,
} from "../../hooks/useOwnerData";
import { Colors, Shadow } from "../../tokens";
import { BackHeader, Card } from "../ui";

export default function KhataScreen() {
	const insets = useSafeAreaInsets();
	const { businessId, setOverlay } = useApp();
	const [selected, setSelected] = useState<KhataDue | null>(null);

	const duesQ = useKhataDues(businessId);
	const dues = duesQ.data ?? [];

	if (selected) {
		return (
			<KhataCustomerLedger due={selected} onBack={() => setSelected(null)} />
		);
	}

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Customer dues"
				onBack={() => setOverlay(null)}
				topInset={insets.top}
			/>

			{dues.length > 0 && (
				<View className="px-4 pb-1">
					<Text className="text-ink-500" style={{ fontSize: 13 }}>
						Total outstanding
					</Text>
					<Text className="text-ink-900 font-bold" style={{ fontSize: 26 }}>
						{money(totalOutstanding(dues))}
					</Text>
				</View>
			)}

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 14,
					paddingBottom: 32,
					gap: 11,
				}}
			>
				{duesQ.isLoading ? (
					<ActivityIndicator
						color={Colors.primary600}
						style={{ marginTop: 24 }}
					/>
				) : duesQ.isError ? (
					<View
						className="bg-surface border border-line rounded-lg"
						style={{ padding: 18, ...Shadow.sm }}
					>
						<Text
							className="text-ink-500 text-center"
							style={{ fontSize: 13.5 }}
						>
							Couldn't load dues.
						</Text>
						<TouchableOpacity
							onPress={() => duesQ.refetch()}
							className="self-center"
							style={{ marginTop: 10 }}
						>
							<Text
								className="text-primary-600 font-semibold"
								style={{ fontSize: 14 }}
							>
								Retry
							</Text>
						</TouchableOpacity>
					</View>
				) : dues.length === 0 ? (
					<View
						className="bg-surface border border-line rounded-lg"
						style={{ padding: 18, ...Shadow.sm }}
					>
						<Text
							className="text-ink-500 text-center"
							style={{ fontSize: 13.5 }}
						>
							No outstanding dues.
						</Text>
					</View>
				) : (
					dues.map((d) => (
						<Card key={d.userId} onPress={() => setSelected(d)}>
							<View
								className="flex-row items-center justify-between"
								style={{ gap: 12 }}
							>
								<Text
									className="flex-1 text-ink-900 font-bold"
									style={{ fontSize: 15 }}
								>
									{d.name}
								</Text>
								<Text
									className="text-ink-900 font-bold"
									style={{ fontSize: 15 }}
								>
									{money(d.due)}
								</Text>
							</View>
						</Card>
					))
				)}
			</ScrollView>
		</View>
	);
}

function KhataCustomerLedger({
	due,
	onBack,
}: {
	due: KhataDue;
	onBack: () => void;
}) {
	const insets = useSafeAreaInsets();
	const { businessId, setSheet, flash } = useApp();
	const ledgerQ = useKhataCustomer(due.userId, businessId);
	const voidMut = useVoidPayment();
	const ledger = ledgerQ.data;
	const currentDue = ledger?.due ?? due.due;

	function confirmVoid(paymentId: string) {
		Alert.alert(
			"Void payment",
			"Remove this payment? The balance will increase.",
			[
				{ text: "Keep", style: "cancel" },
				{
					text: "Void",
					style: "destructive",
					onPress: () =>
						voidMut.mutate(paymentId, {
							onSuccess: () => flash("Payment voided.", { tone: "success" }),
							onError: (e: unknown) =>
								flash((e as Error).message ?? "Failed", { tone: "danger" }),
						}),
				},
			],
		);
	}

	return (
		<View className="flex-1 bg-paper">
			<BackHeader title={due.name} onBack={onBack} topInset={insets.top} />
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 14,
					paddingBottom: 32,
					gap: 16,
				}}
			>
				<View>
					<Text className="text-ink-500" style={{ fontSize: 13 }}>
						Outstanding due
					</Text>
					<Text className="text-ink-900 font-bold" style={{ fontSize: 28 }}>
						{money(currentDue)}
					</Text>
				</View>

				{!ledger ? (
					<Text className="text-ink-500" style={{ fontSize: 14 }}>
						{ledgerQ.isError ? "Couldn't load this ledger." : "Loading…"}
					</Text>
				) : (
					<>
						<View style={{ gap: 8 }}>
							<Text className="text-ink-700 font-bold" style={{ fontSize: 13 }}>
								Delivered orders · {money(ledger.totalDelivered)}
							</Text>
							{ledger.deliveredOrders.length === 0 ? (
								<Text className="text-ink-400" style={{ fontSize: 13 }}>
									None
								</Text>
							) : (
								ledger.deliveredOrders.map((o) => (
									<View
										key={o.id}
										className="flex-row items-center justify-between"
									>
										<Text className="text-ink-700" style={{ fontSize: 13.5 }}>
											#{o.id.slice(0, 8)}
											{o.deliveredAt
												? ` · ${new Date(o.deliveredAt).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}`
												: ""}
										</Text>
										<Text
											className="text-ink-900 font-semibold"
											style={{ fontSize: 13.5 }}
										>
											{money(o.total)}
										</Text>
									</View>
								))
							)}
						</View>

						<View style={{ gap: 8 }}>
							<Text className="text-ink-700 font-bold" style={{ fontSize: 13 }}>
								Payments · {money(ledger.totalPaid)}
							</Text>
							{ledger.payments.length === 0 ? (
								<Text className="text-ink-400" style={{ fontSize: 13 }}>
									None yet
								</Text>
							) : (
								ledger.payments.map((p) => (
									<View
										key={p.id}
										className="flex-row items-center justify-between"
									>
										<Text className="text-ink-700" style={{ fontSize: 13.5 }}>
											{money(p.amount)}
											{p.note ? ` · ${p.note}` : ""}
										</Text>
										<TouchableOpacity
											onPress={() => confirmVoid(p.id)}
											disabled={voidMut.isPending}
										>
											<Text
												style={{
													fontSize: 13,
													fontWeight: "600",
													color: Colors.danger,
												}}
											>
												Void
											</Text>
										</TouchableOpacity>
									</View>
								))
							)}
						</View>
					</>
				)}
			</ScrollView>

			<View
				className="px-4 border-t border-line"
				style={{ paddingTop: 12, paddingBottom: insets.bottom + 12 }}
			>
				<TouchableOpacity
					onPress={() =>
						setSheet({
							type: "recordPayment",
							businessId: businessId as string,
							userId: due.userId,
							customerName: due.name,
							due: currentDue,
						})
					}
					className="bg-primary-900 items-center rounded-lg"
					style={{ paddingVertical: 14 }}
				>
					<Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
						Record payment
					</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}
