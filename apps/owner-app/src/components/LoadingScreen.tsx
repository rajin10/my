import { useEffect, useRef } from "react";
import { Animated, type DimensionValue, View } from "react-native";
import { Colors, Radius } from "../tokens";

function Shimmer({
	width,
	height,
	radius = Radius.md,
}: {
	width: number | string;
	height: number;
	radius?: number;
}) {
	const anim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.loop(
			Animated.sequence([
				Animated.timing(anim, {
					toValue: 1,
					duration: 900,
					useNativeDriver: true,
				}),
				Animated.timing(anim, {
					toValue: 0,
					duration: 900,
					useNativeDriver: true,
				}),
			]),
		).start();
	}, [anim]);

	const opacity = anim.interpolate({
		inputRange: [0, 1],
		outputRange: [0.4, 1],
	});

	return (
		<Animated.View
			style={{
				width: width as DimensionValue,
				height,
				borderRadius: radius,
				backgroundColor: Colors.lineSoft,
				opacity,
			}}
		/>
	);
}

export function BookingCardSkeleton() {
	return (
		<View
			className="bg-surface border border-line rounded-lg"
			style={{ padding: 15, gap: 12 }}
		>
			<View className="flex-row items-center" style={{ gap: 12 }}>
				<Shimmer width={42} height={42} radius={21} />
				<View className="flex-1" style={{ gap: 8 }}>
					<Shimmer width="70%" height={14} />
					<Shimmer width="40%" height={12} />
				</View>
				<Shimmer width={60} height={16} radius={8} />
			</View>
			<View style={{ gap: 6 }}>
				<Shimmer width="90%" height={12} />
				<Shimmer width="55%" height={12} />
			</View>
		</View>
	);
}

export function StatCardSkeleton() {
	return (
		<View
			className="flex-1 bg-surface border border-line rounded-lg"
			style={{ padding: 14, gap: 8, minHeight: 90 }}
		>
			<Shimmer width={24} height={24} radius={6} />
			<Shimmer width="50%" height={22} />
			<Shimmer width="70%" height={12} />
		</View>
	);
}

export function ReviewCardSkeleton() {
	return (
		<View
			className="bg-surface border border-line rounded-lg"
			style={{ padding: 16, gap: 12 }}
		>
			<View className="flex-row items-center" style={{ gap: 11 }}>
				<Shimmer width={40} height={40} radius={20} />
				<View className="flex-1" style={{ gap: 6 }}>
					<Shimmer width="50%" height={14} />
					<Shimmer width="35%" height={12} />
				</View>
			</View>
			<Shimmer width="100%" height={12} />
			<Shimmer width="80%" height={12} />
		</View>
	);
}

export function TodayScreenSkeleton() {
	return (
		<View className="flex-1 bg-paper" style={{ padding: 16, gap: 16 }}>
			{/* Stats grid */}
			<View className="flex-row flex-wrap" style={{ gap: 11 }}>
				{[0, 1, 2, 3].map((i) => (
					<View key={i} style={{ width: "48%" }}>
						<StatCardSkeleton />
					</View>
				))}
			</View>
			<Shimmer width={160} height={18} />
			{[0, 1, 2].map((i) => (
				<BookingCardSkeleton key={i} />
			))}
		</View>
	);
}
