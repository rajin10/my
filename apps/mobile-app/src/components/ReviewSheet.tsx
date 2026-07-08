import * as Icons from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context";
import type { Booking } from "../data";
import { Colors, Radius } from "../tokens";
import { Button } from "./ui";

export default function ReviewSheet({ booking }: { booking: Booking }) {
	const { setModal, submitReview } = useApp();
	const insets = useSafeAreaInsets();
	const [rating, setRating] = useState(0);
	const [text, setText] = useState("");
	const [done, setDone] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	function submit() {
		submitReview(booking.id, rating, text);
		setDone(true);
		timerRef.current = setTimeout(() => setModal(null), 1400);
	}

	return (
		<KeyboardAvoidingView
			className="absolute inset-0 justify-end"
			style={{ zIndex: 70 }}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<TouchableOpacity
				className="absolute inset-0 bg-[rgba(8,54,44,0.40)]"
				onPress={() => setModal(null)}
				activeOpacity={1}
			/>
			<View
				className="bg-surface rounded-tl-xl rounded-tr-xl"
				style={[
					{ padding: 20, paddingBottom: insets.bottom + 28 },
					{
						shadowColor: "#08362C",
						shadowOffset: { width: 0, height: -4 },
						shadowOpacity: 0.12,
						shadowRadius: 24,
						elevation: 12,
					},
				]}
			>
				<View
					className="self-center bg-line-strong"
					style={{ width: 40, height: 4, borderRadius: 2, marginBottom: 18 }}
				/>

				{done ? (
					<View
						className="items-center"
						style={{ paddingVertical: 20, paddingBottom: 12 }}
					>
						<View
							className="items-center justify-center bg-success-bg"
							style={{
								width: 60,
								height: 60,
								borderRadius: 30,
								marginBottom: 16,
							}}
						>
							<Icons.Check size={28} color={Colors.successFg} strokeWidth={2} />
						</View>
						<Text
							className="text-ink-900"
							style={{ fontSize: 22, fontWeight: "400", marginBottom: 8 }}
						>
							Thank you
						</Text>
						<Text
							className="text-ink-500 text-center"
							style={{ maxWidth: 280, fontSize: 14.5, lineHeight: 23 }}
						>
							Your review has been sent to {booking.business.name} for approval.
							It'll appear once they confirm it.
						</Text>
					</View>
				) : (
					<>
						<Text
							className="text-primary-600 font-semibold uppercase"
							style={{ fontSize: 12, letterSpacing: 2, marginBottom: 8 }}
						>
							{booking.service.name}
						</Text>
						<Text
							className="text-ink-900"
							style={{
								fontSize: 26,
								fontWeight: "400",
								lineHeight: 30,
								letterSpacing: -0.4,
							}}
						>
							How was your visit to {booking.business.name}?
						</Text>

						<View
							className="flex-row"
							style={{ gap: 6, marginTop: 20, marginBottom: 22 }}
						>
							{[1, 2, 3, 4, 5].map((n) => (
								<TouchableOpacity
									key={n}
									onPress={() => setRating(n)}
									hitSlop={4}
								>
									<Icons.Star
										size={36}
										color={n <= rating ? Colors.gold500 : Colors.gold300}
										fill={n <= rating ? Colors.gold500 : "transparent"}
										strokeWidth={1.5}
									/>
								</TouchableOpacity>
							))}
						</View>

						<TextInput
							value={text}
							onChangeText={setText}
							placeholder="Share a few words about your experience (optional)…"
							placeholderTextColor={Colors.ink400}
							multiline
							numberOfLines={4}
							style={{
								padding: 14,
								paddingHorizontal: 16,
								borderRadius: Radius.md,
								borderWidth: 1,
								borderColor: Colors.lineStrong,
								backgroundColor: Colors.paper,
								fontSize: 15,
								lineHeight: 23,
								color: Colors.ink900,
								textAlignVertical: "top",
								minHeight: 96,
							}}
						/>

						<View className="flex-row" style={{ gap: 10, marginTop: 18 }}>
							<Button variant="ghost" full onPress={() => setModal(null)}>
								Not now
							</Button>
							<Button full disabled={rating === 0} onPress={submit}>
								Submit review
							</Button>
						</View>

						<Text
							className="text-ink-400 text-center"
							style={{ marginTop: 14, fontSize: 12.5, lineHeight: 18 }}
						>
							Reviews are published after the business approves them.
						</Text>
					</>
				)}
			</View>
		</KeyboardAvoidingView>
	);
}
