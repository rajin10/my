import type { DeleteAccountProof, SessionInfo } from "@repo/api-client";
import { DeleteAccountVerificationModal } from "@repo/ui-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import type React from "react";
import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { OverlayId } from "../../context";
import { useApp } from "../../context";
import { isBusinessStatusToggleable, money, ROLE_TONES } from "../../data";
import {
	useDeleteBranch,
	useDeleteBusiness,
	useDeleteBusinessPhoto,
	useReorderBusinessPhotos,
	useRestoreVenue,
} from "../../hooks/useOwnerData";
import { api } from "../../lib/api";
import {
	fetchGoogleIdTokenForReauth,
	isGoogleSignInCancelled,
} from "../../lib/google-reauth";
import { Colors, Radius } from "../../tokens";
import {
	Avatar,
	BackHeader,
	Button,
	Card,
	Eyebrow,
	Icon,
	type IconName,
	StatusPill,
	ToggleSwitch,
} from "../ui";

// ---- More hub screen ----
export default function MoreScreen() {
	const insets = useSafeAreaInsets();
	const { business, setOverlay, signOut, team } = useApp();
	const qc = useQueryClient();
	const meQuery = useQuery({
		queryKey: ["auth", "me"],
		queryFn: () => api.auth.me(),
		staleTime: 5 * 60_000,
	});
	const [deleteVerifyOpen, setDeleteVerifyOpen] = useState(false);
	const [deletePassword, setDeletePassword] = useState("");
	const [deleteGoogleToken, setDeleteGoogleToken] = useState<string | null>(
		null,
	);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const deleteAccountMut = useMutation({
		mutationFn: (proof: DeleteAccountProof) => {
			const userId = meQuery.data?.id;
			if (!userId) throw new Error("Not signed in");
			return api.users.delete(userId, proof);
		},
		onSuccess: () => {
			qc.clear();
			signOut();
		},
		onError: (e: Error) => setDeleteError(e.message),
	});

	const authMethods = meQuery.data?.authMethods ?? {
		password: false,
		google: false,
	};

	const groups = [
		{
			header: "Insights & schedule",
			items: [
				...(business.vertical === "commerce"
					? [
							{
								id: "orders",
								icon: "Package",
								label: "Orders",
								sub: "Incoming & fulfillment",
							},
							{
								id: "khata",
								icon: "Wallet",
								label: "Customer dues",
								sub: "Khata — record & track payments",
							},
						]
					: []),
				{
					id: "analytics",
					icon: "TrendingUp",
					label: "Analytics",
					sub: "Revenue, bookings & trends",
				},
				{
					id: "calendar",
					icon: "CalendarDays",
					label: "Calendar",
					sub: "Day and week schedule",
				},
				{
					id: "customers",
					icon: "Users2",
					label: "Customers",
					sub: "Your client list & profiles",
				},
				{
					id: "campaigns",
					icon: "Megaphone",
					label: "Campaigns",
					sub: "Email and push outreach",
				},
			],
		},
		{
			header: "Your business",
			items: [
				{
					id: "business",
					icon: "Store",
					label: "Business profile",
					sub: business.status,
				},
				{
					id: "coupons",
					icon: "Ticket",
					label: "Coupons",
					sub: "Discount codes",
				},
				{
					id: "branding",
					icon: "Palette",
					label: "Brand & appearance",
					sub: "Your venue's colours",
				},
				{
					id: "team",
					icon: "Users",
					label: "Team",
					sub: `${team.length} ${team.length === 1 ? "person" : "people"}`,
				},
			],
		},
		{
			header: "Account",
			items: [
				{
					id: "account",
					icon: "User",
					label: "Profile & settings",
					sub: business.owner.name,
				},
				{
					id: "help",
					icon: "LifeBuoy",
					label: "Help & support",
					sub: "Guides and contact",
				},
			],
		},
	];

	return (
		<View className="flex-1 bg-paper">
			<View
				className="px-4 bg-paper"
				style={{ paddingTop: insets.top + 12, paddingBottom: 8 }}
			>
				<Text
					className="text-ink-900"
					style={{ fontSize: 32, fontWeight: "400", letterSpacing: -0.5 }}
				>
					More
				</Text>
			</View>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				<View style={{ paddingHorizontal: 16 }}>
					<Card
						pad={16}
						style={{ flexDirection: "row", alignItems: "center", gap: 13 }}
					>
						<Avatar
							name={business.owner.name}
							size={48}
							bg={Colors.primary900}
							fg="#fff"
						/>
						<View className="flex-1 min-w-0">
							<Text className="text-ink-900 font-bold" style={{ fontSize: 16 }}>
								{business.owner.name}
							</Text>
							<Text
								className="text-ink-500"
								style={{ fontSize: 13, marginTop: 2 }}
							>
								{business.owner.role} · {business.name}
							</Text>
						</View>
						<View
							className="bg-gold-100 rounded-full"
							style={{ paddingHorizontal: 10, paddingVertical: 4 }}
						>
							<Text
								className="text-gold-700 font-bold"
								style={{ fontSize: 11.5 }}
							>
								{business.owner.role}
							</Text>
						</View>
					</Card>
				</View>

				{groups.map((g) => (
					<View key={g.header} style={{ paddingHorizontal: 16, marginTop: 22 }}>
						<Eyebrow color={Colors.ink400} style={{ marginBottom: 10 }}>
							{g.header}
						</Eyebrow>
						<Card pad={4}>
							{g.items.map((it, i) => (
								<TouchableOpacity
									key={it.id}
									onPress={() => setOverlay(it.id as OverlayId)}
									className="flex-row items-center"
									style={{
										gap: 13,
										padding: 13,
										borderTopWidth: i ? 1 : 0,
										borderTopColor: Colors.lineSoft,
									}}
								>
									<View
										className="items-center justify-center bg-primary-50 rounded-sm"
										style={{ width: 38, height: 38 }}
									>
										<Icon
											name={it.icon as IconName}
											size={19}
											color={Colors.primary600}
										/>
									</View>
									<View className="flex-1 min-w-0">
										<Text
											className="text-ink-900 font-semibold"
											style={{ fontSize: 15 }}
										>
											{it.label}
										</Text>
										<Text
											className="text-ink-400"
											style={{ fontSize: 12.5, marginTop: 1 }}
										>
											{it.sub}
										</Text>
									</View>
									<Icon name="ChevronRight" size={19} color={Colors.ink300} />
								</TouchableOpacity>
							))}
						</Card>
					</View>
				))}

				<View style={{ paddingHorizontal: 16, marginTop: 22 }}>
					<Button
						variant="ghost"
						full
						icon="LogOut"
						style={{ justifyContent: "flex-start" }}
						onPress={signOut}
					>
						Sign out
					</Button>
					<Button
						variant="dangerOutline"
						full
						icon="Trash2"
						style={{ justifyContent: "flex-start", marginTop: 4 }}
						onPress={() => {
							if (!meQuery.data?.id) return;
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
						Delete account
					</Button>
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
		</View>
	);
}

// ---- Business profile sub-screen ----
export function BusinessScreen() {
	const insets = useSafeAreaInsets();
	const {
		business,
		businessId,
		status,
		toggleStatus,
		flash,
		setOverlay,
		setSheet,
		apiBranches,
	} = useApp();
	const toggleable = isBusinessStatusToggleable(status);
	const deleteBranchMut = useDeleteBranch();
	const restoreVenueMut = useRestoreVenue();
	const deleteBusinessMut = useDeleteBusiness();
	const deletePhotoMut = useDeleteBusinessPhoto();
	const reorderPhotoMut = useReorderBusinessPhotos();

	const photosQuery = useQuery({
		queryKey: ["business-photos", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.businesses.listPhotos(businessId!),
		enabled: !!businessId,
		staleTime: 60_000,
	});
	const photoObjects = photosQuery.data ?? [];

	function handleDeletePhoto(photoId: string) {
		if (!businessId) return;
		Alert.alert("Delete photo?", "This cannot be undone.", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: () => deletePhotoMut.mutate({ businessId, photoId }),
			},
		]);
	}

	function handleMovePhoto(index: number, direction: -1 | 1) {
		if (!businessId || photoObjects.length < 2) return;
		const newPhotos = [...photoObjects];
		const target = index + direction;
		if (target < 0 || target >= newPhotos.length) return;
		[newPhotos[index], newPhotos[target]] = [
			newPhotos[target],
			newPhotos[index],
		];
		const orders = newPhotos.map((p, i) => ({ id: p.id, order: i }));
		reorderPhotoMut.mutate({ businessId, orders });
	}

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Business profile"
				onBack={() => setOverlay(null)}
				action="Edit"
				actionIcon="Pencil"
				onAction={() => setSheet({ type: "editBusiness" })}
				topInset={insets.top}
			/>

			{/* Photo gallery */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={{ flexShrink: 0 }}
				contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 4 }}
			>
				{photoObjects.length === 0 ? (
					<View
						style={{
							width: 220,
							height: 150,
							borderRadius: Radius.lg,
							borderWidth: 1.5,
							borderStyle: "dashed",
							borderColor: Colors.lineStrong,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: Colors.primary50,
						}}
					>
						<Icon name="ImagePlus" sizePx={22} color={Colors.primary600} />
						<Text
							style={{
								marginTop: 8,
								fontSize: 13,
								fontWeight: "600",
								color: Colors.primary700,
							}}
						>
							Add photos in Edit
						</Text>
					</View>
				) : (
					photoObjects.map((photo, i) => (
						<View key={photo.id} style={{ position: "relative" }}>
							<Image
								source={{ uri: photo.url }}
								style={{
									width: i === 0 ? 220 : 130,
									height: 150,
									borderRadius: Radius.lg,
								}}
								contentFit="cover"
							/>
							{/* Delete button */}
							<TouchableOpacity
								onPress={() => handleDeletePhoto(photo.id)}
								style={{
									position: "absolute",
									top: 6,
									right: 6,
									width: 26,
									height: 26,
									borderRadius: 13,
									backgroundColor: "rgba(200,40,40,0.85)",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Icon name="X" size={13} color="#fff" />
							</TouchableOpacity>
							{/* Reorder arrows */}
							<View
								style={{
									position: "absolute",
									bottom: 6,
									left: 6,
									flexDirection: "row",
									gap: 4,
								}}
							>
								{i > 0 && (
									<TouchableOpacity
										onPress={() => handleMovePhoto(i, -1)}
										style={{
											width: 26,
											height: 26,
											borderRadius: 13,
											backgroundColor: "rgba(0,0,0,0.55)",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<Icon name="ChevronLeft" size={14} color="#fff" />
									</TouchableOpacity>
								)}
								{i < photoObjects.length - 1 && (
									<TouchableOpacity
										onPress={() => handleMovePhoto(i, 1)}
										style={{
											width: 26,
											height: 26,
											borderRadius: 13,
											backgroundColor: "rgba(0,0,0,0.55)",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<Icon name="ChevronRight" size={14} color="#fff" />
									</TouchableOpacity>
								)}
							</View>
						</View>
					))
				)}
			</ScrollView>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 18,
					paddingBottom: 32,
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "flex-start",
						justifyContent: "space-between",
						gap: 12,
					}}
				>
					<View style={{ flex: 1, minWidth: 0 }}>
						<Text
							style={{
								fontSize: 26,
								fontWeight: "400",
								letterSpacing: -0.3,
								color: Colors.ink900,
							}}
						>
							{business.name}
						</Text>
						<Text
							style={{ fontSize: 13.5, color: Colors.ink500, marginTop: 4 }}
						>
							{business.category} · {business.city}
						</Text>
					</View>
					<StatusPill status={status} />
				</View>

				<Text
					style={{
						marginTop: 14,
						fontSize: 14.5,
						lineHeight: 24,
						color: Colors.ink700,
					}}
				>
					{business.description}
				</Text>

				<View style={{ marginTop: 18, gap: 10 }}>
					<Button
						variant="ghost"
						full
						icon="Repeat"
						disabled={!toggleable}
						onPress={toggleStatus}
					>
						{status === "Suspended"
							? "Suspended by Talash"
							: status === "Active"
								? "Switch to Draft (hide from customers)"
								: "Go live (visible to customers)"}
					</Button>
					{status === "Suspended" && (
						<Text
							style={{ fontSize: 13, color: Colors.ink500, lineHeight: 19 }}
						>
							Your business has been suspended by Talash and is hidden from
							customers. Contact support to resolve this.
						</Text>
					)}
					{businessId && (
						<Button
							variant="quiet"
							full
							icon="RotateCcw"
							onPress={() => {
								Alert.alert(
									"Restore business?",
									"This will make the business visible and active again.",
									[
										{ text: "Cancel", style: "cancel" },
										{
											text: "Restore",
											onPress: () => restoreVenueMut.mutate(businessId),
										},
									],
								);
							}}
							disabled={restoreVenueMut.isPending}
						>
							{restoreVenueMut.isPending ? "Restoring…" : "Restore business"}
						</Button>
					)}
					{businessId && (
						<Button
							variant="dangerOutline"
							full
							icon="Archive"
							onPress={() => {
								Alert.alert(
									"Archive business?",
									"The business will be hidden from customer search. You can restore it from this page at any time.",
									[
										{ text: "Cancel", style: "cancel" },
										{
											text: "Archive",
											style: "destructive",
											onPress: () =>
												deleteBusinessMut.mutate(businessId, {
													onSuccess: () =>
														flash("Business archived", {
															tone: "success",
															icon: "Archive",
														}),
													onError: (e: unknown) =>
														flash((e as Error).message ?? "Failed", {
															tone: "danger",
														}),
												}),
										},
									],
								);
							}}
							disabled={deleteBusinessMut.isPending}
						>
							{deleteBusinessMut.isPending ? "Archiving…" : "Archive business"}
						</Button>
					)}
				</View>

				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						marginTop: 24,
						marginBottom: 10,
					}}
				>
					<Eyebrow color={Colors.ink400}>Branches</Eyebrow>
					<TouchableOpacity
						onPress={() => setSheet({ type: "addBranch" })}
						style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
					>
						<Icon name="Plus" size={15} color={Colors.primary600} />
						<Text
							style={{
								fontSize: 13.5,
								fontWeight: "700",
								color: Colors.primary600,
							}}
						>
							Add branch
						</Text>
					</TouchableOpacity>
				</View>
				<Card pad={4}>
					{apiBranches.map((b, i) => (
						<View
							key={b.id}
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 10,
								padding: 13,
								borderTopWidth: i ? 1 : 0,
								borderTopColor: Colors.lineSoft,
							}}
						>
							<Icon name="MapPin" sizePx={18} color={Colors.primary600} />
							<View style={{ flex: 1, minWidth: 0 }}>
								<Text
									style={{
										fontSize: 14.5,
										fontWeight: "600",
										color: Colors.ink900,
									}}
								>
									{b.name}
								</Text>
								<Text
									style={{ fontSize: 12.5, color: Colors.ink400, marginTop: 1 }}
									numberOfLines={1}
								>
									{b.address}, {b.city}
									{i === 0 ? " · Main" : ""}
								</Text>
							</View>
							<TouchableOpacity
								onPress={() =>
									setSheet({
										type: "branchHours",
										branchId: b.id,
										branchName: b.name,
									})
								}
								style={styles.branchAction}
							>
								<Icon name="Clock" sizePx={16} color={Colors.ink500} />
							</TouchableOpacity>
							<TouchableOpacity
								onPress={() =>
									setSheet({
										type: "editBranch",
										branchId: b.id,
										name: b.name,
										address: b.address,
										city: b.city,
									})
								}
								style={styles.branchAction}
							>
								<Icon name="Pencil" sizePx={16} color={Colors.ink500} />
							</TouchableOpacity>
							{i > 0 && (
								<TouchableOpacity
									onPress={() => {
										Alert.alert(
											"Remove branch?",
											`Delete ${b.name}? This cannot be undone.`,
											[
												{ text: "Cancel", style: "cancel" },
												{
													text: "Delete",
													style: "destructive",
													onPress: () => deleteBranchMut.mutate(b.id),
												},
											],
										);
									}}
									style={styles.branchAction}
								>
									<Icon name="Trash2" sizePx={16} color={Colors.dangerFg} />
								</TouchableOpacity>
							)}
						</View>
					))}
				</Card>
			</ScrollView>
		</View>
	);
}

