import type { DeleteAccountProof, SessionInfo } from "@repo/api-client";
import { DeleteAccountVerificationModal } from "@repo/ui-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import type { LucideProps } from "lucide-react-native";
import * as Icons from "lucide-react-native";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { PAY_AT_BUSINESS } from "../../data";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import {
	fetchGoogleIdTokenForReauth,
	isGoogleSignInCancelled,
} from "../../lib/google-reauth";
import { Colors, Radius, Shadow } from "../../tokens";
import AuthScreen from "../AuthScreen";
import { Button, FieldLabel, Icon, type IconName, Switch } from "../ui";
import MyOrdersScreen from "./MyOrdersScreen";

type AccountView =
	| "menu"
	| "profile"
	| "orders"
	| "payments"
	| "notifs"
	| "sessions"
	| "auth";

const INPUT_STYLE = {
	width: "100%" as const,
	padding: 13,
	paddingHorizontal: 14,
	borderRadius: Radius.md,
	borderWidth: 1,
	borderColor: Colors.lineStrong,
	backgroundColor: Colors.surface,
	fontSize: 15.5,
	color: Colors.ink900,
};

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
	const insets = useSafeAreaInsets();
	return (
		<View
			className="px-4 border-b border-line-soft bg-paper flex-row items-center"
			style={{ paddingTop: insets.top + 4, paddingBottom: 12, gap: 12 }}
		>
			<TouchableOpacity onPress={onBack} style={[styles.iconBtn, Shadow.xs]}>
				<Icons.ChevronLeft size={20} color={Colors.ink700} strokeWidth={2} />
			</TouchableOpacity>
			<Text
				style={{
					flex: 1,
					fontSize: 25,
					fontWeight: "400",
					letterSpacing: -0.4,
					color: Colors.ink900,
				}}
			>
				{title}
			</Text>
		</View>
	);
}

function payTileStyle(kind: string) {
	const map: Record<string, { bg: string; fg: string }> = {
		card: { bg: Colors.primary900, fg: "#fff" },
		upi: { bg: Colors.primary100, fg: Colors.primary700 },
		wallet: { bg: "#111", fg: "#fff" },
		cash: { bg: Colors.creamDeep, fg: Colors.ink700 },
	};
	return map[kind] || map.card;
}

function EditProfileScreen({
	userId,
	name,
	email,
	onBack,
}: {
	userId: string;
	name: string;
	email: string;
	onBack: () => void;
}) {
	const insets = useSafeAreaInsets();
	const qc = useQueryClient();
	const [editName, setEditName] = useState(name);
	const [avatarUri, setAvatarUri] = useState<string | null>(null);

	const updateMut = useMutation({
		mutationFn: (n: string) => api.users.update(userId, { name: n }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["auth", "me"] });
			onBack();
		},
	});

	async function pickPhoto() {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== "granted") return;
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: "images",
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.8,
		});
		if (!result.canceled && result.assets[0]) {
			setAvatarUri(result.assets[0].uri);
		}
	}

	function save() {
		if (editName.trim() && editName !== name) updateMut.mutate(editName.trim());
	}

	return (
		<View className="flex-1 bg-paper">
			<SubHeader title="Edit profile" onBack={onBack} />
			<ScrollView
				contentContainerStyle={{
					padding: 22,
					paddingHorizontal: 16,
					paddingBottom: 30,
				}}
			>
				<View style={{ alignItems: "center", marginBottom: 26 }}>
					<TouchableOpacity onPress={pickPhoto} style={styles.avatar}>
						{avatarUri ? (
							<Image
								source={{ uri: avatarUri }}
								style={{ width: 84, height: 84, borderRadius: 42 }}
								contentFit="cover"
							/>
						) : (
							<Text
								style={{
									fontSize: 34,
									fontWeight: "500",
									color: Colors.primary700,
								}}
							>
								{(editName.trim()[0] || "?").toUpperCase()}
							</Text>
						)}
						<View style={styles.cameraBtn}>
							<Icons.Camera size={15} color="#fff" strokeWidth={1.75} />
						</View>
					</TouchableOpacity>
					<TouchableOpacity style={{ marginTop: 12 }} onPress={pickPhoto}>
						<Text
							style={{
								fontSize: 14,
								fontWeight: "600",
								color: Colors.primary600,
							}}
						>
							Change photo
						</Text>
					</TouchableOpacity>
				</View>
				<View style={{ gap: 16 }}>
					<View>
						<FieldLabel icon="User">Full name</FieldLabel>
						<TextInput
							value={editName}
							onChangeText={setEditName}
							style={INPUT_STYLE}
						/>
					</View>
					<View>
						<FieldLabel icon="Mail">Email</FieldLabel>
						<TextInput
							value={email}
							editable={false}
							style={[INPUT_STYLE, { color: Colors.ink400 }]}
						/>
					</View>
				</View>
			</ScrollView>
			<View
				style={{
					paddingHorizontal: 16,
					paddingTop: 14,
					paddingBottom: insets.bottom + 16,
					borderTopWidth: 1,
					borderTopColor: Colors.lineSoft,
				}}
			>
				<Button
					full
					size="lg"
					disabled={
						!editName.trim() || editName === name || updateMut.isPending
					}
					onPress={save}
				>
					{updateMut.isPending ? "Saving…" : "Save changes"}
				</Button>
			</View>
		</View>
	);
}

