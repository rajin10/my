import { Button, Icon, type IconName } from "@repo/ui-native";
import { cva, type VariantProps } from "class-variance-authority";
import { Text, View, type ViewStyle } from "react-native";
import { cn } from "../../lib/cn";
import { Colors } from "../../tokens";

const emptyVariants = cva("items-center", {
	variants: {
		size: {
			sm: "px-6 py-8",
			md: "px-9 py-12",
			lg: "px-12 py-20",
		},
	},
	defaultVariants: { size: "md" },
});

const ICON_PX: Record<string, number> = { sm: 22, md: 28, lg: 36 };
const TITLE_PX: Record<string, number> = { sm: 17, md: 20, lg: 24 };

export type EmptyProps = VariantProps<typeof emptyVariants> & {
	icon: IconName;
	title: string;
	body: string;
	cta?: string;
	onCta?: () => void;
	style?: ViewStyle;
	className?: string;
};

export function Empty({
	icon,
	title,
	body,
	cta,
	onCta,
	size = "md",
	style,
	className,
}: EmptyProps) {
	const s = size ?? "md";
	return (
		<View className={cn(emptyVariants({ size }), className)} style={style}>
			<View className="w-16 h-16 rounded-full items-center justify-center bg-primary-50">
				<Icon name={icon} sizePx={ICON_PX[s]} color={Colors.primary600} />
			</View>
			<Text
				className="text-ink-900 text-center font-medium"
				style={{ marginTop: 18, fontSize: TITLE_PX[s] }}
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
