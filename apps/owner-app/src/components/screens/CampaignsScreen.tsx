import type {
	Campaign,
	CampaignChannel,
	CampaignSegment,
} from "@repo/api-client";
import { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import {
	useCampaigns,
	useCreateCampaign,
	useCustomers,
	useDeleteCampaign,
	useSendCampaign,
	useUpdateCampaign,
} from "../../hooks/useOwnerData";
import { Colors, Radius } from "../../tokens";
import {
	BackHeader,
	Button,
	Card,
	Empty,
	FilterTabs,
	Icon,
	Sheet,
	StatusPill,
} from "../ui";

const SEGMENT_LABELS: Record<CampaignSegment, string> = {
	All: "All customers",
	VIP: "VIP",
	Regular: "Regular",
	New: "New",
	AtRisk: "At risk",
};

const SEGMENTS: CampaignSegment[] = ["All", "VIP", "Regular", "New", "AtRisk"];
const CHANNELS: CampaignChannel[] = ["Email", "SMS", "Push"];

function parseChannels(raw: string): string[] {
	try {
		return JSON.parse(raw) as string[];
	} catch {
		return [];
	}
}

function CampaignForm({
	businessId,
	initial,
	customers,
	onClose,
}: {
	businessId: string;
	initial?: Campaign;
	customers: { tier: string }[];
	onClose: () => void;
}) {
	const createMut = useCreateCampaign();
	const updateMut = useUpdateCampaign(businessId);
	const [name, setName] = useState(initial?.name ?? "");
	const [segment, setSegment] = useState<CampaignSegment>(
		initial?.segment ?? "All",
	);
	const [channels, setChannels] = useState<CampaignChannel[]>(
		initial
			? (parseChannels(initial.channels) as CampaignChannel[])
			: ["Email"],
	);
	const [message, setMessage] = useState(initial?.message ?? "");
	const [error, setError] = useState("");

	const recipientCount =
		segment === "All"
			? customers.length
			: customers.filter((c) => c.tier === segment).length;

	function toggleChannel(ch: CampaignChannel) {
		setChannels((prev) =>
			prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
		);
	}

	function save() {
		if (!name.trim()) {
			setError("Campaign name is required.");
			return;
		}
		setError("");
		const body = { name: name.trim(), segment, channels, message };
		if (initial) {
			updateMut.mutate(
				{ id: initial.id, body },
				{ onSuccess: onClose, onError: (e: Error) => setError(e.message) },
			);
		} else {
			createMut.mutate(
				{ businessId, ...body },
				{ onSuccess: onClose, onError: (e: Error) => setError(e.message) },
			);
		}
	}

	const pending = createMut.isPending || updateMut.isPending;

	return (
		<Sheet
			visible
			title={initial ? "Edit campaign" : "Create campaign"}
			onClose={onClose}
			footer={
				<View style={{ flexDirection: "row", gap: 10 }}>
					<Button variant="ghost" full onPress={onClose}>
						Cancel
					</Button>
					<Button variant="primary" full disabled={pending} onPress={save}>
						{pending ? "Saving…" : initial ? "Save changes" : "Save as draft"}
					</Button>
				</View>
			}
		>
			<View style={{ gap: 14 }}>
				{!!error && (
					<Text style={{ fontSize: 13.5, color: Colors.dangerFg }}>
						{error}
					</Text>
				)}
				<TextFieldBlock
					label="Campaign name"
					value={name}
					onChangeText={setName}
					placeholder="Summer win-back offer"
				/>
				<View>
					<Text style={labelStyle}>Audience</Text>
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							gap: 8,
							marginTop: 8,
						}}
					>
						{SEGMENTS.map((s) => (
							<Chip
								key={s}
								active={segment === s}
								onPress={() => setSegment(s)}
								label={SEGMENT_LABELS[s]}
							/>
						))}
					</View>
				</View>
				<View>
					<Text style={labelStyle}>Channels</Text>
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							gap: 8,
							marginTop: 8,
						}}
					>
						{CHANNELS.map((ch) => (
							<Chip
								key={ch}
								active={channels.includes(ch)}
								onPress={() => toggleChannel(ch)}
								label={ch}
							/>
						))}
					</View>
				</View>
				<TextFieldBlock
					label="Message"
					value={message}
					onChangeText={setMessage}
					placeholder="Write your message…"
					multiline
				/>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 8,
						padding: 12,
						borderRadius: Radius.md,
						backgroundColor: Colors.primary50,
					}}
				>
					<Icon name="Users" sizePx={16} color={Colors.primary700} />
					<Text
						style={{
							fontSize: 13.5,
							fontWeight: "600",
							color: Colors.primary700,
						}}
					>
						Sending to {recipientCount} customer
						{recipientCount !== 1 ? "s" : ""}
					</Text>
				</View>
			</View>
		</Sheet>
	);
}

