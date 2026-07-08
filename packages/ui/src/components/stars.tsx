import { Star } from "lucide-react";

export function Stars({
	value = 5,
	size = 14,
}: {
	value?: number;
	size?: number;
}) {
	const full = Math.round(value);
	return (
		<span className="inline-flex gap-px">
			{[1, 2, 3, 4, 5].map((n) => (
				<Star
					key={n}
					size={size}
					style={{
						fill: n <= full ? "var(--color-gold-500)" : "transparent",
						color:
							n <= full ? "var(--color-gold-500)" : "var(--color-gold-300)",
					}}
				/>
			))}
		</span>
	);
}
