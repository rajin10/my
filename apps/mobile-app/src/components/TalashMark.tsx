import Svg, { Circle, Path } from "react-native-svg";

export function TalashMark({ size = 28 }: { size?: number }) {
	const s = size / 48;
	return (
		<Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
			<Circle cx="21" cy="20" r="13" stroke="#0E7C66" strokeWidth={3.4 * s} />
			<Path
				d="M30.5 29.5 L40 39"
				stroke="#0B5C4B"
				strokeWidth={3.8 * s}
				strokeLinecap="round"
			/>
			<Path d="M26.8 14.3 L22.6 21.4 L15.2 25.7 L19.4 18.6 Z" fill="#C9A063" />
			<Path d="M22.6 21.4 L26.8 14.3 L19.4 18.6 Z" fill="#0E7C66" />
			<Circle cx="21" cy="20" r={1.7 * s} fill="#FBFAF6" />
		</Svg>
	);
}