// ---- Team sub-screen ----
export function TeamScreen() {
	const insets = useSafeAreaInsets();
	const { business, team, setSheet, removeStaff, setOverlay } = useApp();
	const groups = business.branches.map((br) => ({
		branch: br,
		items: team.filter((t) => t.branch === br),
	}));

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Team"
				onBack={() => setOverlay(null)}
				action="Add"
				actionIcon="Plus"
				onAction={() => setSheet({ type: "addStaff" })}
				topInset={insets.top}
			/>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 4,
					paddingBottom: 32,
					gap: 22,
				}}
			>
				{groups.map((g) => (
					<View key={g.branch}>
						<View
							className="flex-row items-center"
							style={{ gap: 6, marginBottom: 11 }}
						>
							<Icon name="MapPin" size={15} color={Colors.primary600} />
							<Text className="text-ink-700 font-bold" style={{ fontSize: 13 }}>
								{g.branch}
							</Text>
							<Text className="text-ink-400" style={{ fontSize: 12.5 }}>
								· {g.items.length}
							</Text>
						</View>
						{g.items.length === 0 ? (
							<Card pad={18}>
								<Text
									className="text-ink-500 text-center"
									style={{ fontSize: 13.5, lineHeight: 20 }}
								>
									No one assigned here yet. Tap{" "}
									<Text style={{ fontWeight: "700", color: Colors.ink700 }}>
										Add
									</Text>{" "}
									to invite a teammate.
								</Text>
							</Card>
						) : (
							<Card pad={4}>
								{g.items.map((t, i) => {
									const tone = ROLE_TONES[t.role] || ROLE_TONES.Staff;
									const editable = t.role !== "Owner";
									return (
										<TouchableOpacity
											key={t.id}
											onPress={
												editable
													? () => setSheet({ type: "addStaff", member: t })
													: undefined
											}
											activeOpacity={editable ? 0.7 : 1}
											className="flex-row items-center"
											style={{
												gap: 12,
												padding: 12,
												borderTopWidth: i ? 1 : 0,
												borderTopColor: Colors.lineSoft,
											}}
										>
											<Avatar name={t.name} size={42} />
											<View className="flex-1 min-w-0">
												<Text
													className="text-ink-900 font-semibold"
													style={{ fontSize: 14.5 }}
												>
													{t.name}
												</Text>
												<Text
													className="text-ink-400"
													style={{ fontSize: 12.5, marginTop: 1 }}
												>
													{t.title}
												</Text>
											</View>
											<View
												className="rounded-full"
												style={{
													backgroundColor: tone.bg,
													paddingHorizontal: 10,
													paddingVertical: 4,
												}}
											>
												<Text
													className="font-bold"
													style={{ fontSize: 11.5, color: tone.fg }}
												>
													{t.role}
												</Text>
											</View>
											{editable && (
												<View style={{ flexDirection: "row", gap: 6 }}>
													<TouchableOpacity
														onPress={() =>
															setSheet({
																type: "staffAvailability",
																teamMemberId: t.id,
																memberName: t.name,
															})
														}
														className="items-center justify-center border border-line bg-surface"
														style={{ width: 30, height: 30, borderRadius: 15 }}
													>
														<Icon
															name="Clock"
															size={14}
															color={Colors.ink400}
														/>
													</TouchableOpacity>
													<TouchableOpacity
														onPress={() => removeStaff(t.id)}
														className="items-center justify-center border border-line bg-surface"
														style={{ width: 30, height: 30, borderRadius: 15 }}
													>
														<Icon name="X" size={14} color={Colors.ink400} />
													</TouchableOpacity>
												</View>
											)}
										</TouchableOpacity>
									);
								})}
							</Card>
						)}
					</View>
				))}
			</ScrollView>
		</View>
	);
}

