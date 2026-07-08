import * as Icons from "lucide-react-native";
import { useRef, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import type { Business } from "../../data";
import { formatMoney, formatShortMoney } from "../../lib/format";
import { Colors, Shadow } from "../../tokens";
import { Stars } from "../ui";

const MAP_H = 320;

type GeoBounds = {
	minLat: number;
	maxLat: number;
	minLng: number;
	maxLng: number;
};

function computeBounds(businesses: Business[]): GeoBounds | undefined {
	const coords = businesses.filter(
		(v) => v.mapLat != null && v.mapLng != null,
	) as (Business & { mapLat: number; mapLng: number })[];
	if (coords.length === 0) return undefined;

	let minLat = coords[0].mapLat;
	let maxLat = coords[0].mapLat;
	let minLng = coords[0].mapLng;
	let maxLng = coords[0].mapLng;
	for (const v of coords) {
		minLat = Math.min(minLat, v.mapLat);
		maxLat = Math.max(maxLat, v.mapLat);
		minLng = Math.min(minLng, v.mapLng);
		maxLng = Math.max(maxLng, v.mapLng);
	}
	return { minLat, maxLat, minLng, maxLng };
}

/** Fallback when branch coordinates are not available yet */
function hashPinPosition(id: string): { x: number; y: number } {
	let h = 0;
	for (let i = 0; i < id.length; i++)
		h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
	const u = (Math.abs(h) % 10000) / 10000;
	const u2 = (Math.abs(h * 2654435761) % 10000) / 10000;
	return { x: 0.15 + u * 0.7, y: 0.15 + u2 * 0.7 };
}

function pinPosition(
	business: Business,
	bounds?: GeoBounds,
): { x: number; y: number } {
	if (bounds && business.mapLat != null && business.mapLng != null) {
		const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.01);
		const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.01);
		const x = (business.mapLng - bounds.minLng) / lngSpan;
		const y = 1 - (business.mapLat - bounds.minLat) / latSpan;
		return { x: 0.1 + x * 0.8, y: 0.1 + y * 0.8 };
	}
	return hashPinPosition(business.id);
}

function MapPin({
	business,
	selected,
	onPress,
	containerW,
	bounds,
}: {
	business: Business;
	selected: boolean;
	onPress: () => void;
	containerW: number;
	bounds?: GeoBounds;
}) {
	const pos = pinPosition(business, bounds);
	return (
		<TouchableOpacity
			onPress={onPress}
			style={{
				position: "absolute",
				left: pos.x * containerW - (selected ? 22 : 16),
				top: pos.y * MAP_H - (selected ? 22 : 16),
				zIndex: selected ? 10 : 1,
				alignItems: "center",
			}}
			hitSlop={8}
		>
			{business.from > 0 ? (
				<View
					className="rounded-full border"
					style={{
						backgroundColor: selected ? Colors.primary700 : Colors.surface,
						paddingHorizontal: selected ? 10 : 8,
						paddingVertical: selected ? 5 : 4,
						borderColor: selected ? Colors.primary700 : Colors.line,
						...Shadow.sm,
					}}
				>
					<Text
						style={{
							fontSize: selected ? 13 : 11.5,
							fontWeight: "700",
							color: selected ? "#fff" : Colors.ink800,
						}}
					>
						{formatShortMoney(business.from)}
					</Text>
				</View>
			) : (
				<View
					className="border-2"
					style={{
						width: selected ? 16 : 12,
						height: selected ? 16 : 12,
						borderRadius: selected ? 8 : 6,
						backgroundColor: selected ? Colors.primary700 : Colors.primary500,
						borderColor: Colors.surface,
						...Shadow.xs,
					}}
				/>
			)}
		</TouchableOpacity>
	);
}

function MapCanvas({
	businesses,
	selectedId,
	onPinPress,
}: {
	businesses: Business[];
	selectedId: string | null;
	onPinPress: (id: string) => void;
}) {
	const [containerW, setContainerW] = useState(300);
	const bounds = computeBounds(businesses);
	const usesGeo = bounds != null;

	return (
		<View
			style={{
				width: "100%",
				height: MAP_H,
				backgroundColor: "#f0f4f0",
				overflow: "hidden",
			}}
			onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
		>
			{/* Abstract road/area grid */}
			<View
				style={{
					position: "absolute",
					top: MAP_H * 0.35,
					left: 0,
					right: 0,
					height: 18,
					backgroundColor: "#e8ede9",
				}}
			/>
			<View
				style={{
					position: "absolute",
					top: MAP_H * 0.6,
					left: 0,
					right: 0,
					height: 12,
					backgroundColor: "#e8ede9",
				}}
			/>
			<View
				style={{
					position: "absolute",
					left: containerW * 0.25,
					top: 0,
					bottom: 0,
					width: 14,
					backgroundColor: "#e8ede9",
				}}
			/>
			<View
				style={{
					position: "absolute",
					left: containerW * 0.65,
					top: 0,
					bottom: 0,
					width: 10,
					backgroundColor: "#e8ede9",
				}}
			/>
			{/* Park/green area */}
			<View
				style={{
					position: "absolute",
					top: MAP_H * 0.05,
					left: containerW * 0.1,
					width: 80,
					height: 60,
					borderRadius: 16,
					backgroundColor: "#dfecd9",
				}}
			/>
			<View
				style={{
					position: "absolute",
					top: MAP_H * 0.65,
					left: containerW * 0.68,
					width: 60,
					height: 44,
					borderRadius: 12,
					backgroundColor: "#dfecd9",
				}}
			/>
			{/* Water */}
			<View
				style={{
					position: "absolute",
					top: MAP_H * 0.14,
					right: 0,
					width: 50,
					height: 90,
					borderRadius: 16,
					backgroundColor: "#d4e8f0",
				}}
			/>
			{/* You are here */}
			<View
				style={{
					position: "absolute",
					left: containerW * 0.5 - 10,
					top: MAP_H * 0.5 - 10,
				}}
			>
				<View
					style={{
						width: 20,
						height: 20,
						borderRadius: 10,
						backgroundColor: Colors.primary600,
						borderWidth: 3,
						borderColor: "#fff",
						...Shadow.sm,
					}}
				/>
				<View
					style={{
						position: "absolute",
						top: -20,
						left: -20,
						width: 60,
						height: 60,
						borderRadius: 30,
						backgroundColor: Colors.primary600,
						opacity: 0.1,
					}}
				/>
			</View>
			{/* Pins */}
			{usesGeo && (
				<Text
					style={{
						position: "absolute",
						top: 10,
						left: 12,
						fontSize: 11,
						fontWeight: "600",
						color: Colors.ink500,
						backgroundColor: "rgba(255,255,255,0.85)",
						paddingHorizontal: 8,
						paddingVertical: 4,
						borderRadius: 6,
					}}
				>
					Showing business locations
				</Text>
			)}
			{businesses.map((v) => (
				<MapPin
					key={v.id}
					business={v}
					selected={v.id === selectedId}
					onPress={() => onPinPress(v.id)}
					containerW={containerW}
					bounds={bounds}
				/>
			))}
		</View>
	);
}

