import type { LucideProps } from "lucide-react-native";
import * as Icons from "lucide-react-native";
import { type ComponentType, useMemo } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context";
import type { Order, OrderStatusUI } from "../data";
import {
	useBranchProducts,
	useCancelOrder,
	useOrder,
} from "../hooks/useOrders";
import { formatMoney } from "../lib/format";
import { Colors } from "../tokens";
import { Badge, type BadgeSize, type BadgeVariant, Button } from "./ui";

// OrderStatusUI has statuses (OutForDelivery, Delivered) that the shared
// StatusPill/BookingStatus type does not cover, so we map directly onto the
// Badge primitive — the same primitive StatusPill itself wraps.
const ORDER_STATUS: Record<
	OrderStatusUI,
	{ variant: BadgeVariant; label: string }
> = {
	Pending: { variant: "pending", label: "Pending" },
	Confirmed: { variant: "info", label: "Confirmed" },
	OutForDelivery: { variant: "info", label: "Out for delivery" },
	Delivered: { variant: "success", label: "Delivered" },
	Cancelled: { variant: "danger", label: "Cancelled" },
};

export function OrderStatusPill({
	status,
	size = "md",
}: {
	status: OrderStatusUI;
	size?: BadgeSize;
}) {
	const s = ORDER_STATUS[status];
	return (
		<Badge variant={s.variant} size={size} showIcon>
			{s.label}
		</Badge>
	);
}

export default function OrderDetailSheet({ order: o }: { order: Order }) {
	// Background refresh — keeps status + line items fresh after push
	// notifications or time passing.
	const freshQuery = useOrder(o.id);
	const order = freshQuery.data ?? o;
	const status = order.status;

	// Resolve real product names at render time — reactive, so names fill in
	// once the branch products load (vs. freezing them at order-fetch time).
	const productsQuery = useBranchProducts(order.branchId);
	const nameByProductId = useMemo(
		() => new Map((productsQuery.data ?? []).map((p) => [p.id, p.name])),
		[productsQuery.data],
	);

	const { setModal } = useApp();
	const cancel = useCancelOrder();
	const insets = useSafeAreaInsets();

	const canCancel = status === "Pending" || status === "Confirmed";

	return (
		<View className="absolute inset-0 justify-end" style={{ zIndex: 70 }}>
			<TouchableOpacity
				className="absolute inset-0 bg-[rgba(8,54,44,0.40)]"
				onPress={() => setModal(null)}
				activeOpacity={1}
			/>
			<View
				className="bg-surface rounded-tl-xl rounded-tr-xl"
				style={[
					{
						paddingHorizontal: 20,
						paddingTop: 20,
						paddingBottom: insets.bottom + 28,
					},
					{
						shadowColor: "#08362C",
						shadowOffset: { width: 0, height: -4 },
						shadowOpacity: 0.12,
						shadowRadius: 24,
						elevation: 12,
					},
				]}
			>
				<View
					className="self-center bg-line-strong"
					style={{ width: 40, height: 4, borderRadius: 2, marginBottom: 18 }}
				/>

				{/* Header */}
				<View
					className="flex-row items-start justify-between"
					style={{ marginBottom: 16 }}
				>
					<View className="flex-1 min-w-0 mr-3">
						<Text
							style={{
								fontSize: 11.5,
								fontWeight: "700",
								color: Colors.primary600,
								letterSpacing: 1.5,
								textTransform: "uppercase",
								marginBottom: 4,
							}}
						>
							Order
						</Text>
						<Text
							style={{
								fontSize: 22,
								fontWeight: "400",
								letterSpacing: -0.3,
								color: Colors.ink900,
								lineHeight: 27,
							}}
						>
							{formatMoney(order.total)}
						</Text>
					</View>
					<OrderStatusPill status={status} />
				</View>

				{/* Line items */}
				{order.items.length > 0 && (
					<View
						className="bg-paper rounded-lg"
						style={{
							padding: 16,
							gap: 12,
							marginBottom: 16,
							borderWidth: 1,
							borderColor: Colors.line,
						}}
					>
						{order.items.map((item) => (
							<View
								key={item.id}
								className="flex-row items-center"
								style={{ gap: 10 }}
							>
								<Text
									style={{ flex: 1, fontSize: 13.5, color: Colors.ink900 }}
									numberOfLines={1}
								>
									{nameByProductId.get(item.productId) ?? item.name}
									<Text style={{ color: Colors.ink500 }}>
										{`  × ${item.quantity}`}
									</Text>
								</Text>
								<Text
									style={{
										fontSize: 13.5,
										fontWeight: "600",
										color: Colors.ink900,
									}}
								>
									{formatMoney(item.lineTotal)}
								</Text>
							</View>
						))}
					</View>
				)}

				{/* Delivery snapshot */}
				<View
					className="bg-paper rounded-lg"
					style={{
						padding: 16,
						gap: 12,
						marginBottom: 16,
						borderWidth: 1,
						borderColor: Colors.line,
					}}
				>
					<Row icon="MapPin" label="Address" value={order.deliveryLine} />
					{(order.deliveryArea || order.deliveryCity) && (
						<Row
							icon="Navigation"
							label="Area"
							value={[order.deliveryArea, order.deliveryCity]
								.filter(Boolean)
								.join(", ")}
						/>
					)}
					<Row
						icon="CreditCard"
						label="Total"
						value={formatMoney(order.total)}
					/>
				</View>

				{/* Actions */}
				<View style={{ gap: 10 }}>
					{canCancel && (
						<Button
							variant="ghost"
							full
							disabled={cancel.isPending}
							onPress={() => {
								Alert.alert(
									"Cancel order",
									"Are you sure you want to cancel this order?",
									[
										{ text: "Keep", style: "cancel" },
										{
											text: "Cancel order",
											style: "destructive",
											onPress: () => {
												cancel.mutate(order.id, {
													onSettled: () => setModal(null),
												});
											},
										},
									],
								);
							}}
						>
							{cancel.isPending ? "Cancelling…" : "Cancel order"}
						</Button>
					)}
				</View>
			</View>
		</View>
	);
}

function Row({
	icon,
	label,
	value,
}: {
	icon: keyof typeof Icons;
	label: string;
	value: string;
}) {
	const LucideIcon = (Icons as Record<string, ComponentType<LucideProps>>)[
		icon
	];
	return (
		<View className="flex-row items-center" style={{ gap: 10 }}>
			<LucideIcon size={15} color={Colors.ink400} strokeWidth={1.75} />
			<Text style={{ width: 60, fontSize: 13, color: Colors.ink500 }}>
				{label}
			</Text>
			<Text
				style={{
					flex: 1,
					fontSize: 13.5,
					fontWeight: "600",
					color: Colors.ink900,
				}}
				numberOfLines={1}
			>
				{value}
			</Text>
		</View>
	);
}