// ---- Coupons sub-screen ----
export function CouponsScreen() {
	const insets = useSafeAreaInsets();
	const { coupons, setOverlay, setSheet, toggleCoupon } = useApp();

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Coupons"
				onBack={() => setOverlay(null)}
				action="Create"
				actionIcon="Plus"
				onAction={() => setSheet({ type: "createCoupon" })}
				topInset={insets.top}
			/>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 4,
					paddingBottom: 32,
					gap: 12,
				}}
			>
				{coupons.map((c) => {
					const pct = Math.min(100, Math.round((c.used / c.max) * 100));
					return (
						<Card
							key={c.id}
							pad={16}
							style={{ opacity: c.status === "Expired" ? 0.7 : 1 }}
							onPress={() => setSheet({ type: "couponDetail", coupon: c })}
						>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 10,
								}}
							>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 10,
									}}
								>
									<View
										className="items-center justify-center bg-gold-100 rounded-sm"
										style={{ width: 38, height: 38 }}
									>
										<Icon name="Ticket" size={19} color={Colors.gold700} />
									</View>
									<View>
										<Text
											style={{
												fontSize: 15,
												fontWeight: "600",
												letterSpacing: -0.1,
												color: Colors.ink900,
												fontVariant: ["tabular-nums"],
											}}
										>
											{c.code}
										</Text>
										<Text
											style={{
												fontSize: 12.5,
												color: Colors.ink500,
												marginTop: 1,
											}}
										>
											{c.type === "Percentage"
												? `${c.value}% off`
												: `${money(c.value)} off`}
										</Text>
									</View>
								</View>
								<StatusPill status={c.status} size="sm" />
							</View>

							<View style={{ marginTop: 13 }}>
								<View
									style={{
										flexDirection: "row",
										justifyContent: "space-between",
										marginBottom: 5,
									}}
								>
									<Text style={{ fontSize: 12.5, color: Colors.ink500 }}>
										{c.used} of {c.max} used
									</Text>
									<Text style={{ fontSize: 12.5, color: Colors.ink500 }}>
										Expires {c.expires}
									</Text>
								</View>
								<View
									style={{
										height: 6,
										borderRadius: 999,
										backgroundColor: Colors.lineSoft,
										overflow: "hidden",
									}}
								>
									<View
										style={{
											width: `${pct}%`,
											height: "100%",
											borderRadius: 999,
											backgroundColor:
												c.status === "Active"
													? Colors.primary500
													: Colors.ink300,
										}}
									/>
								</View>
							</View>

							{c.status === "Active" && (
								<View
									style={{
										marginTop: 13,
										paddingTop: 13,
										borderTopWidth: 1,
										borderTopColor: Colors.lineSoft,
									}}
								>
									<Button
										variant="quiet"
										size="sm"
										onPress={() => toggleCoupon(c.id)}
										style={{ alignSelf: "flex-start" }}
									>
										Deactivate code
									</Button>
								</View>
							)}
						</Card>
					);
				})}
			</ScrollView>
		</View>
	);
}

