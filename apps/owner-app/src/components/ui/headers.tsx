import { Icon, type IconName } from "@repo/ui-native";
import { Text, TouchableOpacity, View } from "react-native";
import { Colors, Shadow } from "../../tokens";

type ActionProps = {
	action?: string;
	onAction?: () => void;
	actionIcon?: IconName;
};

function ActionButton({ action, onAction, actionIcon }: ActionProps) {
	if (!action) return null;
	return (
		<TouchableOpacity
			onPress={onAction}
			className="flex-row items-center gap-1.5 rounded-full"
			style={[
				{
					backgroundColor: Colors.primary600,
					paddingVertical: 9,
					paddingHorizontal: actionIcon ? 12 : 16,
					paddingLeft: actionIcon ? 10 : 16,
				},
				Shadow.xs,
			]}
		>
			{actionIcon && <Icon name={actionIcon} sizePx={16} color="#fff" />}
			<Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
				{action}
			</Text>
		</TouchableOpacity>
	);
}

export type BackHeaderProps = ActionProps & {
	title: string;
	onBack?: () => void;
	topInset?: number;
};

export function BackHeader({
	title,
	onBack,
	action,
	onAction,
	actionIcon,
	topInset = 0,
}: BackHeaderProps) {
	return (
		<View
			className="flex-row items-center gap-2.5 px-3 bg-paper"
			style={{ paddingTop: topInset + 12, paddingBottom: 12 }}
		>
			{onBack && (
				<TouchableOpacity
					onPress={onBack}
					className="w-10 h-10 rounded-full border border-line bg-surface items-center justify-center shrink-0"
					style={Shadow.xs}
				>
					<Icon name="ChevronLeft" sizePx={21} color={Colors.ink800} />
				</TouchableOpacity>
			)}
			<Text
				className="flex-1 font-semibold text-lg text-ink-900"
				numberOfLines={1}
			>
				{title}
			</Text>
			<ActionButton
				action={action}
				onAction={onAction}
				actionIcon={actionIcon}
			/>
		</View>
	);
}

export type TabHeaderProps = ActionProps & {
	title: string;
	topInset?: number;
};

export function TabHeader({
	title,
	action,
	onAction,
	actionIcon,
	topInset = 0,
}: TabHeaderProps) {
	return (
		<View
			className="flex-row items-center justify-between gap-2.5 px-4 bg-paper"
			style={{ paddingTop: topInset + 12, paddingBottom: 4 }}
		>
			<Text
				className="text-ink-900"
				style={{ fontSize: 32, fontWeight: "400", letterSpacing: -0.5 }}
			>
				{title}
			</Text>
			<ActionButton
				action={action}
				onAction={onAction}
				actionIcon={actionIcon}
			/>
		</View>
	);
}
