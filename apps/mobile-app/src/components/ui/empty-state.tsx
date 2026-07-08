import { Button, Icon, type IconName } from "@repo/ui-native";
import { cva, type VariantProps } from "class-variance-authority";
import { Text, View, type ViewStyle } from "react-native";
import { cn } from "../../lib/cn";
import { Colors } from "../../tokens";

const emptyStateVariants = cva("items-center", {
	variants: {
		size: {
			sm: "px-6 py-8",
			md: "px-9 py-14",
			lg: "px-12 py-20",
		},
	},
	defaultVariants: { size: "md" },
});

const ICON_CONTAINER: Record<string, string> = {
	sm: "w-12 h-12 rounded-full items-center justify-center bg-primary-50",
	md: "w-16 h-16 rounded-full items-center justify-center bg-primary-50",
	lg: "w-20 h-20 rounded-full items-center justify-center bg-primary-50",
};
const ICON_SIZE: Record<string, number> = { sm: 22, md: 28, lg: 36 };
const TITLE_SIZE: Record<string, number> = { sm: 18, md: 22, lg: 26 };

export type EmptyStateProps = VariantProps<typeof emptyStateVariants> & {
	icon: IconName;
	title: string;
	body: string;
	cta?: string;
	onCta?: () => void;
	style?: ViewStyle;
	className?: string;
};

export function EmptyState({
	icon,
	title,
	body,
	cta,
	onCta,
	size = "md",
	style,
	className,
}: EmptyStateProps) {
	const s = size ?? "md";
	return (
		<View className={cn(emptyStateVariants({ size }), className)} style={style}>
			<View className={ICON_CONTAINER[s]}>
				<Icon name={icon} sizePx={ICON_SIZE[s]} color={Colors.primary500} />
			</View>
			<Text
				className="text-ink-900 text-center font-medium"
				style={{ marginTop: 18, fontSize: TITLE_SIZE[s] }}
			>
				{title}
			</Text>
			<Text
				className="text-ink-500 text-center"
				style={{ marginTop: 8, fontSize: 14.5, lineHeight: 23 }}
			>
				{body}
			</Text>
			{cta && (
				<View className="mt-5">
					<Button onPress={onCta}>{cta}</Button>
				</View>
			)}
		</View>
	);
}
