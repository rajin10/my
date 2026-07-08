import { Icon, type IconName } from "@repo/ui-native";
import { cva, type VariantProps } from "class-variance-authority";
import { Text, View } from "react-native";
import { cn } from "../../lib/cn";
import { Colors, Shadow } from "../../tokens";

const statCardVariants = cva("bg-surface border border-line", {
	variants: {
		size: {
			sm: "rounded-md",
			md: "rounded-lg",
		},
	},
	defaultVariants: { size: "md" },
});

export type StatCardProps = VariantProps<typeof statCardVariants> & {
	label: string;
	value: string | number;
	sub?: string;
	icon: IconName;
	/** Accent color for the icon and large value. Defaults to primary-600. */
	accent?: string;
	className?: string;
};

export function StatCard({
	label,
	value,
	sub,
	icon,
	accent,
	size = "md",
	className,
}: StatCardProps) {
	const pad = size === "sm" ? 12 : 15;
	return (
		<View
			className={cn(statCardVariants({ size }), className)}
			style={{ padding: pad, ...Shadow.sm }}
		>
			<View className="flex-row items-center justify-between">
				<Text className="text-ink-500 font-semibold" style={{ fontSize: 12.5 }}>
					{label}
				</Text>
				<Icon name={icon} sizePx={17} color={accent ?? Colors.primary600} />
			</View>
			<Text
				className="text-ink-900 font-light"
				style={{ marginTop: 8, fontSize: 30, letterSpacing: -0.5 }}
			>
				{value}
			</Text>
			{sub && (
				<Text className="text-ink-400" style={{ marginTop: 5, fontSize: 12.5 }}>
					{sub}
				</Text>
			)}
		</View>
	);
}