const labelStyle = {
	fontSize: 13.5,
	fontWeight: "600" as const,
	color: Colors.ink700,
};

function TextFieldBlock({
	label,
	value,
	onChangeText,
	placeholder,
	multiline,
}: {
	label: string;
	value: string;
	onChangeText: (t: string) => void;
	placeholder?: string;
	multiline?: boolean;
}) {
	return (
		<View>
			<Text style={labelStyle}>{label}</Text>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={Colors.ink400}
				multiline={multiline}
				style={{
					marginTop: 8,
					padding: 13,
					borderRadius: Radius.md,
					borderWidth: 1,
					borderColor: Colors.lineStrong,
					backgroundColor: Colors.surface,
					fontSize: 15,
					color: Colors.ink900,
					minHeight: multiline ? 96 : undefined,
					textAlignVertical: multiline ? "top" : "center",
				}}
			/>
		</View>
	);
}

function Chip({
	active,
	onPress,
	label,
}: {
	active: boolean;
	onPress: () => void;
	label: string;
}) {
	return (
		<TouchableOpacity
			onPress={onPress}
			style={{
				paddingHorizontal: 12,
				paddingVertical: 8,
				borderRadius: Radius.md,
				backgroundColor: active ? Colors.primary600 : Colors.primary50,
			}}
		>
			<Text
				style={{
					fontSize: 12.5,
					fontWeight: "600",
					color: active ? "#fff" : Colors.ink700,
				}}
			>
				{label}
			</Text>
		</TouchableOpacity>
	);
}

