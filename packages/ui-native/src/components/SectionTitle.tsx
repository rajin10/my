import type React from "react";
import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { cn } from "../cn";

// Canonical superset (#63): absorbs owner-app's optional `count` pill. Purely
// declarative — no branching logic to unit-test, verified by typecheck + build.
// Note: the customer app's previous 24px title unifies to this 20px canonical
// heading; #64 adoption verifies visual parity on both apps.

export type SectionTitleProps = {
	children: React.ReactNode;
	/** Optional count pill shown next to the title (owner-app feature). */
	count?: number;
	action?: string;
	onAction?: () => void;
	style?: ViewStyle;
	className?: string;
};

export function SectionTitle({
	children,
	count,
	action,
	onAction,
	style,
	className,
}: SectionTitleProps) {
	return (
		<View
			className={cn(
				"flex-row items-baseline justify-between gap-2.5 px-4",
				className,
			)}
			style={style}
		>
			<View className="flex-row items-center gap-2">
				<Text
					className="text-ink-900 font-medium"
					style={{ fontSize: 20, letterSpacing: -0.2 }}
				>
					{children}
				</Text>
				{count != null && (
					<View className="rounded-full px-2 py-0.5 bg-pending-bg">
						<Text
							className="text-pending-fg font-bold"
							style={{ fontSize: 12.5 }}
						>
							{count}
						</Text>
					</View>
				)}
			</View>
			{action && (
				<TouchableOpacity onPress={onAction}>
					{/* Themeable emphasis role (#97) — repaints per tenant; `strong` is
					    darker than the old `primary-600`, so it stays AA on `bg-paper`. */}
					<Text
						className="text-primary-strong font-semibold"
						style={{ fontSize: 14 }}
					>
						{action}
					</Text>
				</TouchableOpacity>
			)}
		</View>
	);
}
