"use client";
import type {
	Campaign,
	CampaignChannel,
	CampaignSegment,
	CustomerSummary,
} from "@repo/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { cn } from "../../lib/cn";
import {
	Button,
	Card,
	Empty,
	Field,
	Icon,
	inputClass,
	Modal,
	PageHeader,
	StatusPill,
	Tabs,
} from "../primitives";

const SEGMENT_CLASSES: Record<CampaignSegment, string> = {
	All: "bg-primary-100 text-primary-700",
	VIP: "bg-gold-100 text-gold-700",
	Regular: "bg-info-bg text-info-fg",
	New: "bg-success-bg text-success-fg",
	AtRisk: "bg-danger-bg text-danger-fg",
};

const SEGMENT_LABELS: Record<CampaignSegment, string> = {
	All: "All customers",
	VIP: "VIP",
	Regular: "Regular",
	New: "New",
	AtRisk: "At risk",
};

function SegmentBadge({ segment }: { segment: CampaignSegment }) {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEGMENT_CLASSES[segment]}`}
		>
			{SEGMENT_LABELS[segment]}
		</span>
	);
}

function CampaignBuilder({
	businessId,
	customers,
	onClose,
}: {
	businessId: string;
	customers: CustomerSummary[];
	onClose: () => void;
}) {
	const qc = useQueryClient();
	const [name, setName] = useState("");
	const [segment, setSegment] = useState<CampaignSegment>("All");
	const [channels, setChannels] = useState<CampaignChannel[]>(["Email"]);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	const recipientCount =
		segment === "All"
			? customers.length
			: customers.filter((c) => c.tier === segment).length;

	const createMut = useMutation({
		mutationFn: () =>
			api.campaigns.create({ businessId, name, segment, channels, message }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["campaigns", businessId] });
			onClose();
		},
		onError: (e: Error) => setError(e.message),
	});

	function toggleChannel(ch: CampaignChannel) {
		setChannels((prev) =>
			prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
		);
	}

	const CHANNEL_OPTS: CampaignChannel[] = ["Email", "SMS", "Push"];
	const SEGMENT_OPTS: CampaignSegment[] = [
		"All",
		"VIP",
		"Regular",
		"New",
		"AtRisk",
	];

	return (
		<Modal
			title="Create campaign"
			sub="Build and send a targeted message to your customers"
			onClose={onClose}
			width={500}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={() => {
							if (!name.trim()) {
								setError("Campaign name is required.");
								return;
							}
							createMut.mutate();
						}}
						disabled={createMut.isPending}
					>
						Save as draft
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4">
				{error && <p className="text-sm text-danger-fg m-0">{error}</p>}
				<Field label="Campaign name">
					<input
						className={inputClass}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Summer win-back offer"
					/>
				</Field>
				<Field label="Audience segment">
					<div className="flex flex-wrap gap-2">
						{SEGMENT_OPTS.map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => setSegment(s)}
								className={[
									"px-3 py-1.5 rounded-md text-xs font-semibold border-none cursor-pointer",
									segment === s
										? "bg-primary-600 text-white"
										: "bg-primary-50 text-ink-700",
								].join(" ")}
							>
								{SEGMENT_LABELS[s]}
							</button>
						))}
					</div>
				</Field>
				<Field label="Channels">
					<div className="flex gap-2">
						{CHANNEL_OPTS.map((ch) => {
							const active = channels.includes(ch);
							return (
								<button
									key={ch}
									type="button"
									onClick={() => toggleChannel(ch)}
									className={[
										"px-3 py-1.5 rounded-md text-xs font-semibold border-none cursor-pointer",
										active
											? "bg-primary-600 text-white"
											: "bg-primary-50 text-ink-700",
									].join(" ")}
								>
									{ch}
								</button>
							);
						})}
					</div>
				</Field>
				<Field label="Message">
					<textarea
						className={cn(inputClass, "min-h-[96px] resize-y")}
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						placeholder="Write your message to customers…"
					/>
				</Field>
				<div className="flex items-center gap-2 bg-primary-50 rounded-md px-4 py-3">
					<Icon name="Users" size={16} className="text-primary-700" />
					<span className="text-sm font-semibold text-primary-700">
						Sending to {recipientCount} customer
						{recipientCount !== 1 ? "s" : ""}
					</span>
				</div>
			</div>
		</Modal>
	);
}

interface CampaignsScreenProps {
	businessId: string | null;
}

export function CampaignsScreen({ businessId }: CampaignsScreenProps) {
	const qc = useQueryClient();
	const [tab, setTab] = useState("All");
	const [showBuilder, setShowBuilder] = useState(false);
	const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

	const campaignsQ = useQuery({
		queryKey: ["campaigns", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.campaigns.list({ businessId: businessId! }),
		enabled: !!businessId,
		staleTime: 30_000,
	});

	const customersQ = useQuery({
		queryKey: ["customers", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.customers.list({ businessId: businessId! }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const sendMut = useMutation({
		mutationFn: (id: string) => api.campaigns.send(id, { businessId: businessId! }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns", businessId] }),
	});

	const deleteMut = useMutation({
		mutationFn: (id: string) => api.campaigns.delete(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns", businessId] }),
	});

	const all = campaignsQ.data ?? [];
	const customers = customersQ.data ?? [];

	const tabFilter: Record<string, Campaign["status"] | "All"> = {
		All: "All",
		Draft: "Draft",
		Sent: "Sent",
	};
	const filtered =
		tab === "All" ? all : all.filter((c) => c.status === tabFilter[tab]);

	const tabCounts = {
		All: all.length,
		Draft: all.filter((c) => c.status === "Draft").length,
		Sent: all.filter((c) => c.status === "Sent").length,
	};

	return (
		<div>
			<PageHeader
				eyebrow="Campaigns"
				title="Targeted outreach"
				sub="Send messages to specific customer segments"
				actions={
					<Button icon="Plus" onClick={() => setShowBuilder(true)}>
						Create campaign
					</Button>
				}
			/>

			{/* Stats */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
				{[
					{ label: "Total campaigns", value: all.length, icon: "Megaphone" },
					{
						label: "Sent",
						value: all.filter((c) => c.status === "Sent").length,
						icon: "Send",
					},
					{
						label: "Customers reached",
						value: all
							.filter((c) => c.status === "Sent")
							.reduce((s, c) => s + Number(c.recipientCount ?? 0), 0),
						icon: "Users",
					},
				].map((s) => (
					<Card key={s.label} padding="sm" className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-ink-500">
								{s.label}
							</span>
							<span className="w-7 h-7 rounded-sm bg-primary-50 flex items-center justify-center">
								<Icon name={s.icon} size={16} className="text-primary-600" />
							</span>
						</div>
						<span className="font-serif text-[32px] font-medium tracking-tight text-ink-900">
							{s.value}
						</span>
					</Card>
				))}
			</div>

			{/* Tabs + list */}
			<div className="mb-4">
				<Tabs
					tabs={["All", "Draft", "Sent"]}
					active={tab}
					onChange={setTab}
					counts={tabCounts}
				/>
			</div>

			<div className="flex flex-col gap-3">
				{filtered.length === 0 ? (
					<Card padding="lg">
						<Empty
							icon="Megaphone"
							text="No campaigns yet. Create your first one above."
						/>
					</Card>
				) : (
					filtered.map((c) => {
						const chans = (() => {
							try {
								return JSON.parse(c.channels) as string[];
							} catch {
								return [];
							}
						})();
						return (
							<Card key={c.id} padding="sm">
								<div className="flex items-start gap-4 justify-between">
									<div className="flex items-start gap-3 min-w-0">
										<div className="w-10 h-10 rounded-md bg-primary-50 flex items-center justify-center shrink-0 mt-0.5">
											<Icon
												name="Megaphone"
												size={20}
												className="text-primary-600"
											/>
										</div>
										<div className="min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<span className="font-semibold text-ink-900">
													{c.name}
												</span>
												<SegmentBadge segment={c.segment} />
												<StatusPill status={c.status} />
											</div>
											{chans.length > 0 && (
												<div className="text-xs text-ink-500 mt-1">
													{chans.join(", ")}
												</div>
											)}
											{c.message && (
												<p className="text-sm text-ink-600 mt-2 mb-0 line-clamp-2">
													{c.message}
												</p>
											)}
											{c.status === "Sent" && c.sentAt && (
												<div className="text-xs text-ink-400 mt-1.5">
													Sent{" "}
													{new Date(c.sentAt).toLocaleDateString("en-IN", {
														day: "numeric",
														month: "short",
														year: "numeric",
													})}
													{c.recipientCount
														? ` · ${c.recipientCount} recipients`
														: ""}
												</div>
											)}
										</div>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										{c.status === "Draft" && (
											<>
												<Button
													variant="quiet"
													size="sm"
													icon="Pencil"
													onClick={() => setEditingCampaign(c)}
												/>
												<Button
													variant="subtle"
													size="sm"
													icon="Send"
													onClick={() => sendMut.mutate(c.id)}
													disabled={sendMut.isPending}
												>
													Send
												</Button>
											</>
										)}
										<Button
											variant="quiet"
											size="sm"
											icon="Trash2"
											onClick={() => deleteMut.mutate(c.id)}
											disabled={deleteMut.isPending}
										/>
									</div>
								</div>
							</Card>
						);
					})
				)}
			</div>

			{showBuilder && businessId && (
				<CampaignBuilder
					businessId={businessId}
					customers={customers}
					onClose={() => setShowBuilder(false)}
				/>
			)}

			{editingCampaign && businessId && (
				<EditCampaignModal
					campaign={editingCampaign}
					businessId={businessId}
					customers={customers}
					onClose={() => setEditingCampaign(null)}
				/>
			)}
		</div>
	);
}

function EditCampaignModal({
	campaign,
	businessId,
	customers,
	onClose,
}: {
	campaign: Campaign;
	businessId: string;
	customers: CustomerSummary[];
	onClose: () => void;
}) {
	const qc = useQueryClient();
	const [name, setName] = useState(campaign.name);
	const [segment, setSegment] = useState<CampaignSegment>(campaign.segment);
	const [channels, setChannels] = useState<CampaignChannel[]>(
		(() => {
			try {
				return JSON.parse(campaign.channels) as CampaignChannel[];
			} catch {
				return ["Email"];
			}
		})(),
	);
	const [message, setMessage] = useState(campaign.message ?? "");
	const [error, setError] = useState("");

	const recipientCount =
		segment === "All"
			? customers.length
			: customers.filter((c) => c.tier === segment).length;

	const updateMut = useMutation({
		mutationFn: () =>
			api.campaigns.update(campaign.id, { name, segment, channels, message }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["campaigns", businessId] });
			onClose();
		},
		onError: (e: Error) => setError(e.message),
	});

	function toggleChannel(ch: CampaignChannel) {
		setChannels((prev) =>
			prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
		);
	}

	const CHANNEL_OPTS: CampaignChannel[] = ["Email", "SMS", "Push"];
	const SEGMENT_OPTS: CampaignSegment[] = [
		"All",
		"VIP",
		"Regular",
		"New",
		"AtRisk",
	];

	return (
		<Modal
			title="Edit campaign"
			sub="Changes will be saved as a draft."
			onClose={onClose}
			width={500}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={() => {
							if (!name.trim()) {
								setError("Campaign name is required.");
								return;
							}
							updateMut.mutate();
						}}
						disabled={updateMut.isPending}
					>
						Save changes
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4">
				{error && <p className="text-sm text-danger-fg m-0">{error}</p>}
				<Field label="Campaign name">
					<input
						className={inputClass}
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				</Field>
				<Field label="Audience segment">
					<div className="flex flex-wrap gap-2">
						{SEGMENT_OPTS.map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => setSegment(s)}
								className={[
									"px-3 py-1.5 rounded-md text-xs font-semibold border-none cursor-pointer",
									segment === s
										? "bg-primary-600 text-white"
										: "bg-primary-50 text-ink-700",
								].join(" ")}
							>
								{SEGMENT_LABELS[s]}
							</button>
						))}
					</div>
				</Field>
				<Field label="Channels">
					<div className="flex gap-2">
						{CHANNEL_OPTS.map((ch) => {
							const active = channels.includes(ch);
							return (
								<button
									key={ch}
									type="button"
									onClick={() => toggleChannel(ch)}
									className={[
										"px-3 py-1.5 rounded-md text-xs font-semibold border-none cursor-pointer",
										active
											? "bg-primary-600 text-white"
											: "bg-primary-50 text-ink-700",
									].join(" ")}
								>
									{ch}
								</button>
							);
						})}
					</div>
				</Field>
				<Field label="Message">
					<textarea
						className={cn(inputClass, "min-h-[96px] resize-y")}
						value={message}
						onChange={(e) => setMessage(e.target.value)}
					/>
				</Field>
				<div className="flex items-center gap-2 bg-primary-50 rounded-md px-4 py-3">
					<Icon name="Users" size={16} className="text-primary-700" />
					<span className="text-sm font-semibold text-primary-700">
						Sending to {recipientCount} customer
						{recipientCount !== 1 ? "s" : ""}
					</span>
				</div>
			</div>
		</Modal>
	);
}
