import { useEffect, useRef, useState } from "react";
import {
	Animated,
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context";
import type { Booking } from "../data";
import { Colors, Radius, Shadow } from "../tokens";
import { Avatar, Icon, type IconName } from "./ui";

const QUICK_REPLIES = [
	"See you soon!",
	"Running a few minutes late?",
	"Could we reschedule?",
	"Please arrive 10 min early.",
];

function seedThread(b: Booking) {
	const first = b.customer.split(" ")[0];
	return [
		{
			id: "m1",
			from: "them" as const,
			text: `Hi! I've booked the ${b.service} for ${b.time}. Is that still good?`,
			time: b.when || "earlier",
		},
		{
			id: "m2",
			from: "me" as const,
			text: `Hi ${first} — yes, you're all set for ${b.date.toLowerCase()} at ${b.time}. See you then!`,
			time: "just now",
		},
	];
}

// ---- Chat thread ----
export function ChatSheet() {
	const insets = useSafeAreaInsets();
	const { comms, setComms } = useApp();
	const visible = comms?.type === "chat";
	const b = comms?.b;

	const [msgs, setMsgs] = useState<
		Array<{ id: string; from: "me" | "them"; text: string; time: string }>
	>([]);
	const [draft, setDraft] = useState("");
	const scrollRef = useRef<ScrollView>(null);
	const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (visible && b) {
			setMsgs(seedThread(b));
			setDraft("");
		}
		return () => {
			if (replyTimer.current) clearTimeout(replyTimer.current);
		};
	}, [visible, b?.id, b]);

	function send(text?: string) {
		const t = (text ?? draft).trim();
		if (!t) return;
		const id = `m${msgs.length}${Math.random().toString(36).slice(2, 5)}`;
		setMsgs((m) => [...m, { id, from: "me", text: t, time: "just now" }]);
		setDraft("");
		replyTimer.current = setTimeout(() => {
			const rid = `r${Math.random().toString(36).slice(2, 5)}`;
			setMsgs((m) => [
				...m,
				{
					id: rid,
					from: "them",
					text: "Perfect, thank you! 🙏",
					time: "just now",
				},
			]);
		}, 1400);
	}

	if (!b) return null;
	const first = b.customer.split(" ")[0];

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="fullScreen"
			onRequestClose={() => setComms(null)}
		>
			<KeyboardAvoidingView
				className="flex-1 bg-paper"
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				{/* Header */}
				<View
					className="bg-surface border-b border-line flex-row items-center"
					style={{
						paddingTop: insets.top + 4,
						paddingBottom: 12,
						paddingHorizontal: 10,
						gap: 8,
					}}
				>
					<TouchableOpacity
						onPress={() => setComms(null)}
						className="items-center justify-center"
						style={{ width: 40, height: 40, borderRadius: 20 }}
					>
						<Icon name="ChevronLeft" size={24} color={Colors.ink800} />
					</TouchableOpacity>
					<Avatar name={b.customer} size={40} />
					<View style={{ flex: 1, minWidth: 0 }}>
						<Text
							style={{
								fontSize: 15.5,
								fontWeight: "700",
								color: Colors.ink900,
							}}
						>
							{b.customer}
						</Text>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 5,
								marginTop: 1,
							}}
						>
							<View
								style={{
									width: 7,
									height: 7,
									borderRadius: 4,
									backgroundColor: Colors.primary500,
								}}
							/>
							<Text style={{ fontSize: 12.5, color: Colors.primary600 }}>
								Customer · {b.branch}
							</Text>
						</View>
					</View>
					<TouchableOpacity
						onPress={() => setComms({ type: "call", b })}
						style={[
							{
								width: 40,
								height: 40,
								borderRadius: 20,
								borderWidth: 1,
								borderColor: Colors.line,
								backgroundColor: Colors.surface,
								alignItems: "center",
								justifyContent: "center",
							},
						]}
					>
						<Icon name="Phone" size={18} color={Colors.primary600} />
					</TouchableOpacity>
				</View>

				{/* Context strip */}
				<View
					style={{
						paddingVertical: 10,
						paddingHorizontal: 16,
						backgroundColor: Colors.primary50,
						borderBottomWidth: 1,
						borderBottomColor: Colors.primary100,
						flexDirection: "row",
						alignItems: "center",
						gap: 9,
					}}
				>
					<Icon name="CalendarCheck" size={15} color={Colors.primary600} />
					<Text
						style={{
							fontSize: 12.5,
							color: Colors.primary800,
							fontWeight: "500",
						}}
					>
						{b.service} · {b.date}, {b.time}
					</Text>
				</View>

				{/* Messages */}
				<ScrollView
					ref={scrollRef}
					style={{ flex: 1 }}
					contentContainerStyle={{ padding: 14, gap: 9 }}
					onContentSizeChange={() =>
						scrollRef.current?.scrollToEnd({ animated: true })
					}
				>
					{msgs.map((m) => {
						const me = m.from === "me";
						return (
							<View
								key={m.id}
								style={{ alignItems: me ? "flex-end" : "flex-start" }}
							>
								<View
									style={{
										maxWidth: "78%",
										paddingVertical: 10,
										paddingHorizontal: 13,
										borderRadius: me ? 16 : 16,
										borderBottomRightRadius: me ? 4 : 16,
										borderBottomLeftRadius: me ? 16 : 4,
										backgroundColor: me ? Colors.primary600 : Colors.surface,
										borderWidth: me ? 0 : 1,
										borderColor: Colors.line,
										...Shadow.xs,
									}}
								>
									<Text
										style={{
											fontSize: 14.5,
											lineHeight: 21,
											color: me ? "#fff" : Colors.ink800,
										}}
									>
										{m.text}
									</Text>
								</View>
								<Text
									style={{
										fontSize: 10.5,
										color: Colors.ink400,
										marginTop: 3,
										marginHorizontal: 4,
									}}
								>
									{m.time}
								</Text>
							</View>
						);
					})}
				</ScrollView>

				{/* Quick replies */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					style={{ flexShrink: 0 }}
					contentContainerStyle={{
						gap: 8,
						paddingHorizontal: 14,
						paddingVertical: 8,
					}}
				>
					{QUICK_REPLIES.map((q) => (
						<TouchableOpacity
							key={q}
							onPress={() => send(q)}
							style={{
								paddingVertical: 8,
								paddingHorizontal: 13,
								borderRadius: Radius.pill,
								borderWidth: 1,
								borderColor: Colors.primary200,
								backgroundColor: Colors.primary50,
							}}
						>
							<Text
								style={{
									fontSize: 13,
									fontWeight: "600",
									color: Colors.primary700,
								}}
							>
								{q}
							</Text>
						</TouchableOpacity>
					))}
				</ScrollView>

				{/* Composer */}
				<View
					style={{
						paddingHorizontal: 12,
						paddingTop: 8,
						paddingBottom: insets.bottom + 8,
						borderTopWidth: 1,
						borderTopColor: Colors.line,
						backgroundColor: Colors.surface,
						flexDirection: "row",
						alignItems: "flex-end",
						gap: 9,
					}}
				>
					<TextInput
						value={draft}
						onChangeText={setDraft}
						placeholder={`Message ${first}…`}
						placeholderTextColor={Colors.ink400}
						multiline
						style={{
							flex: 1,
							borderWidth: 1,
							borderColor: Colors.lineStrong,
							borderRadius: Radius.lg,
							paddingVertical: 11,
							paddingHorizontal: 14,
							fontSize: 14.5,
							color: Colors.ink900,
							backgroundColor: Colors.paper,
							maxHeight: 90,
							lineHeight: 21,
						}}
					/>
					<TouchableOpacity
						onPress={() => send()}
						disabled={!draft.trim()}
						style={{
							width: 44,
							height: 44,
							borderRadius: 22,
							backgroundColor: draft.trim()
								? Colors.primary600
								: Colors.lineStrong,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Icon name="ArrowUp" size={20} color="#fff" strokeWidth={2.4} />
					</TouchableOpacity>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

// ---- In-call screen ----
type CallPhase = "ringing" | "live" | "ended";

export function CallOverlay() {
	const insets = useSafeAreaInsets();
	const { comms, setComms } = useApp();
	const visible = comms?.type === "call";
	const b = comms?.b;

	const [phase, setPhase] = useState<CallPhase>("ringing");
	const [secs, setSecs] = useState(0);
	const [muted, setMuted] = useState(false);
	const [speaker, setSpeaker] = useState(false);

	const pulseScale = useRef(new Animated.Value(1)).current;
	const pulseOpacity = useRef(new Animated.Value(0.5)).current;
	const pulseAnim = useRef<Animated.CompositeAnimation | null>(null);

	useEffect(() => {
		if (!visible) return;
		setPhase("ringing");
		setSecs(0);
		setMuted(false);
		setSpeaker(false);
	}, [visible]);

	useEffect(() => {
		if (phase === "ringing") {
			pulseScale.setValue(1);
			pulseOpacity.setValue(0.5);
			pulseAnim.current = Animated.loop(
				Animated.parallel([
					Animated.timing(pulseScale, {
						toValue: 1.7,
						duration: 1600,
						useNativeDriver: true,
					}),
					Animated.timing(pulseOpacity, {
						toValue: 0,
						duration: 1600,
						useNativeDriver: true,
					}),
				]),
			);
			pulseAnim.current.start();
			const t = setTimeout(() => {
				setPhase("live");
			}, 2200);
			return () => {
				clearTimeout(t);
				pulseAnim.current?.stop();
			};
		}
	}, [
		phase,
		pulseOpacity.setValue,
		pulseScale.setValue,
		pulseScale,
		pulseOpacity,
	]);

	useEffect(() => {
		if (phase !== "live") return;
		const iv = setInterval(() => setSecs((s) => s + 1), 1000);
		return () => clearInterval(iv);
	}, [phase]);

	function hangUp() {
		setPhase("ended");
		setTimeout(() => setComms(null), 700);
	}

	const mm = String(Math.floor(secs / 60)).padStart(2, "0");
	const ss = String(secs % 60).padStart(2, "0");
	const statusText =
		phase === "ringing"
			? "Calling…"
			: phase === "ended"
				? "Call ended"
				: `${mm}:${ss}`;

	function Ctrl({
		icon,
		label,
		on,
		onTap,
		danger,
	}: {
		icon: string;
		label: string;
		on?: boolean;
		onTap: () => void;
		danger?: boolean;
	}) {
		return (
			<TouchableOpacity
				onPress={onTap}
				style={{ alignItems: "center", gap: 8, width: 76 }}
			>
				<View
					style={{
						width: 62,
						height: 62,
						borderRadius: 31,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: danger
							? Colors.danger
							: on
								? "#fff"
								: "rgba(255,255,255,0.14)",
					}}
				>
					<Icon
						name={icon as IconName}
						size={24}
						color={danger ? "#fff" : on ? Colors.primary900 : "#fff"}
					/>
				</View>
				<Text
					style={{
						fontSize: 12,
						color: "rgba(255,255,255,0.75)",
						fontWeight: "500",
					}}
				>
					{label}
				</Text>
			</TouchableOpacity>
		);
	}

	if (!b) return null;

	return (
		<Modal
			visible={visible}
			animationType="fade"
			presentationStyle="fullScreen"
			onRequestClose={hangUp}
		>
			<View
				style={{
					flex: 1,
					backgroundColor: Colors.primary900,
					alignItems: "center",
				}}
			>
				{/* Ambient glow */}
				<View
					style={{
						position: "absolute",
						top: -70,
						right: -70,
						width: 240,
						height: 240,
						borderRadius: 120,
						backgroundColor: "rgba(63,184,155,0.15)",
					}}
				/>

				{/* Avatar + status */}
				<View
					style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
				>
					<View
						style={{
							position: "relative",
							width: 116,
							height: 116,
							alignItems: "center",
							justifyContent: "center",
							marginBottom: 26,
						}}
					>
						{phase === "ringing" && (
							<Animated.View
								style={{
									position: "absolute",
									width: 116,
									height: 116,
									borderRadius: 58,
									borderWidth: 2,
									borderColor: Colors.primary400,
									transform: [{ scale: pulseScale }],
									opacity: pulseOpacity,
								}}
							/>
						)}
						<Avatar
							name={b.customer}
							size={116}
							bg={Colors.primary700}
							fg="#fff"
						/>
					</View>
					<Text
						style={{
							fontSize: 30,
							fontWeight: "400",
							letterSpacing: -0.5,
							color: "#fff",
						}}
					>
						{b.customer}
					</Text>
					<Text
						style={{
							fontSize: 15,
							color: Colors.primary200,
							marginTop: 8,
							fontVariant: ["tabular-nums"],
						}}
					>
						{statusText}
					</Text>
					<Text
						style={{ fontSize: 13, color: Colors.primary300, marginTop: 4 }}
					>
						{b.branch}
					</Text>
				</View>

				{/* Controls */}
				<View
					style={{
						width: "100%",
						paddingHorizontal: 28,
						paddingBottom: insets.bottom + 20,
					}}
				>
					<View
						style={{
							flexDirection: "row",
							justifyContent: "center",
							gap: 14,
							marginBottom: 26,
						}}
					>
						<Ctrl
							icon={muted ? "MicOff" : "Mic"}
							label={muted ? "Unmute" : "Mute"}
							on={muted}
							onTap={() => setMuted((v) => !v)}
						/>
						<Ctrl
							icon="MessageCircle"
							label="Message"
							onTap={() => {
								setComms(null);
								setTimeout(() => setComms({ type: "chat", b }), 50);
							}}
						/>
						<Ctrl
							icon={speaker ? "Volume2" : "Volume1"}
							label="Speaker"
							on={speaker}
							onTap={() => setSpeaker((v) => !v)}
						/>
					</View>
					<View style={{ alignItems: "center" }}>
						<Ctrl icon="PhoneOff" label="End" onTap={hangUp} danger />
					</View>
				</View>
			</View>
		</Modal>
	);
}
