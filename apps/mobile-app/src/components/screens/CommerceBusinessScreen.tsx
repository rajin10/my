import { ApiError, type Product } from "@repo/api-client";
import { router } from "expo-router";
import * as Icons from "lucide-react-native";
import { useState } from "react";
import {
	Alert,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import type { CartLine } from "../../data";
import {
	useAddresses,
	useBranchProducts,
	useCreateOrder,
	useSaveAddress,
} from "../../hooks/useOrders";
import { addToCart, cartTotal, setQty, toOrderItems } from "../../lib/cart";
import { formatMoney } from "../../lib/format";
import { Colors, Radius } from "../../tokens";
import { NetworkError } from "../NetworkError";
import { Button, EmptyState, FieldLabel, Input } from "../ui";

/**
 * Commerce (LPG) business detail — ordering experience (ADR-0004).
 * Single-branch sellers for MVP: products list → cart → checkout (address) →
 * place order. Selected by `customerBusinessExperience` for the commerce vertical.
 */
export default function CommerceBusinessScreen() {
	const { selectedBusiness, isAuthed, closeOverlay } = useApp();
	const insets = useSafeAreaInsets();

	// LPG sellers are single-branch for MVP.
	const branch = selectedBusiness?.branches[0];

	const productsQuery = useBranchProducts(branch?.id);
	const products = (productsQuery.data ?? []).filter(
		(p) => p.status === "Active",
	);

	const [cart, setCart] = useState<CartLine[]>([]);
	const [checkingOut, setCheckingOut] = useState(false);

	function qtyOf(productId: string): number {
		return cart.find((l) => l.productId === productId)?.quantity ?? 0;
	}

	function increment(p: Product) {
		const current = qtyOf(p.id);
		if (current >= p.stock) return;
		setCart((c) =>
			addToCart(c, { productId: p.id, name: p.name, unitPrice: p.price }),
		);
	}

	function decrement(p: Product) {
		setCart((c) => setQty(c, p.id, qtyOf(p.id) - 1));
	}

	function startCheckout() {
		if (!isAuthed) {
			router.navigate("/(tabs)/account");
			return;
		}
		setCheckingOut(true);
	}

	if (!selectedBusiness || !branch) {
		return (
			<View className="flex-1 bg-paper">
				<Header title="Shop" onBack={closeOverlay} insetTop={insets.top} />
				<EmptyState
					icon="Store"
					title="Shop unavailable"
					body="This shop has no branch to order from yet. Please check back soon."
				/>
			</View>
		);
	}

	if (checkingOut) {
		return (
			<CheckoutView
				branchId={branch.id}
				cart={cart}
				insetTop={insets.top}
				insetBottom={insets.bottom}
				onBack={() => setCheckingOut(false)}
				onPlaced={() => {
					setCart([]);
					setCheckingOut(false);
				}}
			/>
		);
	}

	const count = cart.reduce((s, l) => s + l.quantity, 0);

	return (
		<View className="flex-1 bg-paper">
			<Header
				title={selectedBusiness.name}
				onBack={closeOverlay}
				insetTop={insets.top}
			/>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
			>
				<Text style={styles.h2}>Products</Text>

				{productsQuery.isLoading ? (
					<View style={{ gap: 10, marginTop: 14 }}>
						{[1, 2, 3].map((i) => (
							<View
								key={i}
								style={{
									height: 80,
									borderRadius: Radius.lg,
									backgroundColor: Colors.line,
								}}
							/>
						))}
					</View>
				) : productsQuery.isError && !productsQuery.data ? (
					<NetworkError
						message="We couldn't load products. Check your connection and try again."
						onRetry={() => productsQuery.refetch()}
					/>
				) : products.length === 0 ? (
					<EmptyState
						icon="Package"
						title="No products yet"
						body="This shop hasn't listed any products. Please check back soon."
					/>
				) : (
					<View style={{ gap: 12, marginTop: 14 }}>
						{products.map((p) => (
							<ProductRow
								key={p.id}
								product={p}
								qty={qtyOf(p.id)}
								onIncrement={() => increment(p)}
								onDecrement={() => decrement(p)}
							/>
						))}
					</View>
				)}
			</ScrollView>

			{count > 0 && (
				<View style={[styles.cartBar, { paddingBottom: insets.bottom + 12 }]}>
					<View>
						<Text style={styles.cartCount}>
							{count} {count === 1 ? "item" : "items"}
						</Text>
						<Text style={styles.cartTotal}>{formatMoney(cartTotal(cart))}</Text>
					</View>
					<Button size="lg" onPress={startCheckout}>
						Checkout
					</Button>
				</View>
			)}
		</View>
	);
}

function ProductRow({
	product,
	qty,
	onIncrement,
	onDecrement,
}: {
	product: Product;
	qty: number;
	onIncrement: () => void;
	onDecrement: () => void;
}) {
	const soldOut = product.stock <= 0;
	const atMax = qty >= product.stock;
	return (
		<View style={styles.productCard}>
			<View className="flex-1">
				<Text style={styles.productName}>{product.name}</Text>
				{product.description ? (
					<Text style={styles.productDesc} numberOfLines={2}>
						{product.description}
					</Text>
				) : null}
				<View
					className="flex-row items-center"
					style={{ gap: 10, marginTop: 8 }}
				>
					<Text style={styles.price}>{formatMoney(product.price)}</Text>
					<Text style={styles.stock}>
						{soldOut ? "Out of stock" : `${product.stock} in stock`}
					</Text>
				</View>
			</View>

			{soldOut ? null : qty === 0 ? (
				<Button size="sm" variant="subtle" onPress={onIncrement}>
					Add
				</Button>
			) : (
				<View style={styles.stepper}>
					<Button size="sm" variant="ghost" icon="Minus" onPress={onDecrement}>
						{""}
					</Button>
					<Text style={styles.qtyText}>{qty}</Text>
					<Button
						size="sm"
						variant="ghost"
						icon="Plus"
						onPress={onIncrement}
						disabled={atMax}
					>
						{""}
					</Button>
				</View>
			)}
		</View>
	);
}

function Header({
	title,
	onBack,
	insetTop,
}: {
	title: string;
	onBack: () => void;
	insetTop: number;
}) {
	return (
		<View style={[styles.topBar, { paddingTop: insetTop + 6 }]}>
			<Button variant="quiet" size="sm" icon="ChevronLeft" onPress={onBack}>
				{""}
			</Button>
			<Text style={styles.topTitle} numberOfLines={1}>
				{title}
			</Text>
			<View style={{ width: 40 }} />
		</View>
	);
}

function CheckoutView({
	branchId,
	cart,
	insetTop,
	insetBottom,
	onBack,
	onPlaced,
}: {
	branchId: string;
	cart: CartLine[];
	insetTop: number;
	insetBottom: number;
	onBack: () => void;
	onPlaced: () => void;
}) {
	const addressesQuery = useAddresses();
	const saveAddress = useSaveAddress();
	const createOrder = useCreateOrder();
	const addresses = addressesQuery.data ?? [];

	const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
		null,
	);
	const [showForm, setShowForm] = useState(false);
	const [label, setLabel] = useState("");
	const [line, setLine] = useState("");
	const [area, setArea] = useState("");
	const [city, setCity] = useState("");

	const activeAddressId =
		selectedAddressId ??
		addresses.find((a) => a.isDefault)?.id ??
		addresses[0]?.id ??
		null;

	function handleSaveAddress() {
		const trimmedLine = line.trim();
		if (!trimmedLine) return;
		saveAddress.mutate(
			{
				...(label.trim() ? { label: label.trim() } : {}),
				line: trimmedLine,
				...(area.trim() ? { area: area.trim() } : {}),
				...(city.trim() ? { city: city.trim() } : {}),
			},
			{
				onSuccess: (created) => {
					setSelectedAddressId(created.id);
					setShowForm(false);
					setLabel("");
					setLine("");
					setArea("");
					setCity("");
				},
				onError: () =>
					Alert.alert(
						"Couldn't save address",
						"Please check the details and try again.",
					),
			},
		);
	}

	async function handlePlaceOrder() {
		if (!activeAddressId) return;
		try {
			await createOrder.mutateAsync({
				branchId,
				addressId: activeAddressId,
				items: toOrderItems(cart),
			});
			Alert.alert(
				"Order placed",
				"Your order is on its way. Track it from My Orders.",
			);
			onPlaced();
		} catch (e) {
			const isOutOfStock = e instanceof ApiError && e.status === 409;
			Alert.alert(
				isOutOfStock ? "Out of stock" : "Order failed",
				isOutOfStock
					? "One or more items are out of stock. Adjust your cart and try again."
					: "Could not place your order. Please try again.",
			);
		}
	}

	return (
		<View className="flex-1 bg-paper">
			<Header title="Checkout" onBack={onBack} insetTop={insetTop} />

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
			>
				<Text style={styles.h2}>Delivery address</Text>

				{addressesQuery.isLoading ? (
					<Text style={styles.muted}>Loading addresses…</Text>
				) : addressesQuery.isError && !addressesQuery.data ? (
					<View style={{ gap: 10, marginTop: 8 }}>
						<Text style={styles.muted}>
							We couldn't load your saved addresses. Please try again.
						</Text>
						<View style={{ alignItems: "flex-start" }}>
							<Button
								variant="subtle"
								size="sm"
								icon="RefreshCw"
								onPress={() => addressesQuery.refetch()}
							>
								Retry
							</Button>
						</View>
					</View>
				) : addresses.length === 0 && !showForm ? (
					<Text style={[styles.muted, { marginTop: 6 }]}>
						No saved addresses yet. Add one to continue.
					</Text>
				) : (
					<View style={{ gap: 8, marginTop: 12 }}>
						{addresses.map((a) => {
							const on = a.id === activeAddressId;
							return (
								<TouchableOpacity
									key={a.id}
									activeOpacity={0.85}
									style={[
										styles.addressRow,
										on ? styles.rowActive : styles.rowInactive,
									]}
									onPress={() => setSelectedAddressId(a.id)}
								>
									<View
										style={[
											styles.radio,
											{ borderColor: on ? Colors.primary600 : Colors.ink300 },
										]}
									>
										{on && <View style={styles.radioDot} />}
									</View>
									<View className="flex-1">
										{a.label ? (
											<Text style={styles.addressLabel}>{a.label}</Text>
										) : null}
										<Text style={styles.addressLine}>{a.line}</Text>
										{(a.area || a.city) && (
											<Text style={styles.addressMeta}>
												{[a.area, a.city].filter(Boolean).join(", ")}
											</Text>
										)}
									</View>
								</TouchableOpacity>
							);
						})}
					</View>
				)}

				{showForm ? (
					<View style={{ gap: 12, marginTop: 16 }}>
						<FieldLabel icon="Tag">New address</FieldLabel>
						<Input
							placeholder="Label (e.g. Home)"
							value={label}
							onChangeText={setLabel}
						/>
						<Input
							placeholder="Address line"
							value={line}
							onChangeText={setLine}
						/>
						<Input placeholder="Area" value={area} onChangeText={setArea} />
						<Input placeholder="City" value={city} onChangeText={setCity} />
						<View style={{ flexDirection: "row", gap: 8 }}>
							<Button
								variant="ghost"
								onPress={() => setShowForm(false)}
								disabled={saveAddress.isPending}
							>
								Cancel
							</Button>
							<Button
								onPress={handleSaveAddress}
								disabled={!line.trim() || saveAddress.isPending}
							>
								{saveAddress.isPending ? "Saving…" : "Save address"}
							</Button>
						</View>
					</View>
				) : (
					<View style={{ marginTop: 14 }}>
						<Button
							variant="subtle"
							icon="Plus"
							onPress={() => setShowForm(true)}
						>
							Add address
						</Button>
					</View>
				)}

				<View style={{ marginTop: 28 }}>
					<Text style={styles.h2}>Order summary</Text>
					<View style={[styles.summaryBox, { marginTop: 12 }]}>
						{cart.map((l) => (
							<View key={l.productId} style={styles.summaryRow}>
								<Text style={styles.summaryItem} numberOfLines={1}>
									{l.quantity}× {l.name}
								</Text>
								<Text style={styles.summaryValue}>
									{formatMoney(l.unitPrice * l.quantity)}
								</Text>
							</View>
						))}
						<View style={styles.summaryDivider} />
						<View style={styles.summaryRow}>
							<Text style={styles.summaryTotalLabel}>Total</Text>
							<Text style={styles.summaryTotalValue}>
								{formatMoney(cartTotal(cart))}
							</Text>
						</View>
					</View>
				</View>
			</ScrollView>

			<View style={[styles.cartBar, { paddingBottom: insetBottom + 12 }]}>
				<Icons.MapPin size={18} color={Colors.ink500} strokeWidth={1.75} />
				<Button
					full
					size="lg"
					onPress={handlePlaceOrder}
					disabled={!activeAddressId || createOrder.isPending}
					style={{ flex: 1, marginLeft: 12 }}
				>
					{createOrder.isPending ? "Placing order…" : "Place order"}
				</Button>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	topBar: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 8,
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
	h2: {
		fontSize: 22,
		fontWeight: "500",
		color: Colors.ink900,
	},
	muted: {
		fontSize: 14,
		color: Colors.ink500,
	},
	productCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		padding: 14,
		backgroundColor: Colors.surface,
		borderRadius: Radius.lg,
		borderWidth: 1,
		borderColor: Colors.line,
	},
	productName: {
		fontSize: 16,
		fontWeight: "600",
		color: Colors.ink900,
	},
	productDesc: {
		fontSize: 13.5,
		color: Colors.ink500,
		marginTop: 3,
		lineHeight: 20,
	},
	price: {
		fontSize: 14.5,
		fontWeight: "700",
		color: Colors.ink900,
	},
	stock: {
		fontSize: 12.5,
		color: Colors.ink500,
	},
	stepper: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	qtyText: {
		minWidth: 24,
		textAlign: "center",
		fontSize: 15.5,
		fontWeight: "700",
		color: Colors.ink900,
		fontVariant: ["tabular-nums"],
	},
	cartBar: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingTop: 12,
		backgroundColor: "rgba(251,250,246,0.96)",
		borderTopWidth: 1,
		borderTopColor: Colors.line,
	},
	cartCount: {
		fontSize: 13,
		color: Colors.ink500,
	},
	cartTotal: {
		fontSize: 18,
		fontWeight: "700",
		color: Colors.ink900,
		marginTop: 1,
	},
	addressRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		padding: 12,
		paddingHorizontal: 14,
		borderRadius: Radius.md,
		borderWidth: 1,
	},
	rowActive: {
		backgroundColor: Colors.primary50,
		borderColor: Colors.primary600,
	},
	rowInactive: {
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
	addressLabel: {
		fontSize: 14.5,
		fontWeight: "600",
		color: Colors.ink900,
	},
	addressLine: {
		fontSize: 14,
		color: Colors.ink700,
	},
	addressMeta: {
		fontSize: 12.5,
		color: Colors.ink500,
		marginTop: 1,
	},
	summaryBox: {
		padding: 16,
		backgroundColor: Colors.surface,
		borderRadius: Radius.lg,
		borderWidth: 1,
		borderColor: Colors.line,
	},
	summaryRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 3,
		gap: 12,
	},
	summaryItem: {
		flex: 1,
		fontSize: 14,
		color: Colors.ink600,
	},
	summaryValue: {
		fontSize: 14,
		fontWeight: "500",
		color: Colors.ink700,
	},
	summaryDivider: {
		height: 1,
		backgroundColor: Colors.line,
		marginVertical: 12,
	},
	summaryTotalLabel: {
		fontSize: 16,
		fontWeight: "700",
		color: Colors.ink900,
	},
	summaryTotalValue: {
		fontSize: 16,
		fontWeight: "700",
		color: Colors.ink900,
	},
});
