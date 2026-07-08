import { Colors } from "@repo/tokens";
import type React from "react";
import { Text, View } from "react-native";
import { cn } from "../cn";
import {
	BADGE_ICON_COLOR,
	BADGE_ICONS,
	BADGE_TEXT_CLASS,
	type BadgeSize,
	type BadgeVariant,
	type BookingStatus,
	badgeVariants,
	STATUS_VARIANT,
	statusLabel,
} from "./Badge.styles";
import { Icon, type IconName } from "./Icon";

export type { BadgeSize, BadgeVariant, BookingStatus };

export type BadgeProps = {
	children: React.ReactNode;
	variant?: BadgeVariant;
	size?: BadgeSize;
	/** Show the semantic icon for the variant automatically. */
	showIcon?: boolean;
	/** Custom icon override. */
	icon?: IconName;
	className?: string;
};

export function Badge({
	children,
	variant = "default",
	size = "md",
	showIcon,
	icon,
	className,
}: BadgeProps) {
	const sm = size === "sm";
	// Text colour is a className (the `brand` badge repaints per tenant, #97); the
	// icon colour is a static hex (lucide can't read a themed var on RN).
	const textClass = BADGE_TEXT_CLASS[variant] ?? "text-ink-500";
	const iconColor = BADGE_ICON_COLOR[variant] ?? Colors.ink500;
	const iconName =
		icon ??
		(showIcon ? (BADGE_ICONS[variant] as IconName | undefined) : undefined);

	return (
		<View
			className={cn(badgeVariants({ variant, size }), className)}
			style={{ paddingVertical: sm ? 3 : 5, paddingHorizontal: sm ? 9 : 12 }}
		>
			{iconName && <Icon name={iconName} sizePx={sm ? 12 : 14} color={iconColor} />}
			<Text className={textClass} style={{ fontSize: sm ? 12 : 13, fontWeight: "600" }}>
				{children}
			</Text>
		</View>
	);
}

export type StatusPillProps = {
	status: BookingStatus;
	size?: BadgeSize;
};

export function StatusPill({ status, size = "md" }: StatusPillProps) {
	return (
		<Badge variant={STATUS_VARIANT[status]} size={size} showIcon>
			{statusLabel(status)}
		</Badge>
	);
}
