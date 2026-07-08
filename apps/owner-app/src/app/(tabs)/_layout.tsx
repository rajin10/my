import type { BusinessVertical } from "@repo/api-client";
import { Tabs, useRouter, useSegments } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CallOverlay, ChatSheet } from "../../components/comms";
import {
	AddBranchSheet,
	AddProductSheet,
	AddServiceSheet,
	AddStaffSheet,
	BookingDetailSheet,
	BranchHoursSheet,
	CouponDetailSheet,
	CreateCouponSheet,
	EditBranchSheet,
	EditBusinessSheet,
	EditProfileSheet,
	OrderDetailSheet,
	RecordPaymentSheet,
	StaffAvailabilitySheet,
} from "../../components/sheets";
import { Icon, type IconName, Toast } from "../../components/ui";
import { useApp } from "../../context";
import { useLayout } from "../../hooks/useLayout";
import { ownerCatalogExperience } from "../../lib/ownerExperiences";
import { Colors } from "../../tokens";

type TabDef = { name: string; label: string; icon: IconName };

/**
 * The third "catalog" tab is vertical-aware (ADR-0004): its route name stays
 * `services` for both verticals, but the label + icon come from the registry —
 * Services for booking, Products for commerce.
 */
function buildTabs(vertical: BusinessVertical): TabDef[] {
	const catalog = ownerCatalogExperience[vertical].tab;
	return [
		{ name: "index", label: "Today", icon: "LayoutDashboard" },
		{ name: "bookings", label: "Bookings", icon: "CalendarCheck" },
		{ name: "services", label: catalog.label, icon: catalog.icon },
		{ name: "reviews", label: "Reviews", icon: "MessageSquareQuote" },
		{ name: "more", label: "More", icon: "Menu" },
	];
}

const SIDEBAR_W = 220;

function TabItem({
	tab,
	on,
	badge,
	onPress,
	sidebar,
}: {
	tab: TabDef;
	on: boolean;
	badge?: number;
	onPress: () => void;
	sidebar?: boolean;
}) {
	if (sidebar) {
		return (
			<TouchableOpacity
				onPress={onPress}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 12,
					marginHorizontal: 10,
					paddingHorizontal: 14,
					paddingVertical: 12,
					borderRadius: 12,
					backgroundColor: on ? Colors.primary50 : "transparent",
				}}
				activeOpacity={0.7}
			>
				<Icon
					name={tab.icon as IconName}
					size={21}
					strokeWidth={on ? 2 : 1.75}
					color={on ? Colors.primary600 : Colors.ink400}
				/>
				<Text
					style={{
						flex: 1,
						fontSize: 15,
						fontWeight: on ? "600" : "400",
						color: on ? Colors.primary700 : Colors.ink600,
					}}
				>
					{tab.label}
				</Text>
				{!!badge && badge > 0 && (
					<View
						style={{
							minWidth: 18,
							height: 18,
							paddingHorizontal: 4,
							borderRadius: 9,
							backgroundColor: Colors.pending,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
							{badge}
						</Text>
					</View>
				)}
			</TouchableOpacity>
		);
	}

	return (
		<TouchableOpacity
			onPress={onPress}
			style={{
				position: "relative",
				alignItems: "center",
				gap: 4,
				paddingVertical: 4,
				paddingHorizontal: 8,
				minWidth: 56,
			}}
		>
			<View style={{ position: "relative" }}>
				<Icon
					name={tab.icon as IconName}
					size={23}
					strokeWidth={on ? 2 : 1.75}
					color={on ? Colors.primary600 : Colors.ink400}
				/>
				{!!badge && badge > 0 && (
					<View
						style={{
							position: "absolute",
							top: -4,
							right: -8,
							minWidth: 16,
							height: 16,
							paddingHorizontal: 4,
							borderRadius: 8,
							backgroundColor: Colors.pending,
							alignItems: "center",
							justifyContent: "center",
							borderWidth: 1.5,
							borderColor: Colors.paper,
						}}
					>
						<Text style={{ fontSize: 10.5, fontWeight: "700", color: "#fff" }}>
							{badge}
						</Text>
					</View>
				)}
			</View>
			<Text
				style={{
					fontSize: 11,
					fontWeight: on ? "700" : "500",
					color: on ? Colors.primary700 : Colors.ink400,
				}}
			>
				{tab.label}
			</Text>
		</TouchableOpacity>
	);
}

