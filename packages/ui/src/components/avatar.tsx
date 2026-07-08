export function Avatar({
	name,
	size = 36,
	tone = "var(--color-primary-100)",
	fg = "var(--color-primary-700)",
}: {
	name: string;
	size?: number;
	tone?: string;
	fg?: string;
}) {
	const initials = (name || "?")
		.split(" ")
		.map((p) => p[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<div
			style={{
				width: size,
				height: size,
				background: tone,
				color: fg,
				fontSize: size * 0.38,
			}}
			className="rounded-full flex items-center justify-center font-sans font-bold shrink-0"
		>
			{initials}
		</div>
	);
}
