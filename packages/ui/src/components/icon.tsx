import * as Icons from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "../lib/cn";

export function Icon({
	name,
	size = 20,
	className,
	style,
}: {
	name: string;
	size?: number;
	className?: string;
	style?: CSSProperties;
}) {
	// biome-ignore lint/suspicious/noExplicitAny: dynamic icon lookup
	const IconComp = (Icons as any)[name] as React.ComponentType<{
		size?: number;
		className?: string;
		style?: CSSProperties;
	}>;
	if (!IconComp) return null;
	return (
		<span
			className={cn(
				"inline-flex items-center justify-center shrink-0",
				className,
			)}
			style={{ width: size, height: size }}
		>
			<IconComp size={size} style={style} />
		</span>
	);
}