function Sidebar({
	pendingCount,
	pendingReviews,
}: {
	pendingCount: number;
	pendingReviews: number;
}) {
	const router = useRouter();
	const segments = useSegments();
	const insets = useSafeAreaInsets();
	const { business } = useApp();
	const tabs = buildTabs(business.vertical);
	const badges: Record<string, number> = {
		bookings: pendingCount,
		reviews: pendingReviews,
	};
	const activeTab =
		(segments as string[])[0] === "(tabs)"
			? (segments as string[])[1] || "index"
			: "";

	return (
		<View
			style={{
				width: SIDEBAR_W,
				paddingTop: insets.top + 12,
				paddingBottom: insets.bottom + 12,
				backgroundColor: Colors.paper,
				borderRightWidth: 1,
				borderRightColor: Colors.line,
			}}
		>
			<Text
				style={{
					fontSize: 20,
					fontWeight: "700",
					color: Colors.primary700,
					paddingHorizontal: 24,
					marginBottom: 20,
				}}
			>
				Talash Business
			</Text>
			{tabs.map((t) => (
				<TabItem
					key={t.name}
					tab={t}
					on={activeTab === t.name}
					badge={badges[t.name]}
					onPress={() =>
						router.navigate(
							t.name === "index" ? "/(tabs)" : (`/(tabs)/${t.name}` as never),
						)
					}
					sidebar
				/>
			))}
		</View>
	);
}

function TabBar({
	state,
	navigation,
}: {
	state: { index: number; routes: { name: string }[] };
	navigation: { navigate: (name: string) => void };
}) {
	const insets = useSafeAreaInsets();
	const { isTablet, isLandscape } = useLayout();
	const { pendingCount, pendingReviews, business } = useApp();
	const tabs = buildTabs(business.vertical);
	const badges: Record<string, number> = {
		bookings: pendingCount,
		reviews: pendingReviews,
	};

	if (isTablet) return null;

	return (
		<View
			style={{
				flexDirection: "row",
				justifyContent: "space-around",
				alignItems: "center",
				paddingTop: isLandscape ? 4 : 8,
				paddingBottom: isLandscape ? insets.bottom + 2 : insets.bottom + 8,
				backgroundColor: Colors.paper,
				borderTopWidth: 1,
				borderTopColor: Colors.line,
			}}
		>
			{tabs.map((t, index) => (
				<TabItem
					key={t.name}
					tab={t}
					on={state.index === index}
					badge={badges[t.name]}
					onPress={() => navigation.navigate(t.name)}
				/>
			))}
		</View>
	);
}

function SheetLayer() {
	const { sheet } = useApp();
	if (!sheet) return null;
	switch (sheet.type) {
		case "booking":
			return <BookingDetailSheet b={sheet.b} />;
		case "addService":
			return <AddServiceSheet initial={sheet.service} />;
		case "addProduct":
			return <AddProductSheet initial={sheet.product} />;
		case "addStaff":
			return <AddStaffSheet initial={sheet.member} />;
		case "addBranch":
			return <AddBranchSheet />;
		case "editBranch":
			return (
				<EditBranchSheet
					branchId={sheet.branchId}
					name={sheet.name}
					address={sheet.address}
					city={sheet.city}
				/>
			);
		case "branchHours":
			return (
				<BranchHoursSheet
					branchId={sheet.branchId}
					branchName={sheet.branchName}
				/>
			);
		case "editBusiness":
			return <EditBusinessSheet />;
		case "createCoupon":
			return <CreateCouponSheet />;
		case "couponDetail":
			return <CouponDetailSheet coupon={sheet.coupon} />;
		case "editProfile":
			return (
				<EditProfileSheet
					userId={sheet.userId}
					name={sheet.name}
					email={sheet.email}
				/>
			);
		case "staffAvailability":
			return (
				<StaffAvailabilitySheet
					teamMemberId={sheet.teamMemberId}
					memberName={sheet.memberName}
				/>
			);
		case "orderDetail":
			return <OrderDetailSheet orderId={sheet.orderId} />;
		case "recordPayment":
			return (
				<RecordPaymentSheet
					businessId={sheet.businessId}
					userId={sheet.userId}
					customerName={sheet.customerName}
					due={sheet.due}
				/>
			);
		default:
			return null;
	}
}

export default function TabsLayout() {
	const { isTablet } = useLayout();
	const { toast, pendingCount, pendingReviews } = useApp();

	return (
		<View className="flex-1">
			<View style={{ flex: 1, flexDirection: isTablet ? "row" : "column" }}>
				{isTablet && (
					<Sidebar
						pendingCount={pendingCount}
						pendingReviews={pendingReviews}
					/>
				)}
				<View className="flex-1">
					<Tabs
						tabBar={(props) => <TabBar {...props} />}
						screenOptions={{ headerShown: false }}
					>
						<Tabs.Screen name="index" />
						<Tabs.Screen name="bookings" />
						<Tabs.Screen name="services" />
						<Tabs.Screen name="reviews" />
						<Tabs.Screen name="more" />
					</Tabs>
				</View>
			</View>
			<SheetLayer />
			<ChatSheet />
			<CallOverlay />
			<Toast toast={toast} />
		</View>
	);
}
