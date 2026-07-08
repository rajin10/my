import { ImageIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";

interface PhotoProps {
	tone: string;
	height?: number | string;
	radius?: string;
	uri?: string | null;
	style?: CSSProperties;
	className?: string;
	children?: ReactNode;
}

export function Photo({
	tone,
	height,
	radius = "var(--radius-lg)",
	uri,
	style,
	className,
	children,
}: PhotoProps) {
	return (
		<div
			style={{
				height,
				borderRadius: radius,
				background: uri ? tone : tone,
				...style,
			}}
			className={cn(
				"relative overflow-hidden flex items-center justify-center",
				className,
			)}
		>
			{uri ? (
				<img
					src={uri}
					alt=""
					className="absolute inset-0 w-full h-full object-cover"
				/>
			) : (
				<ImageIcon
					size={typeof height === "number" ? Math.min(34, height / 5) : 28}
					className="text-white/30"
				/>
			)}
			{children}
		</div>
	);
}
