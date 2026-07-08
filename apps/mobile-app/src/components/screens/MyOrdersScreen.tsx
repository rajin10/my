import * as Icons from "lucide-react-native";
import { useEffect, useRef } from "react";
import {
	ActivityIndicator,
	FlatList,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import type { Order } from "../../data";
import { useMyOrders } from "../../hooks/useOrders";
import { formatDate, formatMoney } from "../../lib/format";
import { Colors, Radius, Shadow } from "../../tokens";
import OrderDetailSheet, { OrderStatusPill } from "../OrderDetailSheet";
import { EmptyState } from "../ui";

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
	const insets = useSafeAreaInsets();
	return (
		<View
			className="px-4 border-b border-line-soft bg-paper flex-row items-center"
			style={{ paddingTop: insets.top + 4, paddingBottom: 12, gap: 12 }}
		>
			<TouchableOpacity onPress={onBack} style={[styles.iconBtn, Shadow.xs]}>
				<Icons.ChevronLeft size={20} color={Colors.ink700} strokeWidth={2} />
			</TouchableOpacity>
			<Text
				style={{
					flex: 1,
					fontSize: 25,
					fontWeight: "400",
					letterSpacing: -0.4,
					color: Colors.ink900,
				}}
			>
				{title}
			</Text>
		</View>
	);
}

function OrderRow({ order }: { order: Order }) {
	const { setModal } = useApp();
	return (
		<TouchableOpacity
			onPress={() => setModal({ type: "orderDetail", order })}
			style={[
				{
					backgroundColor: Colors.surface,
					borderRadius: Radius.lg,
					borderWidth: 1,
					borderColor: Colors.line,
					padding: 14,
				},
				Shadow.sm,
			]}
			activeOpacity={0.85}
			accessibilityRole="button"
			accessibilityLabel={`Order ${formatMoney(order.total)}, ${order.status}`}
		>
			<View
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "flex-start",
					gap: 8,
				}}
			>
				<Text
					style={{
						fontSize: 16,
						fontWeight: "700",
						color: Colors.ink900,
						flex: 1,
					}}
				>
					{formatMoney(order.total)}
				</Text>
				<OrderStatusPill status={order.status} size="sm" />
			</View>
			<Text
				style={{ fontSize: 13.5, color: Colors.ink500, marginTop: 4 }}
				numberOfLines={1}
			>
				{order.deliveryLine}
			</Text>
			<Text style={{ fontSize: 12.5, color: Colors.ink400, marginTop: 6 }}>
				{formatDate(order.createdAt, { dateStyle: "medium" })}
			</Text>
		</TouchableOpacity>
	);
}

export default function MyOrdersScreen({
	onBack,
	focusOrderId,
}: {
	onBack: () => void;
	focusOrderId?: string;
}) {
	const { modal, setModal } = useApp();
	const ordersQuery = useMyOrders();
	const orders: Order[] = ordersQuery.data ?? [];

	// Order-status notification deep-link: once the list has loaded, auto-open the
	// detail sheet for the named order. Guarded so a background list refetch can't
	// re-pop it. If the order isn't on the loaded list we leave the list as-is
	// rather than opening an empty sheet.
	const autoOpenedRef = useRef(false);
	useEffect(() => {
		if (autoOpenedRef.current || !focusOrderId) return;
		const target = orders.find((o) => o.id === focusOrderId);
		if (target) {
			autoOpenedRef.current = true;
			setModal({ type: "orderDetail", order: target });
		}
	}, [focusOrderId, orders, setModal]);

	return (
		<View className="flex-1 bg-paper">
			<SubHeader title="My Orders" onBack={onBack} />
			{ordersQuery.isLoading ? (
				<ActivityIndicator
					color={Colors.primary600}
					style={{ marginTop: 24 }}
				/>
			) : ordersQuery.isError ? (
				<EmptyState
					icon="TriangleAlert"
					title="Couldn't load orders"
					body="Couldn't load your orders. Please try again later."
				/>
			) : orders.length === 0 ? (
				<EmptyState
					icon="ShoppingBag"
					title="No orders yet"
					body="When you place an order, it'll appear here so you can track it."
				/>
			) : (
				<FlatList
					data={orders}
					keyExtractor={(o) => o.id}
					renderItem={({ item }) => <OrderRow order={item} />}
					contentContainerStyle={{
						gap: 12,
						paddingHorizontal: 16,
						paddingTop: 16,
						paddingBottom: 24,
					}}
					showsVerticalScrollIndicator={false}
				/>
			)}

			{modal?.type === "orderDetail" && (
				<View style={StyleSheet.absoluteFill}>
					<OrderDetailSheet order={modal.order} />
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	iconBtn: {
		width: 38,
		height: 38,
		borderRadius: Radius.pill,
		borderWidth: 1,
		borderColor: Colors.line,
		backgroundColor: Colors.surface,
		alignItems: "center",
		justifyContent: "center",
	},
});
