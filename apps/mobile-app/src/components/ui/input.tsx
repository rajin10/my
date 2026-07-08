import { Icon, type IconName } from "@repo/ui-native";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import {
	Text,
	TextInput,
	type TextInputProps,
	type TextStyle,
	View,
	type ViewStyle,
} from "react-native";
import { cn } from "../../lib/cn";
import { Colors } from "../../tokens";

const inputVariants = cva(
	"flex-row items-center bg-surface border rounded-md",
	{
		variants: {
			variant: {
				default: "border-line-strong",
				error: "border-danger",
				focused: "border-primary-600",
				disabled: "border-line bg-line-soft opacity-60",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

export type InputVariant = "default" | "error" | "focused" | "disabled";

export type InputProps = VariantProps<typeof inputVariants> &
	Omit<TextInputProps, "style"> & {
		/** Label shown above the input. */
		label?: string;
		/** Helper or error text shown below the input. */
		hint?: string;
		/** Leading icon inside the input. */
		icon?: IconName;
		/** Trailing element (e.g. a clear button). */
		trailing?: React.ReactNode;
		containerStyle?: ViewStyle;
		style?: TextStyle;
		className?: string;
	};

export function Input({
	label,
	hint,
	icon,
	trailing,
	variant = "default",
	containerStyle,
	style,
	className,
	editable = true,
	...rest
}: InputProps) {
	const resolved: InputVariant = !editable
		? "disabled"
		: (variant ?? "default");
	const isError = resolved === "error";

	return (
		<View style={containerStyle}>
			{label && (
				<Text
					className="text-ink-700 font-semibold"
					style={{ fontSize: 13, marginBottom: 6 }}
				>
					{label}
				</Text>
			)}
			<View className={cn(inputVariants({ variant: resolved }), className)}>
				{icon && (
					<View className="pl-3.5">
						<Icon
							name={icon}
							sizePx={17}
							color={isError ? Colors.dangerFg : Colors.ink500}
						/>
					</View>
				)}
				<TextInput
					editable={editable}
					placeholderTextColor={Colors.ink400}
					style={[
						{
							flex: 1,
							fontSize: 15.5,
							color: Colors.ink900,
							paddingVertical: 13,
							paddingHorizontal: icon ? 10 : 14,
						},
						style,
					]}
					{...rest}
				/>
				{trailing && <View className="pr-3">{trailing}</View>}
			</View>
			{hint && (
				<Text
					className={cn("mt-1.5", isError ? "text-danger-fg" : "text-ink-400")}
					style={{ fontSize: 12.5 }}
				>
					{hint}
				</Text>
			)}
		</View>
	);
}
