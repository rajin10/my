import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const cardVariants = cva(
	"bg-surface border border-line rounded-lg shadow-sm",
	{
		variants: {
			padding: {
				none: "p-0",
				sm: "p-[18px]",
				md: "p-[22px]",
				lg: "p-8",
			},
		},
		defaultVariants: {
			padding: "md",
		},
	},
);

export interface CardProps extends VariantProps<typeof cardVariants> {
	children: ReactNode;
	className?: string;
}

export function Card({ children, padding, className }: CardProps) {
	return (
		<div className={cn(cardVariants({ padding }), className)}>{children}</div>
	);
}
