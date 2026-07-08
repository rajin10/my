import type { LucideProps } from "lucide-react-native";
import * as Icons from "lucide-react-native";
import { ArrowRight } from "lucide-react-native";
import type { ComponentType } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import type { Notification } from "../../data";
import { Colors, Shadow } from "../../tokens";
import { EmptyState } from "../ui";

const NOTIF_STYLE: Record<
	string,
	{ icon: keyof typeof Icons; bg: string; fg: string }
> = {
	confirmed: {
		icon: "CheckCircle",
		bg: Colors.primary100,
		fg: Colors.primary700,
	},
	reminder: { icon: "Clock", bg: Colors.creamDeep, fg: Colors.ink700 },
	reward: { icon: "Gift", bg: Colors.gold100, fg: Colors.gold700 },
	offer: { icon: "Tag", bg: Colors.gold100, fg: Colors.gold700 },
	review: { icon: "Star", bg: Colors.gold100, fg: Colors.gold700 },
	order: { icon: "Package", bg: Colors.primary100, fg: Colors.primary700 },
	order_cancelled: {
		icon: "PackageX",
		bg: Colors.dangerBg,
		fg: Colors.dangerFg,
	},
	system: { icon: "ShieldCheck", bg: Colors.primary100, fg: Colors.primary700 },
};

function NotifRow({
	n,
	onTap,
}: {
	n: Notification;
	onTap: (n: Notification) => void;
}) {
	const s = NOTIF_STYLE[n.type] || NOTIF_STYLE.system;
	const Ico = (Icons as Record<string, ComponentType<LucideProps>>)[s.icon];

	return (
		<TouchableOpacity
			onPress={() => onTap(n)}
			className="flex-row items-start relative rounded-lg"
			style={[
				{
					gap: 13,
					padding: 14,
					paddingHorizontal: 16,
					backgroundColor: n.unread ? Colors.primary50 : Colors.surface,
				},
				n.unread ? {} : Shadow.xs,
			]}
			activeOpacity={0.8}
		>
			<View
				className="items-center justify-center rounded-sm"
				style={{ width: 42, height: 42, backgroundColor: s.bg }}
			>
				{Ico && <Ico size={20} color={s.fg} strokeWidth={1.8} />}
			</View>
			<View className="flex-1 min-w-0">
				<View className="flex-row items-baseline gap-2">
					<Text
						className="flex-1 text-ink-900 font-bold"
						style={{ fontSize: 15 }}
					>
						{n.title}
					</Text>
					<Text className="text-ink-400 shrink-0" style={{ fontSize: 12 }}>
						{n.when}
					</Text>
				</View>
				<Text
					className="text-ink-500"
					style={{ fontSize: 13.5, lineHeight: 20, marginTop: 3 }}
				>
					{n.body}
				</Text>
				{n.cta && (
					<View
						className="flex-row items-center"
						style={{ gap: 4, marginTop: 9 }}
					>
						<Text
							className="text-primary-600 font-semibold"
							style={{ fontSize: 13.5 }}
						>
							{n.cta}
						</Text>
						{ArrowRight && (
							<ArrowRight size={14} color={Colors.primary600} strokeWidth={2} />
						)}
					</View>
				)}
			</View>
			{n.unread && (
				<View
					className="absolute bg-primary-500"
					style={{ top: 17, right: 14, width: 8, height: 8, borderRadius: 4 }}
				/>
			)}
		</TouchableOpacity>
	);
}

function Group({
	label,
	items,
	onTap,
}: {
	label: string;
	items: Notification[];
	onTap: (n: Notification) => void;
}) {
	if (!items.length) return null;
	return (
		<View className="mb-2">
			<Text
				className="text-ink-400 font-semibold uppercase"
				style={{
					fontSize: 12,
					letterSpacing: 2,
					paddingHorizontal: 18,
					paddingBottom: 10,
				}}
			>
				{label}
			</Text>
			<View style={{ gap: 10, paddingHorizontal: 16 }}>
				{items.map((n) => (
					<NotifRow key={n.id} n={n} onTap={onTap} />
				))}
			</View>
		</View>
	);
}

export default function NotificationsScreen() {
	const { notifications, closeOverlay, tapNotif, readAllNotifs } = useApp();
	const insets = useSafeAreaInsets();

	const unread = notifications.filter((n) => n.unread).length;
	const today = notifications.filter((n) => n.group === "today");
	const earlier = notifications.filter((n) => n.group === "earlier");

	return (
		<View className="flex-1 bg-paper">
			<View
				className="px-4 border-b border-line-soft bg-paper"
				style={{ paddingTop: insets.top + 4, paddingBottom: 12 }}
			>
				<View className="flex-row items-center" style={{ gap: 12 }}>
					<TouchableOpacity
						onPress={closeOverlay}
						className="items-center justify-center rounded-full border border-line bg-surface"
						style={[{ width: 38, height: 38 }, Shadow.xs]}
					>
						<Icons.ChevronLeft
							size={20}
							color={Colors.ink700}
							strokeWidth={2}
						/>
					</TouchableOpacity>
					<Text
						className="flex-1 text-ink-900"
						style={{ fontSize: 27, fontWeight: "400", letterSpacing: -0.4 }}
					>
						Notifications
					</Text>
					{unread > 0 && (
						<TouchableOpacity onPress={readAllNotifs}>
							<Text
								className="text-primary-600 font-semibold"
								style={{ fontSize: 13.5 }}
							>
								Mark all read
							</Text>
						</TouchableOpacity>
					)}
				</View>
				{unread > 0 && (
					<Text
						className="text-ink-500"
						style={{ marginTop: 8, marginLeft: 50, fontSize: 13.5 }}
					>
						{unread} unread
					</Text>
				)}
			</View>

			<ScrollView
				contentContainerStyle={{ paddingTop: 18, paddingBottom: 30 }}
				showsVerticalScrollIndicator={false}
			>
				{notifications.length === 0 ? (
					<EmptyState
						icon="BellOff"
						title="No notifications yet"
						body="In-app notifications are not available yet. Booking reminders still use push when you allow them."
					/>
				) : (
					<>
						<Group label="Today" items={today} onTap={tapNotif} />
						<Group label="Earlier" items={earlier} onTap={tapNotif} />
					</>
				)}
			</ScrollView>
		</View>
	);
}
