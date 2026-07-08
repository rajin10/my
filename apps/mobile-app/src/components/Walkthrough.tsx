import * as SecureStore from "expo-secure-store";
import type { LucideProps } from "lucide-react-native";
import * as Icons from "lucide-react-native";
import { type ComponentType, useEffect, useRef, useState } from "react";
import {
	Animated,
	Dimensions,
	FlatList,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radius } from "../tokens";

const SEEN_KEY = "talash_walkthrough_seen";

const STEPS = [
	{
		icon: "Search" as const,
		title: "Discover wellness near you",
		body: "Browse salons, spas, and beauty studios across Bangladesh — filtered by location, rating, and price.",
	},
	{
		icon: "CalendarCheck" as const,
		title: "Book in seconds",
		body: "Pick a service, choose a time slot, and confirm your appointment without a phone call.",
	},
	{
		icon: "Gift" as const,
		title: "Earn Talash Rewards",
		body: "Every booking earns points you can redeem for discounts at your favourite businesses.",
	},
];

const { width: SCREEN_W } = Dimensions.get("window");

function Dot({ active }: { active: boolean }) {
	return (
		<View
			style={{
				width: active ? 20 : 6,
				height: 6,
				borderRadius: 3,
				backgroundColor: active ? Colors.primary600 : Colors.lineStrong,
				marginHorizontal: 3,
			}}
		/>
	);
}

interface WalkthroughProps {
	onDone: () => void;
}

export function Walkthrough({ onDone }: WalkthroughProps) {
	const insets = useSafeAreaInsets();
	const [index, setIndex] = useState(0);
	const listRef = useRef<FlatList>(null);
	const fadeAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.timing(fadeAnim, {
			toValue: 1,
			duration: 320,
			useNativeDriver: true,
		}).start();
	}, [fadeAnim]);

	function next() {
		if (index < STEPS.length - 1) {
			const next = index + 1;
			setIndex(next);
			listRef.current?.scrollToIndex({ index: next, animated: true });
		} else {
			handleDone();
		}
	}

	async function handleDone() {
		await SecureStore.setItemAsync(SEEN_KEY, "1");
		Animated.timing(fadeAnim, {
			toValue: 0,
			duration: 200,
			useNativeDriver: true,
		}).start(onDone);
	}

	return (
		<Animated.View
			style={{
				position: "absolute",
				inset: 0,
				backgroundColor: Colors.paper,
				zIndex: 999,
				opacity: fadeAnim,
				paddingTop: insets.top,
				paddingBottom: insets.bottom + 16,
			}}
		>
			{/* Skip */}
			<TouchableOpacity
				onPress={handleDone}
				style={{
					alignSelf: "flex-end",
					paddingHorizontal: 20,
					paddingVertical: 12,
				}}
			>
				<Text style={{ fontSize: 14, fontWeight: "600", color: Colors.ink400 }}>
					Skip
				</Text>
			</TouchableOpacity>

			<FlatList
				ref={listRef}
				data={STEPS}
				keyExtractor={(_, i) => String(i)}
				horizontal
				pagingEnabled
				scrollEnabled={false}
				showsHorizontalScrollIndicator={false}
				getItemLayout={(_, i) => ({
					length: SCREEN_W,
					offset: SCREEN_W * i,
					index: i,
				})}
				renderItem={({ item }) => {
					const Ico = (Icons as Record<string, ComponentType<LucideProps>>)[
						item.icon
					];
					return (
						<View
							className="items-center justify-center px-9"
							style={{ width: SCREEN_W }}
						>
							<View
								style={{
									width: 100,
									height: 100,
									borderRadius: 50,
									backgroundColor: Colors.primary100,
									alignItems: "center",
									justifyContent: "center",
									marginBottom: 36,
								}}
							>
								{Ico && (
									<Ico size={44} color={Colors.primary600} strokeWidth={1.5} />
								)}
							</View>
							<Text
								style={{
									fontSize: 28,
									fontWeight: "400",
									letterSpacing: -0.5,
									color: Colors.ink900,
									textAlign: "center",
									lineHeight: 36,
									marginBottom: 16,
								}}
							>
								{item.title}
							</Text>
							<Text
								style={{
									fontSize: 16,
									lineHeight: 26,
									color: Colors.ink500,
									textAlign: "center",
								}}
							>
								{item.body}
							</Text>
						</View>
					);
				}}
			/>

			{/* Dots */}
			<View className="flex-row justify-center" style={{ marginBottom: 32 }}>
				{STEPS.map((step, i) => (
					<Dot key={step.icon} active={i === index} />
				))}
			</View>

			{/* CTA */}
			<View style={{ paddingHorizontal: 24 }}>
				<TouchableOpacity
					onPress={next}
					style={{
						backgroundColor: Colors.primary600,
						borderRadius: Radius.md,
						paddingVertical: 16,
						alignItems: "center",
					}}
				>
					<Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
						{index === STEPS.length - 1 ? "Get started" : "Continue"}
					</Text>
				</TouchableOpacity>
			</View>
		</Animated.View>
	);
}

export async function shouldShowWalkthrough(): Promise<boolean> {
	const seen = await SecureStore.getItemAsync(SEEN_KEY);
	return !seen;
}