function PaymentMethodsScreen({ onBack }: { onBack: () => void }) {
	const t = payTileStyle(PAY_AT_BUSINESS.kind);

	return (
		<View className="flex-1 bg-paper">
			<SubHeader title="Payment" onBack={onBack} />
			<View style={{ padding: 20, paddingHorizontal: 16 }}>
				<View
					style={[styles.payRow, styles.payRowActive, { marginBottom: 16 }]}
				>
					<View style={[styles.payTile, { backgroundColor: t.bg }]}>
						<Icon
							name={PAY_AT_BUSINESS.icon as IconName}
							sizePx={17}
							color={t.fg}
						/>
					</View>
					<View className="flex-1">
						<Text
							className="text-ink-900 font-semibold"
							style={{ fontSize: 15 }}
						>
							{PAY_AT_BUSINESS.label}
						</Text>
						<Text
							className="text-ink-500"
							style={{ fontSize: 12.5, marginTop: 1, lineHeight: 20 }}
						>
							{PAY_AT_BUSINESS.detail}
						</Text>
					</View>
				</View>
				<Text style={{ fontSize: 14.5, color: Colors.ink600, lineHeight: 22 }}>
					Saved cards and mobile wallets will appear here once online payments
					are connected to Talash.
				</Text>
			</View>
		</View>
	);
}

