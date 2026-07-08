import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import type { Notification } from "../../data";
import { Colors, Shadow } from "../../tokens";
import { BackHeader, Eyebrow, Icon } from "../ui";

type IconName = "CalendarPlus" | "CalendarX" | "MessageSquareQuote" | "Info";
type ToneKey = "booking" | "cancel" | "review" | "system";

const ICON_FOR: Record<ToneKey, IconName> = {
	booking: "CalendarPlus",
	cancel: "CalendarX",
	review: "MessageSquareQuote",
	system: "Info",
};

const TONE_FOR: Record<ToneKey, string> = {
	booking: Colors.primary600,
	cancel: Colors.danger,
	review: Colors.gold700,
	system: Colors.ink500,
};

const BG_FOR: Record<ToneKey, string> = {
	booking: Colors.primary50,
	cancel: Colors.dangerBg,
	review: Colors.gold100,
	system: Colors.lineSoft,
};

function NotifRow({ n, onTap }: { n: Notification; onTap: () => void }) {
	// Owners don't receive order notifications, but the type now permits "order"
	// and "order_cancelled"; fall back to the neutral "system" tone so an unmapped
	// type can't crash the row.
	const type: ToneKey = n.type in ICON_FOR ? (n.type as ToneKey) : "system";
	return (
		<TouchableOpacity
			onPress={onTap}
			className="flex-row border border-line rounded-lg"
			style={[
				{
					gap: 12,
					padding: 14,
					paddingHorizontal: 15,
					backgroundColor: n.unread ? Colors.surface : "transparent",
				},
				n.unread ? Shadow.sm : {},
			]}
		>
			<View
				className="items-center justify-center shrink-0 rounded-sm"
				style={{ width: 40, height: 40, backgroundColor: BG_FOR[type] }}
			>
				<Icon name={ICON_FOR[type]} size={19} color={TONE_FOR[type]} />
			</View>
			<View className="flex-1 min-w-0">
				<View
					className="flex-row items-baseline justify-between"
					style={{ gap: 8 }}
				>
					<Text
						className="flex-1 text-ink-900 font-bold"
						numberOfLines={1}
						style={{ fontSize: 14.5 }}
					>
						{n.title}
					</Text>
					<Text className="text-ink-400 shrink-0" style={{ fontSize: 12 }}>
						{n.when}
					</Text>
				</View>
				<Text
					className="text-ink-600"
					style={{ fontSize: 13.5, marginTop: 3, lineHeight: 20 }}
				>
					{n.body}
				</Text>
			</View>
			{n.unread && (
				<View
					className="bg-primary-600 shrink-0"
					style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6 }}
				/>
			)}
		</TouchableOpacity>
	);
}

export default function NotificationsScreen() {
	const insets = useSafeAreaInsets();
	const { notifs, setOverlay, tapNotif, readAll } = useApp();

	const groups: Array<{ key: "today" | "earlier"; label: string }> = [
		{ key: "today", label: "Today" },
		{ key: "earlier", label: "Earlier" },
	];

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Notifications"
				onBack={() => setOverlay(null)}
				action="Mark all read"
				onAction={readAll}
				topInset={insets.top}
			/>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
			>
				{!notifs.length && (
					<Text
						className="text-ink-500 text-center"
						style={{ marginTop: 32, fontSize: 14 }}
					>
						No notifications yet. You will see booking and review alerts here.
					</Text>
				)}
				{groups.map((g) => {
					const items = notifs.filter((n) => n.group === g.key);
					if (!items.length) return null;
					return (
						<View key={g.key} className="pt-1.5">
							<Eyebrow
								color={Colors.ink400}
								style={{ marginTop: 10, marginBottom: 10 }}
							>
								{g.label}
							</Eyebrow>
							<View style={{ gap: 10 }}>
								{items.map((n) => (
									<NotifRow key={n.id} n={n} onTap={() => tapNotif(n)} />
								))}
							</View>
						</View>
					);
				})}
			</ScrollView>
		</View>
	);
}