// ---- Account / Profile & Settings sub-screen ----
export function AccountScreen() {
	const insets = useSafeAreaInsets();
	const qc = useQueryClient();
	const { business, setOverlay, setSheet } = useApp();
	const meQuery = useQuery({
		queryKey: ["auth", "me"],
		queryFn: () => api.auth.me(),
		staleTime: 60_000,
	});
	const authedUser = meQuery.data;
	const [push, setPush] = useState(true);
	const [email, setEmail] = useState(true);
	const [avatarUri, setAvatarUri] = useState<string | null>(null);

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

	async function pickAvatar() {
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

	const settingRow = (
		icon: string,
		label: string,
		control: React.ReactNode,
		i: number,
	) => (
		<View
			key={label}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 12,
				padding: 14,
				paddingHorizontal: 13,
				borderTopWidth: i ? 1 : 0,
				borderTopColor: Colors.lineSoft,
			}}
		>
			<Icon name={icon as IconName} size={18} color={Colors.primary600} />
			<Text
				style={{
					flex: 1,
					fontSize: 14.5,
					fontWeight: "500",
					color: Colors.ink900,
				}}
			>
				{label}
			</Text>
			{control}
		</View>
	);

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Profile & settings"
				onBack={() => setOverlay(null)}
				topInset={insets.top}
			/>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 4,
					paddingBottom: 32,
				}}
			>
				<Card pad={18} style={{ alignItems: "center" }}>
					<TouchableOpacity
						onPress={pickAvatar}
						style={{ position: "relative" }}
					>
						{avatarUri ? (
							<Image
								source={{ uri: avatarUri }}
								style={{ width: 68, height: 68, borderRadius: 34 }}
								contentFit="cover"
							/>
						) : (
							<Avatar
								name={business.owner.name}
								size={68}
								bg={Colors.primary900}
								fg="#fff"
							/>
						)}
						<View
							style={{
								position: "absolute",
								bottom: 0,
								right: 0,
								width: 24,
								height: 24,
								borderRadius: 12,
								backgroundColor: Colors.primary600,
								borderWidth: 2,
								borderColor: Colors.surface,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Icon name="Camera" size={12} color="#fff" />
						</View>
					</TouchableOpacity>
					<Text
						style={{
							fontSize: 18,
							fontWeight: "700",
							color: Colors.ink900,
							marginTop: 12,
						}}
					>
						{business.owner.name}
					</Text>
					<Text style={{ fontSize: 13.5, color: Colors.ink500, marginTop: 2 }}>
						{business.owner.email}
					</Text>
					<View style={{ marginTop: 12 }}>
						<Button
							variant="ghost"
							size="sm"
							icon="Pencil"
							onPress={() =>
								authedUser &&
								setSheet({
									type: "editProfile",
									userId: authedUser.id,
									name: business.owner.name,
									email: business.owner.email,
								})
							}
						>
							Edit profile
						</Button>
					</View>
				</Card>

				<Eyebrow
					color={Colors.ink400}
					style={{ marginTop: 22, marginBottom: 10 }}
				>
					Notifications
				</Eyebrow>
				<Card pad={4}>
					{settingRow(
						"Smartphone",
						"Push notifications",
						<ToggleSwitch on={push} onToggle={() => setPush(!push)} />,
						0,
					)}
					{settingRow(
						"Mail",
						"Email notifications",
						<ToggleSwitch on={email} onToggle={() => setEmail(!email)} />,
						1,
					)}
				</Card>

				<Eyebrow
					color={Colors.ink400}
					style={{ marginTop: 22, marginBottom: 10 }}
				>
					Preferences
				</Eyebrow>
				<Card pad={4}>
					{settingRow(
						"Globe",
						"Language · English",
						<Icon name="ChevronRight" size={18} color={Colors.ink300} />,
						0,
					)}
					{settingRow(
						"IndianRupee",
						"Currency · BDT (৳)",
						<Icon name="ChevronRight" size={18} color={Colors.ink300} />,
						1,
					)}
				</Card>

				{sessions.length > 0 && (
					<>
						<Eyebrow
							color={Colors.ink400}
							style={{ marginTop: 22, marginBottom: 10 }}
						>
							Active sessions
						</Eyebrow>
						<Card pad={4}>
							{sessions.map((s, i) => (
								<View
									key={s.id}
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 12,
										padding: 14,
										paddingHorizontal: 13,
										borderTopWidth: i ? 1 : 0,
										borderTopColor: Colors.lineSoft,
									}}
								>
									<Icon
										name="Smartphone"
										sizePx={18}
										color={Colors.primary600}
									/>
									<View style={{ flex: 1, minWidth: 0 }}>
										<Text
											style={{
												fontSize: 14.5,
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
											{new Date(s.lastUsedAt).toLocaleDateString("en-BD", {
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
						</Card>
					</>
				)}
			</ScrollView>
		</View>
	);
}

const styles = {
	branchAction: {
		width: 32,
		height: 32,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: Colors.line,
		backgroundColor: Colors.surface,
		alignItems: "center" as const,
		justifyContent: "center" as const,
	},
};

// ---- Help sub-screen ----
export function HelpScreen() {
	const insets = useSafeAreaInsets();
	const { setOverlay } = useApp();

	const topics = [
		{
			icon: "CalendarCheck",
			label: "Managing bookings",
			sub: "Confirm, cancel and view your schedule",
		},
		{
			icon: "Sparkles",
			label: "Your service menu",
			sub: "Add, edit and price services",
		},
		{
			icon: "MessageSquareQuote",
			label: "Moderating reviews",
			sub: "Approve genuine customer feedback",
		},
		{
			icon: "Ticket",
			label: "Coupons & offers",
			sub: "Create and track discount codes",
		},
	];

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Help & support"
				onBack={() => setOverlay(null)}
				topInset={insets.top}
			/>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 4,
					paddingBottom: 32,
				}}
			>
				<Eyebrow color={Colors.ink400} style={{ marginBottom: 10 }}>
					Guides
				</Eyebrow>
				<Card pad={4}>
					{topics.map((t, i) => (
						<TouchableOpacity
							key={t.label}
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 13,
								padding: 13,
								borderTopWidth: i ? 1 : 0,
								borderTopColor: Colors.lineSoft,
							}}
						>
							<View
								style={{
									width: 38,
									height: 38,
									borderRadius: Radius.sm,
									backgroundColor: Colors.primary50,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Icon
									name={t.icon as IconName}
									size={19}
									color={Colors.primary600}
								/>
							</View>
							<View style={{ flex: 1 }}>
								<Text
									style={{
										fontSize: 15,
										fontWeight: "600",
										color: Colors.ink900,
									}}
								>
									{t.label}
								</Text>
								<Text
									style={{ fontSize: 12.5, color: Colors.ink400, marginTop: 1 }}
								>
									{t.sub}
								</Text>
							</View>
							<Icon name="ChevronRight" size={19} color={Colors.ink300} />
						</TouchableOpacity>
					))}
				</Card>
				<View style={{ marginTop: 18 }}>
					<Button variant="subtle" full icon="MessageCircle">
						Contact Talash support
					</Button>
				</View>
			</ScrollView>
		</View>
	);
}