function SessionsScreen({ onBack }: { onBack: () => void }) {
	const qc = useQueryClient();
	const sessionsQuery = useQuery({
		queryKey: ["auth", "sessions"],
		queryFn: () => api.auth.listSessions(),
		staleTime: 60_000,
	});

	const revokeMut = useMutation({
		mutationFn: (id: string) => api.auth.revokeSession(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["auth", "sessions"] }),
	});

	const sessions: SessionInfo[] = sessionsQuery.data ?? [];

	return (
		<View className="flex-1 bg-paper">
			<SubHeader title="Active sessions" onBack={onBack} />
			<ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 30 }}>
				{sessionsQuery.isLoading ? (
					<ActivityIndicator
						color={Colors.primary600}
						style={{ marginTop: 24 }}
					/>
				) : sessions.length === 0 ? (
					<Text
						style={{
							fontSize: 14.5,
							color: Colors.ink500,
							paddingHorizontal: 18,
							lineHeight: 22,
						}}
					>
						No other sessions found. You are signed in on this device only.
					</Text>
				) : (
					<View
						style={{
							marginHorizontal: 16,
							backgroundColor: Colors.surface,
							borderRadius: Radius.lg,
							borderWidth: 1,
							borderColor: Colors.line,
							overflow: "hidden",
						}}
					>
						{sessions.map((s, i) => (
							<View
								key={s.id}
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: 12,
									padding: 14,
									paddingHorizontal: 16,
									borderBottomWidth: i === sessions.length - 1 ? 0 : 1,
									borderBottomColor: Colors.lineSoft,
								}}
							>
								<Icons.Smartphone
									size={19}
									color={Colors.primary600}
									strokeWidth={1.75}
								/>
								<View style={{ flex: 1, minWidth: 0 }}>
									<Text
										style={{
											fontSize: 15,
											fontWeight: "600",
											color: Colors.ink900,
										}}
										numberOfLines={1}
									>
										{s.deviceName ?? s.deviceId ?? "Unknown device"}
									</Text>
									<Text
										style={{
											fontSize: 12.5,
											color: Colors.ink500,
											marginTop: 2,
										}}
									>
										Last used{" "}
										{formatDate(s.lastUsedAt, {
											dateStyle: "medium",
										})}
									</Text>
								</View>
								<TouchableOpacity
									onPress={() => revokeMut.mutate(s.id)}
									disabled={revokeMut.isPending}
									style={{
										paddingVertical: 6,
										paddingHorizontal: 10,
										borderRadius: Radius.sm,
										backgroundColor: Colors.dangerBg,
									}}
								>
									<Text
										style={{
											fontSize: 12,
											fontWeight: "600",
											color: Colors.dangerFg,
										}}
									>
										Revoke
									</Text>
								</TouchableOpacity>
							</View>
						))}
					</View>
				)}
			</ScrollView>
		</View>
	);
}

function NotifPrefsScreen({ onBack }: { onBack: () => void }) {
	const [prefs, setPrefs] = useState({
		push_conf: true,
		push_rem: true,
		push_rew: true,
		push_off: false,
		email_conf: true,
		email_rem: false,
		email_news: false,
	});
	const toggle = (k: keyof typeof prefs) =>
		setPrefs((p) => ({ ...p, [k]: !p[k] }));

	const groups = [
		{
			header: "Push notifications",
			rows: [
				{
					k: "push_conf" as const,
					label: "Booking confirmations",
					sub: "When a business confirms or changes your appointment.",
				},
				{
					k: "push_rem" as const,
					label: "Reminders",
					sub: "A nudge the day before your visit.",
				},
				{
					k: "push_rew" as const,
					label: "Rewards & points",
					sub: "When points land or a perk unlocks.",
				},
				{
					k: "push_off" as const,
					label: "Offers from favourites",
					sub: "Limited deals at places you've saved.",
				},
			],
		},
		{
			header: "Email",
			rows: [
				{
					k: "email_conf" as const,
					label: "Booking receipts",
					sub: "A copy of every confirmation.",
				},
				{
					k: "email_rem" as const,
					label: "Reminders",
					sub: "Email reminders before appointments.",
				},
				{
					k: "email_news" as const,
					label: "Talash newsletter",
					sub: "Editorial picks, monthly. No spam.",
				},
			],
		},
	];

	return (
		<View className="flex-1 bg-paper">
			<SubHeader title="Notifications" onBack={onBack} />
			<ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 30 }}>
				{groups.map((g) => (
					<View key={g.header} style={{ marginBottom: 22 }}>
						<Text
							style={{
								fontSize: 12,
								fontWeight: "600",
								letterSpacing: 2,
								textTransform: "uppercase",
								color: Colors.ink400,
								paddingHorizontal: 18,
								paddingBottom: 8,
							}}
						>
							{g.header}
						</Text>
						<View
							style={{
								marginHorizontal: 16,
								backgroundColor: Colors.surface,
								borderRadius: Radius.lg,
								borderWidth: 1,
								borderColor: Colors.line,
								overflow: "hidden",
							}}
						>
							{g.rows.map((r, i) => (
								<View
									key={r.k}
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 14,
										padding: 14,
										paddingHorizontal: 16,
										borderBottomWidth: i === g.rows.length - 1 ? 0 : 1,
										borderBottomColor: Colors.lineSoft,
									}}
								>
									<View className="flex-1">
										<Text
											style={{
												fontSize: 15,
												fontWeight: "600",
												color: Colors.ink900,
											}}
										>
											{r.label}
										</Text>
										<Text
											style={{
												fontSize: 12.5,
												lineHeight: 18,
												color: Colors.ink500,
												marginTop: 2,
											}}
										>
											{r.sub}
										</Text>
									</View>
									<Switch on={prefs[r.k]} onToggle={() => toggle(r.k)} />
								</View>
							))}
						</View>
					</View>
				))}
			</ScrollView>
		</View>
	);
}