export default function CampaignsScreen() {
	const insets = useSafeAreaInsets();
	const { businessId, setOverlay } = useApp();
	const [tab, setTab] = useState("All");
	const [showCreate, setShowCreate] = useState(false);
	const [editing, setEditing] = useState<Campaign | null>(null);

	const campaignsQ = useCampaigns(businessId);
	const customersQ = useCustomers(businessId);
	const sendMut = useSendCampaign(businessId);
	const deleteMut = useDeleteCampaign(businessId);

	const all = campaignsQ.data ?? [];
	const customers = customersQ.data ?? [];
	const filtered = tab === "All" ? all : all.filter((c) => c.status === tab);
	const counts = {
		All: all.length,
		Draft: all.filter((c) => c.status === "Draft").length,
		Sent: all.filter((c) => c.status === "Sent").length,
	};

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Campaigns"
				onBack={() => setOverlay(null)}
				action="Create"
				actionIcon="Plus"
				onAction={() => setShowCreate(true)}
				topInset={insets.top}
			/>

			<View style={{ paddingTop: 12, paddingHorizontal: 16 }}>
				<FilterTabs
					tabs={[
						{ id: "All", label: "All" },
						{ id: "Draft", label: "Draft", count: counts.Draft },
						{ id: "Sent", label: "Sent" },
					]}
					active={tab}
					onPick={setTab}
				/>
			</View>

			<ScrollView
				contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
			>
				{campaignsQ.isLoading ? (
					<ActivityIndicator
						color={Colors.primary600}
						style={{ marginTop: 24 }}
					/>
				) : filtered.length === 0 ? (
					<Empty
						icon="Megaphone"
						title="No campaigns yet"
						body="Create a draft campaign to reach your customers."
					/>
				) : (
					filtered.map((c) => {
						const chans = parseChannels(c.channels);
						return (
							<Card key={c.id} pad={16}>
								<View
									style={{
										flexDirection: "row",
										alignItems: "flex-start",
										gap: 12,
									}}
								>
									<View
										style={{
											width: 40,
											height: 40,
											borderRadius: Radius.sm,
											backgroundColor: Colors.primary50,
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<Icon
											name="Megaphone"
											sizePx={20}
											color={Colors.primary600}
										/>
									</View>
									<View style={{ flex: 1, minWidth: 0 }}>
										<View
											style={{
												flexDirection: "row",
												flexWrap: "wrap",
												alignItems: "center",
												gap: 8,
											}}
										>
											<Text
												style={{
													fontSize: 15.5,
													fontWeight: "700",
													color: Colors.ink900,
												}}
											>
												{c.name}
											</Text>
											<StatusPill status={c.status} size="sm" />
										</View>
										<Text
											style={{
												fontSize: 12.5,
												color: Colors.ink500,
												marginTop: 4,
											}}
										>
											{SEGMENT_LABELS[c.segment]}
											{chans.length ? ` · ${chans.join(", ")}` : ""}
										</Text>
										{!!c.message && (
											<Text
												style={{
													fontSize: 13.5,
													color: Colors.ink600,
													marginTop: 8,
													lineHeight: 20,
												}}
												numberOfLines={2}
											>
												{c.message}
											</Text>
										)}
										{c.status === "Sent" && c.sentAt && (
											<Text
												style={{
													fontSize: 12,
													color: Colors.ink400,
													marginTop: 6,
												}}
											>
												Sent{" "}
												{new Date(c.sentAt).toLocaleDateString("en-BD", {
													day: "numeric",
													month: "short",
													year: "numeric",
												})}
												{c.recipientCount
													? ` · ${c.recipientCount} recipients`
													: ""}
											</Text>
										)}
									</View>
								</View>
								<View
									style={{
										flexDirection: "row",
										gap: 8,
										marginTop: 14,
										paddingTop: 14,
										borderTopWidth: 1,
										borderTopColor: Colors.lineSoft,
									}}
								>
									{c.status === "Draft" && (
										<>
											<Button
												variant="ghost"
												size="sm"
												icon="Pencil"
												onPress={() => setEditing(c)}
											>
												Edit
											</Button>
											<Button
												variant="primary"
												size="sm"
												icon="Send"
												disabled={sendMut.isPending}
												onPress={() => {
													Alert.alert(
														"Send campaign?",
														`Send "${c.name}" to your ${SEGMENT_LABELS[c.segment].toLowerCase()} segment?`,
														[
															{ text: "Cancel", style: "cancel" },
															{
																text: "Send",
																onPress: () => sendMut.mutate(c.id),
															},
														],
													);
												}}
											>
												Send
											</Button>
										</>
									)}
									<Button
										variant="quiet"
										size="sm"
										icon="Trash2"
										onPress={() => {
											Alert.alert("Delete campaign?", c.name, [
												{ text: "Cancel", style: "cancel" },
												{
													text: "Delete",
													style: "destructive",
													onPress: () => deleteMut.mutate(c.id),
												},
											]);
										}}
									>
										Delete
									</Button>
								</View>
							</Card>
						);
					})
				)}
			</ScrollView>

			{showCreate && businessId && (
				<CampaignForm
					businessId={businessId}
					customers={customers}
					onClose={() => setShowCreate(false)}
				/>
			)}
			{editing && businessId && (
				<CampaignForm
					businessId={businessId}
					initial={editing}
					customers={customers}
					onClose={() => setEditing(null)}
				/>
			)}
		</View>
	);
}
