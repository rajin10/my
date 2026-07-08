import { Tabs, useRouter, useSegments } from "expo-router";
import type { LucideProps } from "lucide-react-native";
import * as Icons from "lucide-react-native";
import type { ComponentType } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { useLayout } from "../../hooks/useLayout";
import { Colors } from "../../tokens";

const TABS = [
	{ name: "index", label: "Search", icon: "Search" },
	{ name: "bookings", label: "Bookings", icon: "CalendarCheck" },
	{ name: "favourites", label: "Favourites", icon: "Heart" },
	{ name: "rewards", label: "Rewards", icon: "Gift" },
	{ name: "account", label: "Account", icon: "User" },
] as const;

const SIDEBAR_W = 220;

function TabItem({
	tab,
	on,
	badge,
	onPress,
	sidebar,
}: {
	tab: (typeof TABS)[number];
	on: boolean;
	badge?: number;
	onPress: () => void;
	sidebar?: boolean;
}) {
	const iconMap = Icons as Record<string, ComponentType<LucideProps>>;
	const Ico = iconMap[tab.icon];
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
				{Ico && (
					<Ico
						size={21}
						color={on ? Colors.primary600 : Colors.ink400}
						strokeWidth={on ? 2 : 1.75}
						fill={
							on && tab.name === "favourites"
								? Colors.primary600
								: "transparent"
						}
					/>
				)}
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
							backgroundColor: Colors.primary500,
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
				alignItems: "center",
				justifyContent: "center",
				paddingHorizontal: 8,
				paddingVertical: 4,
				minWidth: 56,
			}}
			activeOpacity={0.7}
		>
			<View>
				{Ico && (
					<Ico
						size={23}
						color={on ? Colors.primary600 : Colors.ink400}
						strokeWidth={on ? 2 : 1.75}
						fill={
							on && tab.name === "favourites"
								? Colors.primary600
								: "transparent"
						}
					/>
				)}
				{tab.name === "bookings" && !!badge && badge > 0 && (
					<View
						style={{
							position: "absolute",
							top: -2,
							right: -4,
							width: 7,
							height: 7,
							borderRadius: 4,
							backgroundColor: Colors.primary500,
							borderWidth: 1.5,
							borderColor: Colors.paper,
						}}
					/>
				)}
			</View>
			<Text
				style={{
					fontSize: 11,
					fontWeight: on ? "700" : "500",
					color: on ? Colors.primary700 : Colors.ink400,
					marginTop: 4,
				}}
			>
				{tab.label}
			</Text>
		</TouchableOpacity>
	);
}

function Sidebar({ pendingCount }: { pendingCount: number }) {
	const router = useRouter();
	const segments = useSegments();
	const insets = useSafeAreaInsets();
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
				Talash
			</Text>
			{TABS.map((t) => (
				<TabItem
					key={t.name}
					tab={t}
					on={activeTab === t.name}
					badge={t.name === "bookings" ? pendingCount : 0}
					onPress={() =>
						router.navigate(
							t.name === "index" ? "/(tabs)" : (`/(tabs)${t.name}` as never),
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
	navigation: {
		emit: (e: { type: string; target: string; canPreventDefault: boolean }) => {
			defaultPrevented: boolean;
		};
		navigate: (name: string) => void;
	};
}) {
	const insets = useSafeAreaInsets();
	const { isTablet, isLandscape } = useLayout();
	const { bookings } = useApp();
	const pendingCount = bookings.filter((b) => b.status === "Pending").length;

	if (isTablet) return null;

	return (
		<View
			style={{
				flexDirection: "row",
				justifyContent: "space-around",
				alignItems: "center",
				paddingTop: isLandscape ? 4 : 8,
				paddingBottom: isLandscape ? insets.bottom + 2 : insets.bottom + 4,
				backgroundColor: "rgba(251,250,246,0.92)",
				borderTopWidth: 1,
				borderTopColor: Colors.line,
			}}
		>
			{TABS.map((t, index) => (
				<TabItem
					key={t.name}
					tab={t}
					on={state.index === index}
					badge={t.name === "bookings" ? pendingCount : 0}
					onPress={() => navigation.navigate(t.name)}
				/>
			))}
		</View>
	);
}

export default function TabsLayout() {
	const { isTablet } = useLayout();
	const { bookings } = useApp();
	const pendingCount = bookings.filter((b) => b.status === "Pending").length;

	return (
		<View style={{ flex: 1, flexDirection: isTablet ? "row" : "column" }}>
			{isTablet && <Sidebar pendingCount={pendingCount} />}
			<View className="flex-1">
				<Tabs
					tabBar={(props) => <TabBar {...props} />}
					screenOptions={{ headerShown: false }}
				>
					<Tabs.Screen name="index" />
					<Tabs.Screen name="bookings" />
					<Tabs.Screen name="favourites" />
					<Tabs.Screen name="rewards" />
					<Tabs.Screen name="account" />
				</Tabs>
			</View>
		</View>
	);
}