function BusinessMapCard({
	business,
	onPress,
}: {
	business: Business;
	onPress: () => void;
}) {
	return (
		<TouchableOpacity
			onPress={onPress}
			className="overflow-hidden rounded-lg border"
			style={{
				width: 240,
				backgroundColor: Colors.surface,
				borderColor: Colors.line,
				...Shadow.sm,
			}}
			activeOpacity={0.88}
		>
			<View style={{ height: 100, backgroundColor: business.tone[1] }}>
				<View
					style={{
						position: "absolute",
						inset: 0,
						backgroundColor: business.tone[0],
						opacity: 0.6,
					}}
				/>
				<View className="absolute inset-0 items-center justify-center">
					<Icons.Image
						size={20}
						color="rgba(255,255,255,0.35)"
						strokeWidth={1.5}
					/>
				</View>
			</View>
			<View className="p-3">
				<Text
					className="font-semibold"
					numberOfLines={1}
					style={{ fontSize: 15, color: Colors.ink900 }}
				>
					{business.name}
				</Text>
				<View className="flex-row items-center gap-1 mt-1">
					<Stars value={business.rating} sizePx={11} />
					<Text style={{ fontSize: 12, color: Colors.ink500 }}>
						{business.rating > 0 ? business.rating.toFixed(1) : "—"}
					</Text>
					<Text style={{ color: Colors.ink300 }}>·</Text>
					<Text style={{ fontSize: 12, color: Colors.ink500 }}>
						{business.city.split(",")[0]}
					</Text>
				</View>
				{business.from > 0 && (
					<Text
						className="font-bold mt-1.5"
						style={{ fontSize: 13, color: Colors.primary700 }}
					>
						From {formatMoney(business.from)}
					</Text>
				)}
			</View>
		</TouchableOpacity>
	);
}

interface MapScreenProps {
	businesses: Business[];
	onBusinessPress: (business: Business) => void;
	loadingCoords?: boolean;
}

export default function MapScreen({
	businesses,
	onBusinessPress,
	loadingCoords,
}: MapScreenProps) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const stripRef = useRef<ScrollView>(null);

	function handlePinPress(id: string) {
		setSelectedId(id);
		const idx = businesses.findIndex((v) => v.id === id);
		if (idx >= 0 && stripRef.current) {
			stripRef.current.scrollTo({ x: idx * 256, animated: true });
		}
	}

	return (
		<View className="flex-1" style={{ backgroundColor: Colors.paper }}>
			<MapCanvas
				businesses={businesses}
				selectedId={selectedId}
				onPinPress={handlePinPress}
			/>

			{/* Business count */}
			<View className="px-4 py-2.5">
				<Text
					className="font-semibold"
					style={{ fontSize: 13, color: Colors.ink500 }}
				>
					{businesses.length} business{businesses.length !== 1 ? "s" : ""} in this area
					{loadingCoords ? " · loading locations…" : ""}
				</Text>
			</View>

			{/* Card strip */}
			{businesses.length > 0 && (
				<ScrollView
					ref={stripRef}
					horizontal
					showsHorizontalScrollIndicator={false}
					snapToInterval={256}
					decelerationRate="fast"
					contentContainerStyle={{
						paddingHorizontal: 16,
						gap: 12,
						paddingBottom: 16,
					}}
					onMomentumScrollEnd={(e) => {
						const idx = Math.round(e.nativeEvent.contentOffset.x / 256);
						const v = businesses[idx];
						if (v) setSelectedId(v.id);
					}}
				>
					{businesses.map((v) => (
						<BusinessMapCard
							key={v.id}
							business={v}
							onPress={() => onBusinessPress(v)}
						/>
					))}
				</ScrollView>
			)}

			{businesses.length === 0 && (
				<View className="flex-1 items-center justify-center">
					<Icons.MapPinOff size={28} color={Colors.ink300} strokeWidth={1.5} />
					<Text className="mt-3" style={{ fontSize: 15, color: Colors.ink500 }}>
						No businesses in this area
					</Text>
				</View>
			)}
		</View>
	);
}