// Sub-views that a route param is allowed to open. "orders" requires auth.
const DEEP_LINK_VIEWS: readonly AccountView[] = ["orders"];

export default function AccountScreen() {
	const insets = useSafeAreaInsets();
	const { authedUser, isAuthed, signIn, signOut } = useApp();
	const qc = useQueryClient();
	const params = useLocalSearchParams<{ view?: string; orderId?: string }>();
	const [view, setView] = useState<AccountView>("menu");
	// Order named by an order-status notification deep-link; consumed once by
	// MyOrdersScreen to auto-open its detail sheet. Cleared on exit so a later
	// manual entry into My Orders never re-pops a stale order (see onBack below).
	const [focusOrderId, setFocusOrderId] = useState<string | undefined>(
		undefined,
	);
	const [deleteVerifyOpen, setDeleteVerifyOpen] = useState(false);
	const [deletePassword, setDeletePassword] = useState("");
	const [deleteGoogleToken, setDeleteGoogleToken] = useState<string | null>(
		null,
	);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	// Open a sub-view when navigated with ?view=… (e.g. order notification
	// deep-link → My Orders). Only honor the allowlist, and only when authed.
	// After consuming the param, clear it so a subsequent identical navigation
	// (same pathname + params) still changes params.view from "" → "orders",
	// causing this effect to re-fire and re-open the sub-view.
	useEffect(() => {
		const requested = params.view;
		if (
			requested &&
			isAuthed &&
			(DEEP_LINK_VIEWS as readonly string[]).includes(requested)
		) {
			setView(requested as AccountView);
			if (params.orderId) setFocusOrderId(params.orderId);
			router.setParams({ view: "", orderId: "" });
		}
	}, [params.view, params.orderId, isAuthed]);

	const meQuery = useQuery({
		queryKey: ["auth", "me"],
		queryFn: () => api.auth.me(),
		enabled: isAuthed,
		staleTime: 60_000,
	});

	const deleteAccountMut = useMutation({
		// biome-ignore lint/style/noNonNullAssertion: only when authed UI is shown
		mutationFn: (proof: DeleteAccountProof) =>
			api.users.delete(authedUser?.id, proof),
		onSuccess: () => {
			qc.clear();
			signOut();
		},
		onError: (e: Error) => setDeleteError(e.message),
	});

	if (view === "auth") {
		return (
			<AuthScreen
				onAuthed={async (tokens) => {
					await signIn(tokens);
					setView("menu");
				}}
				onBack={() => setView("menu")}
			/>
		);
	}

	const user = meQuery.data ?? authedUser;
	const displayName = user?.name ?? "";
	const displayEmail = user?.email ?? "";
	const authMethods = user?.authMethods ?? { password: false, google: false };

	if (view === "profile") {
		return (
			<EditProfileScreen
				userId={user?.id ?? ""}
				name={displayName}
				email={displayEmail}
				onBack={() => setView("menu")}
			/>
		);
	}
	if (view === "orders")
		return (
			<MyOrdersScreen
				onBack={() => {
					setView("menu");
					setFocusOrderId(undefined);
				}}
				focusOrderId={focusOrderId}
			/>
		);
	if (view === "payments")
		return <PaymentMethodsScreen onBack={() => setView("menu")} />;
	if (view === "notifs")
		return <NotifPrefsScreen onBack={() => setView("menu")} />;
	if (view === "sessions")
		return <SessionsScreen onBack={() => setView("menu")} />;

	const groups = [
		{
			header: "Preferences",
			rows: [
				...(isAuthed
					? [
							{
								icon: "ShoppingBag" as const,
								label: "My Orders",
								detail: "Track deliveries",
								go: "orders" as AccountView,
							},
						]
					: []),
				{
					icon: "Bell" as const,
					label: "Notifications",
					detail: "Push, email",
					go: "notifs" as AccountView,
				},
				{
					icon: "CreditCard" as const,
					label: "Payment methods",
					detail: "UPI · +1",
					go: "payments" as AccountView,
				},
				...(isAuthed
					? [
							{
								icon: "Shield" as const,
								label: "Active sessions",
								detail: "Devices",
								go: "sessions" as AccountView,
							},
						]
					: []),
				{
					icon: "Globe" as const,
					label: "Language",
					detail: "English",
					go: undefined,
				},
			],
		},
		{
			header: "Support",
			rows: [
				{
					icon: "LifeBuoy" as const,
					label: "Help",
					detail: undefined,
					go: undefined,
				},
				{
					icon: "FileText" as const,
					label: "Terms & privacy",
					detail: undefined,
					go: undefined,
				},
			],
		},
	];

	return (
		<>
			<ScrollView
				className="flex-1 bg-paper"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 30 }}
			>
				<View
					style={{
						paddingTop: insets.top + 12,
						paddingHorizontal: 16,
						paddingBottom: 10,
					}}
				>
					<Text
						style={{
							fontSize: 32,
							fontWeight: "400",
							letterSpacing: -0.5,
							color: Colors.ink900,
						}}
					>
						Account
					</Text>
				</View>

				{/* Profile strip — sign-in prompt when anonymous */}
				{!isAuthed ? (
					<TouchableOpacity
						onPress={() => setView("auth")}
						style={[styles.profileStrip, Shadow.sm]}
					>
						<View
							style={[styles.profileAvatar, { backgroundColor: Colors.line }]}
						>
							<Icons.User size={24} color={Colors.ink400} strokeWidth={1.5} />
						</View>
						<View className="flex-1">
							<Text
								style={{
									fontSize: 17,
									fontWeight: "700",
									color: Colors.ink900,
								}}
							>
								Sign in to Talash
							</Text>
							<Text style={{ fontSize: 13.5, color: Colors.ink500 }}>
								View bookings, rewards and more
							</Text>
						</View>
						<Icons.ChevronRight
							size={18}
							color={Colors.ink400}
							strokeWidth={1.75}
						/>
					</TouchableOpacity>
				) : (
					<TouchableOpacity
						onPress={() => setView("profile")}
						style={[styles.profileStrip, Shadow.sm]}
					>
						<View style={styles.profileAvatar}>
							<Text
								style={{
									fontSize: 22,
									fontWeight: "500",
									color: Colors.primary700,
								}}
							>
								{(displayName.trim()[0] || "?").toUpperCase()}
							</Text>
						</View>
						<View className="flex-1">
							<Text
								style={{
									fontSize: 17,
									fontWeight: "700",
									color: Colors.ink900,
								}}
							>
								{displayName || "Loading…"}
							</Text>
							<Text style={{ fontSize: 13.5, color: Colors.ink500 }}>
								{displayEmail}
							</Text>
						</View>
						<Text
							style={{
								fontSize: 13.5,
								fontWeight: "600",
								color: Colors.primary600,
							}}
						>
							Edit
						</Text>
					</TouchableOpacity>
				)}

				<TouchableOpacity
					onPress={() => router.push("/walk-in/scan")}
					style={{
						marginHorizontal: 16,
						marginBottom: 16,
						flexDirection: "row",
						alignItems: "center",
						gap: 12,
						paddingVertical: 14,
						paddingHorizontal: 16,
						borderRadius: Radius.lg,
						borderWidth: 1,
						borderColor: Colors.lineStrong,
						backgroundColor: Colors.surface,
					}}
					accessibilityRole="button"
					accessibilityLabel="Scan shop QR"
				>
					<Icons.ScanLine
						size={20}
						color={Colors.primary700}
						strokeWidth={1.75}
					/>
					<View className="flex-1">
						<Text
							style={{
								fontSize: 15.5,
								fontWeight: "600",
								color: Colors.ink900,
							}}
						>
							Scan shop QR
						</Text>
						<Text style={{ fontSize: 13, color: Colors.ink500 }}>
							Book or order at the counter
						</Text>
					</View>
					<Icons.ChevronRight
						size={18}
						color={Colors.ink400}
						strokeWidth={1.75}
					/>
				</TouchableOpacity>

				{groups.map((g) => (
					<View key={g.header} style={{ marginBottom: 22 }}>
						<Text
							style={{
								fontSize: 12,
								fontWeight: "600",
								letterSpacing: 2,
								textTransform: "uppercase",
								color: Colors.ink400,
								paddingHorizontal: 18,
								paddingBottom: 8,
							}}
						>
							{g.header}
						</Text>
						<View
							style={{
								marginHorizontal: 16,
								backgroundColor: Colors.surface,
								borderRadius: Radius.lg,
								borderWidth: 1,
								borderColor: Colors.line,
								overflow: "hidden",
							}}
						>
							{g.rows.map((r, i) => {
								const Ico = (
									Icons as Record<string, ComponentType<LucideProps>>
								)[r.icon];
								return (
									<TouchableOpacity
										key={r.label}
										onPress={
											r.go ? () => setView(r.go as AccountView) : undefined
										}
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 12,
											padding: 14,
											paddingHorizontal: 16,
											borderBottomWidth: i === g.rows.length - 1 ? 0 : 1,
											borderBottomColor: Colors.lineSoft,
										}}
									>
										{Ico && (
											<Ico
												size={19}
												color={Colors.primary600}
												strokeWidth={1.75}
											/>
										)}
										<Text
											style={{ flex: 1, fontSize: 15.5, color: Colors.ink900 }}
										>
											{r.label}
										</Text>
										{r.detail && (
											<Text style={{ fontSize: 14, color: Colors.ink400 }}>
												{r.detail}
											</Text>
										)}
										<Icons.ChevronRight
											size={17}
											color={Colors.ink300}
											strokeWidth={1.75}
										/>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>
				))}

				<View style={{ paddingHorizontal: 16 }}>
					{authedUser ? (
						<>
							<TouchableOpacity
								onPress={() => signOut()}
								style={styles.signOutBtn}
							>
								<Text
									style={{
										fontSize: 15.5,
										fontWeight: "600",
										color: Colors.dangerFg,
									}}
								>
									Sign out
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[
									styles.signOutBtn,
									{ marginTop: 10, borderColor: Colors.lineStrong },
								]}
								onPress={() => {
									Alert.alert(
										"Delete account?",
										"This permanently deletes your account and all your data. This cannot be undone.",
										[
											{ text: "Cancel", style: "cancel" },
											{
												text: "Continue",
												style: "destructive",
												onPress: () => {
													setDeleteError(null);
													setDeletePassword("");
													setDeleteGoogleToken(null);
													setDeleteVerifyOpen(true);
												},
											},
										],
									);
								}}
							>
								<Text
									style={{
										fontSize: 14,
										fontWeight: "500",
										color: Colors.ink400,
									}}
								>
									Delete account
								</Text>
							</TouchableOpacity>
						</>
					) : (
						<TouchableOpacity
							onPress={() => setView("auth")}
							style={[styles.signOutBtn, { borderColor: Colors.primary300 }]}
						>
							<Text
								style={{
									fontSize: 15.5,
									fontWeight: "600",
									color: Colors.primary700,
								}}
							>
								Sign in
							</Text>
						</TouchableOpacity>
					)}
				</View>
			</ScrollView>

			<DeleteAccountVerificationModal
				visible={deleteVerifyOpen}
				authMethods={authMethods}
				password={deletePassword}
				onPasswordChange={setDeletePassword}
				googleIdToken={deleteGoogleToken}
				isPending={deleteAccountMut.isPending}
				error={deleteError}
				onClose={() => {
					if (deleteAccountMut.isPending) return;
					setDeleteVerifyOpen(false);
					setDeleteError(null);
					setDeletePassword("");
					setDeleteGoogleToken(null);
				}}
				onGooglePress={async () => {
					try {
						setDeleteError(null);
						const token = await fetchGoogleIdTokenForReauth();
						if (token) {
							setDeleteGoogleToken(token);
							setDeletePassword("");
						}
					} catch (e) {
						if (!isGoogleSignInCancelled(e)) {
							setDeleteError(
								e instanceof Error ? e.message : "Google verification failed.",
							);
						}
					}
				}}
				onConfirmDelete={(proof) => deleteAccountMut.mutate(proof)}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	iconBtn: {
		width: 38,
		height: 38,
		borderRadius: Radius.pill,
		borderWidth: 1,
		borderColor: Colors.line,
		backgroundColor: Colors.surface,
		alignItems: "center",
		justifyContent: "center",
	},
	avatar: {
		width: 84,
		height: 84,
		borderRadius: 42,
		backgroundColor: Colors.primary100,
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
	},
	cameraBtn: {
		position: "absolute",
		bottom: -2,
		right: -2,
		width: 30,
		height: 30,
		borderRadius: 15,
		backgroundColor: Colors.primary600,
		borderWidth: 2,
		borderColor: Colors.paper,
		alignItems: "center",
		justifyContent: "center",
	},
	profileStrip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
		marginHorizontal: 16,
		marginBottom: 22,
		padding: 16,
		backgroundColor: Colors.surface,
		borderRadius: Radius.lg,
		borderWidth: 1,
		borderColor: Colors.line,
	},
	profileAvatar: {
		width: 54,
		height: 54,
		borderRadius: 27,
		backgroundColor: Colors.primary100,
		alignItems: "center",
		justifyContent: "center",
	},
	payRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 13,
		padding: 13,
		paddingHorizontal: 14,
		borderRadius: Radius.md,
		borderWidth: 1.5,
	},
	payRowActive: {
		backgroundColor: Colors.primary50,
		borderColor: Colors.primary600,
	},
	payRowInactive: { backgroundColor: Colors.surface, borderColor: Colors.line },
	payTile: {
		width: 42,
		height: 30,
		borderRadius: Radius.xs,
		alignItems: "center",
		justifyContent: "center",
	},
	defaultBadge: {
		backgroundColor: Colors.primary100,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: Radius.pill,
	},
	addCardBtn: {
		marginTop: 12,
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		padding: 14,
		borderRadius: Radius.md,
		borderWidth: 1.5,
		borderStyle: "dashed",
		borderColor: Colors.lineStrong,
	},
	signOutBtn: {
		padding: 15,
		borderRadius: Radius.md,
		borderWidth: 1,
		borderColor: Colors.lineStrong,
		backgroundColor: Colors.surface,
		alignItems: "center",
	},
});
