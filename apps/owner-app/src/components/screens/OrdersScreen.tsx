import { useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { money, partitionOrders } from "../../data";
import { useBranchOrders } from "../../hooks/useOwnerData";
import { Colors, Shadow } from "../../tokens";
import {
	BackHeader,
	BranchSwitcher,
	Card,
	FilterTabs,
	StatusPill,
} from "../ui";

export default function OrdersScreen() {
	const insets = useSafeAreaInsets();
	const { branch, setBranch, business, apiBranches, setOverlay, setSheet } =
		useApp();
	const [tab, setTab] = useState("active");

	const branchIds =
		branch === "All branches"
			? apiBranches.map((b) => b.id)
			: apiBranches.filter((b) => b.name === branch).map((b) => b.id);

	const ordersQ = useBranchOrders(branchIds);
	const { active, done } = partitionOrders(ordersQ.data ?? []);
	const shown = tab === "active" ? active : done;

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Orders"
				onBack={() => setOverlay(null)}
				topInset={insets.top}
			/>
			<View className="pt-2">
				<BranchSwitcher
					branches={business.branches}
					active={branch}
					onPick={setBranch}
				/>
			</View>
			<View style={{ paddingTop: 12, paddingHorizontal: 16 }}>
				<FilterTabs
					tabs={[
						{ id: "active", label: "Active", count: active.length },
						{ id: "done", label: "Done", count: done.length },
					]}
					active={tab}
					onPick={setTab}
				/>
			</View>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 16,
					paddingBottom: 32,
					gap: 11,
				}}
			>
				{ordersQ.isLoading ? (
					<ActivityIndicator
						color={Colors.primary600}
						style={{ marginTop: 24 }}
					/>
				) : ordersQ.isError ? (
					<View
						className="bg-surface border border-line rounded-lg"
						style={{ padding: 18, ...Shadow.sm }}
					>
						<Text
							className="text-ink-500 text-center"
							style={{ fontSize: 13.5 }}
						>
							Couldn't load orders.
						</Text>
						<TouchableOpacity
							onPress={() => ordersQ.refetch()}
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
				) : shown.length === 0 ? (
					<View
						className="bg-surface border border-line rounded-lg"
						style={{ padding: 18, ...Shadow.sm }}
					>
						<Text
							className="text-ink-500 text-center"
							style={{ fontSize: 13.5 }}
						>
							No orders for this branch yet.
						</Text>
					</View>
				) : (
					shown.map((o) => (
						<Card
							key={o.id}
							onPress={() => setSheet({ type: "orderDetail", orderId: o.id })}
						>
							<View
								className="flex-row items-start justify-between"
								style={{ gap: 12 }}
							>
								<View className="flex-1 min-w-0">
									<Text
										className="text-ink-900 font-bold"
										style={{ fontSize: 15 }}
									>
										#{o.id.slice(0, 8)}
									</Text>
									<Text
										className="text-ink-500"
										style={{ fontSize: 13, marginTop: 3 }}
									>
										{o.deliveryLine}
									</Text>
									<Text
										className="text-ink-400"
										style={{ fontSize: 12, marginTop: 3 }}
									>
										{new Date(o.createdAt).toLocaleDateString("en-BD", {
											day: "numeric",
											month: "short",
											year: "numeric",
										})}
									</Text>
								</View>
								<View className="items-end" style={{ gap: 6 }}>
									<StatusPill status={o.status} size="sm" />
									<Text
										className="text-ink-900 font-bold"
										style={{ fontSize: 14.5 }}
									>
										{money(o.total)}
									</Text>
								</View>
							</View>
						</Card>
					))
				)}
			</ScrollView>
		</View>
	);
}
