import type {
	WalkInBranchQrResponse,
	WalkInSessionResponse,
} from "@repo/api-client";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	Switch,
	Text,
	View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "../../components/ScreenContainer";
import { BackHeader, BranchSwitcher, Button, Card } from "../../components/ui";
import { useWalkInHub } from "../../components/WalkInHubProvider";
import { useApp } from "../../context";
import { api } from "../../lib/api";
import { Colors, Radius } from "../../tokens";

function QrBlock({
	label,
	subtitle,
	value,
}: {
	label: string;
	subtitle: string;
	value: string;
}) {
	return (
		<Card pad={20} style={{ gap: 14, alignItems: "center" }}>
			<View style={{ alignSelf: "stretch", gap: 4 }}>
				<Text
					style={{
						fontSize: 16,
						fontWeight: "600",
						color: Colors.ink900,
					}}
				>
					{label}
				</Text>
				<Text style={{ fontSize: 13.5, color: Colors.ink500, lineHeight: 19 }}>
					{subtitle}
				</Text>
			</View>
			<View
				style={{
					padding: 16,
					borderRadius: Radius.lg,
					backgroundColor: Colors.surface,
					borderWidth: 1,
					borderColor: Colors.line,
				}}
			>
				<QRCode value={value} size={200} />
			</View>
		</Card>
	);
}

const HUB_STATUS_LABEL: Record<
	ReturnType<typeof useWalkInHub>["hubStatus"],
	string
> = {
	inactive: "Off",
	starting: "Starting…",
	broadcasting: "Broadcasting on Wi‑Fi",
	unavailable: "LAN unavailable (dev build required)",
};

export default function WalkInModeScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { branch, setBranch, business, apiBranches, flash } = useApp();
	const { walkInModeActive, setWalkInModeActive, hubStatus } = useWalkInHub();
	const [branchQr, setBranchQr] = useState<WalkInBranchQrResponse | null>(null);
	const [sessionQr, setSessionQr] = useState<WalkInSessionResponse | null>(
		null,
	);
	const [loadingBranchQr, setLoadingBranchQr] = useState(false);
	const [creatingSession, setCreatingSession] = useState(false);

	const branchId = useMemo(() => {
		if (branch === "All branches") return null;
		return apiBranches.find((b) => b.name === branch)?.id ?? null;
	}, [apiBranches, branch]);

	const branchLabel = branch === "All branches" ? "Select a branch" : branch;

	const loadBranchQr = useCallback(
		async (id: string) => {
			setLoadingBranchQr(true);
			setBranchQr(null);
			setSessionQr(null);
			try {
				const res = await api.walkIn.regenerateBranchQr(id);
				setBranchQr(res);
			} catch {
				flash("Could not load branch QR. Try again.");
			} finally {
				setLoadingBranchQr(false);
			}
		},
		[flash],
	);

	useEffect(() => {
		if (!branchId) {
			setBranchQr(null);
			setSessionQr(null);
			return;
		}
		void loadBranchQr(branchId);
	}, [branchId, loadBranchQr]);

	const createSession = async () => {
		if (!branchId) return;
		setCreatingSession(true);
		try {
			const res = await api.walkIn.createSession(branchId);
			setSessionQr(res);
		} catch {
			flash("Could not create session QR. Try again.");
		} finally {
			setCreatingSession(false);
		}
	};

	const sessionExpiry =
		sessionQr &&
		new Date(sessionQr.expiresAt).toLocaleTimeString([], {
			hour: "numeric",
			minute: "2-digit",
		});

	return (
		<ScreenContainer>
			<View className="flex-1 bg-paper">
				<BackHeader
					title="Walk-in"
					onBack={() => router.back()}
					topInset={insets.top}
				/>
				<ScrollView
					contentContainerStyle={{
						padding: 16,
						paddingBottom: insets.bottom + 32,
						gap: 16,
					}}
					showsVerticalScrollIndicator={false}
				>
					<BranchSwitcher
						branches={business.branches}
						active={branch}
						onPick={setBranch}
					/>

					<Card pad={16} style={{ gap: 10 }}>
						<View className="flex-row items-center justify-between">
							<View style={{ flex: 1, paddingRight: 12 }}>
								<Text
									style={{
										fontSize: 15,
										fontWeight: "600",
										color: Colors.ink900,
									}}
								>
									Walk-in mode
								</Text>
								<Text
									style={{
										marginTop: 4,
										fontSize: 13,
										color: Colors.ink500,
										lineHeight: 18,
									}}
								>
									Broadcasts this branch on local Wi‑Fi when mobile data is
									unavailable.
								</Text>
							</View>
							<Switch
								value={walkInModeActive}
								onValueChange={setWalkInModeActive}
								disabled={!branchId}
								trackColor={{
									false: Colors.line,
									true: Colors.primary300,
								}}
								thumbColor={
									walkInModeActive ? Colors.primary600 : Colors.surface
								}
							/>
						</View>
						{walkInModeActive && (
							<Text
								style={{
									fontSize: 12.5,
									fontWeight: "600",
									color:
										hubStatus === "broadcasting"
											? Colors.primary700
											: Colors.pending,
								}}
							>
								{HUB_STATUS_LABEL[hubStatus]}
							</Text>
						)}
					</Card>

					<Text style={{ fontSize: 14, color: Colors.ink600 }}>
						Customers scan these codes to book or order at{" "}
						<Text style={{ fontWeight: "600", color: Colors.ink800 }}>
							{branchLabel}
						</Text>
						.
					</Text>

					{!branchId ? (
						<Card pad={20}>
							<Text
								style={{
									fontSize: 14,
									color: Colors.ink500,
									textAlign: "center",
									lineHeight: 20,
								}}
							>
								Choose a branch above to show its walk-in QR codes.
							</Text>
						</Card>
					) : loadingBranchQr ? (
						<Card pad={32} style={{ alignItems: "center" }}>
							<ActivityIndicator color={Colors.primary600} />
							<Text
								style={{
									marginTop: 12,
									fontSize: 14,
									color: Colors.ink500,
								}}
							>
								Generating branch QR…
							</Text>
						</Card>
					) : branchQr ? (
						<QrBlock
							label="Branch QR"
							subtitle="Permanent code for this branch. Regenerating invalidates the previous one."
							value={branchQr.universalUrl}
						/>
					) : null}

					{branchId && branchQr ? (
						<>
							<Button
								variant="primary"
								icon="QrCode"
								onPress={createSession}
								disabled={creatingSession}
							>
								{creatingSession
									? "Creating session…"
									: "Create session QR (15 min)"}
							</Button>

							{sessionQr ? (
								<QrBlock
									label="Session QR"
									subtitle={`Valid until ${sessionExpiry}. Use for one customer visit.`}
									value={sessionQr.universalUrl}
								/>
							) : null}
						</>
					) : null}
				</ScrollView>
			</View>
		</ScreenContainer>
	);
}
