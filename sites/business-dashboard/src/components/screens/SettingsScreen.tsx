"use client";
import type { BranchHours, BusinessPhoto } from "@repo/api-client";
import Image from "next/image";
import { useRef, useState } from "react";
import { useToast } from "../../context/toast";
import { useBranchHours, useUpsertBranchHours } from "../../hooks/useOwnerData";
import { cn } from "../../lib/cn";
import type { Branch } from "../data";
import {
	Button,
	Card,
	Field,
	Icon,
	inputClass,
	Modal,
	PageHeader,
} from "../primitives";

interface SettingsScreenProps {
	status: string;
	onStatus: (s: string) => void;
	branches: Branch[];
	onAddBranch: (b: Branch) => void;
	onEditBranch: (
		id: string,
		body: Partial<Pick<Branch, "name" | "address" | "city" | "phone">>,
	) => void;
	onDeleteBranch: (id: string) => void;
	onUploadPhoto: (file: File) => void;
	onDeletePhoto?: (photoId: string) => void;
	onReorderPhoto?: (photoId: string, direction: -1 | 1) => void;
	photos?: BusinessPhoto[];
	businessName?: string;
	businessCategory?: string;
	businessDescription?: string;
	businessPhone?: string;
	businessEmail?: string;
	businessWebsite?: string;
	onSaveProfile: (
		name: string,
		category: string,
		description: string,
		phone: string,
		email: string,
		website: string,
	) => void;
	savingProfile?: boolean;
	onDeleteBusiness?: () => void;
}

function StatusToggle({
	status,
	onStatus,
}: {
	status: string;
	onStatus: (s: string) => void;
}) {
	return (
		<div className="inline-flex gap-0.5 p-1 bg-primary-50 rounded-md">
			{["Draft", "Active"].map((s) => {
				const on = s === status;
				return (
					<button
						key={s}
						type="button"
						onClick={() => onStatus(s)}
						className={[
							"inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm border-none cursor-pointer",
							"font-sans text-xs font-semibold transition-all duration-fast",
							on
								? `bg-surface shadow-xs ${s === "Active" ? "text-success-fg" : "text-ink-700"}`
								: "bg-transparent text-ink-500",
						].join(" ")}
					>
						{s === "Active" && on && (
							<span className="w-1.5 h-1.5 rounded-full bg-success" />
						)}
						{s}
					</button>
				);
			})}
		</div>
	);
}

export function SettingsScreen({
	status,
	onStatus,
	branches,
	onAddBranch,
	onEditBranch,
	onDeleteBranch,
	onUploadPhoto,
	onDeletePhoto,
	onReorderPhoto,
	photos = [],
	businessName,
	businessCategory,
	businessDescription,
	businessPhone,
	businessEmail,
	businessWebsite,
	onSaveProfile,
	savingProfile,
	onDeleteBusiness,
}: SettingsScreenProps) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [addingBranch, setAddingBranch] = useState(false);
	const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
	const [managingHoursId, setManagingHoursId] = useState<string | null>(null);
	const [name, setName] = useState(businessName ?? "");
	const [category, setCategory] = useState(businessCategory ?? "");
	const [description, setDescription] = useState(businessDescription ?? "");
	const [phone, setPhone] = useState(businessPhone ?? "");
	const [email, setEmail] = useState(businessEmail ?? "");
	const [website, setWebsite] = useState(businessWebsite ?? "");

	// Sync if props arrive after mount
	const [synced, setSynced] = useState(false);
	if (
		!synced &&
		(businessName ||
			businessCategory ||
			businessDescription ||
			businessPhone ||
			businessEmail ||
			businessWebsite)
	) {
		setName(businessName ?? "");
		setCategory(businessCategory ?? "");
		setDescription(businessDescription ?? "");
		setPhone(businessPhone ?? "");
		setEmail(businessEmail ?? "");
		setWebsite(businessWebsite ?? "");
		setSynced(true);
	}

	return (
		<div>
			<PageHeader
				eyebrow="Configure"
				title="Business settings"
				sub="Your public profile, branches and photos."
			/>

			{/* Profile */}
			<Card className="mb-[18px]">
				<div className="flex items-start justify-between gap-4 mb-4">
					<div>
						<h3 className="m-0 text-base font-bold text-ink-900">Profile</h3>
						<p className="mt-1 mb-0 text-sm text-ink-500">
							What customers see on your public page.
						</p>
					</div>
					<StatusToggle status={status} onStatus={onStatus} />
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
					<Field label="Business name">
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Your business name"
							className={inputClass}
						/>
					</Field>
					<Field label="Category">
						<input
							value={category}
							onChange={(e) => setCategory(e.target.value)}
							placeholder="e.g. Spa & massage"
							className={inputClass}
						/>
					</Field>
				</div>
				<Field label="Description">
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Tell customers what makes your business special…"
						rows={3}
						className={cn(inputClass, "resize-none leading-[1.55]")}
					/>
				</Field>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
					<Field label="Phone">
						<input
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							placeholder="+880 1x…"
							className={inputClass}
						/>
					</Field>
					<Field label="Email">
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="contact@example.com"
							className={inputClass}
						/>
					</Field>
					<Field label="Website">
						<input
							value={website}
							onChange={(e) => setWebsite(e.target.value)}
							placeholder="https://…"
							className={inputClass}
						/>
					</Field>
				</div>
				<div className="mt-4 flex justify-end">
					<Button
						size="sm"
						disabled={savingProfile || !name.trim()}
						onClick={() =>
							onSaveProfile(
								name.trim(),
								category.trim(),
								description.trim(),
								phone.trim(),
								email.trim(),
								website.trim(),
							)
						}
					>
						{savingProfile ? "Saving…" : "Save profile"}
					</Button>
				</div>
			</Card>

			{/* Photos */}
			<Card className="mb-[18px]">
				<div className="flex items-baseline justify-between mb-3.5">
					<div>
						<h3 className="m-0 text-base font-bold text-ink-900">Photos</h3>
						<p className="mt-1 mb-0 text-sm text-ink-500">
							The first photo is your cover.
						</p>
					</div>
				</div>
				<div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
					{/* Existing photos */}
					{photos.map((photo, i) => (
						<div
							key={photo.id}
							className="relative aspect-4/3 group rounded-md overflow-hidden bg-line"
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<Image
								src={photo.url}
								alt={`Business photo ${i + 1}`}
								className="w-full h-full object-cover"
							/>
							{i === 0 && (
								<span className="absolute top-1 left-1 text-[10px] font-semibold bg-primary-900/80 text-white rounded px-1.5 py-0.5">
									Cover
								</span>
							)}
							{onDeletePhoto && (
								<button
									type="button"
									onClick={() => onDeletePhoto(photo.id)}
									className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
									title="Delete photo"
								>
									<Icon name="X" size={12} />
								</button>
							)}
							{onReorderPhoto && (
								<div className="absolute bottom-1 left-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
									{i > 0 && (
										<button
											type="button"
											onClick={() => onReorderPhoto(photo.id, -1)}
											className="w-6 h-6 rounded bg-black/60 text-white border-none cursor-pointer flex items-center justify-center"
											title="Move left"
										>
											<Icon name="ChevronLeft" size={12} />
										</button>
									)}
									{i < photos.length - 1 && (
										<button
											type="button"
											onClick={() => onReorderPhoto(photo.id, 1)}
											className="w-6 h-6 rounded bg-black/60 text-white border-none cursor-pointer flex items-center justify-center"
											title="Move right"
										>
											<Icon name="ChevronRight" size={12} />
										</button>
									)}
								</div>
							)}
						</div>
					))}
					{/* Upload button */}
					<button
						type="button"
						onClick={() => fileRef.current?.click()}
						className="aspect-[4/3] rounded-md border-[1.5px] border-dashed border-line-strong bg-primary-50 cursor-pointer flex flex-col items-center justify-center gap-1.5 text-primary-700"
					>
						<Icon name="Upload" size={20} />
						<span className="text-xs font-semibold font-sans">Upload</span>
					</button>
				</div>
				<input
					ref={fileRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) {
							onUploadPhoto(file);
							e.target.value = "";
						}
					}}
				/>
			</Card>

			{/* Branches */}
			<Card padding="none">
				<div className="flex items-center justify-between px-5 py-4 border-b border-line">
					<div>
						<h3 className="m-0 text-base font-bold text-ink-900">Branches</h3>
						<p className="mt-1 mb-0 text-sm text-ink-500">
							Each branch has its own services, staff and slots.
						</p>
					</div>
					<Button
						size="sm"
						variant="ghost"
						icon="Plus"
						onClick={() => setAddingBranch(true)}
					>
						Add branch
					</Button>
				</div>
				{branches.map((b, i) => (
					<div
						key={b.id}
						className={[
							"flex items-center gap-4 px-5 py-4",
							i ? "border-t border-line-soft" : "",
						].join(" ")}
					>
						<div className="w-11 h-11 rounded-md bg-[linear-gradient(135deg,#1f6b58,#0b4a3c)] shrink-0" />
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<span className="text-base font-semibold text-ink-900">
									{b.name}
								</span>
								{b.isMain && (
									<span className="text-xs font-semibold text-primary-700 bg-primary-50 rounded-full px-2.5 py-0.5">
										Main
									</span>
								)}
							</div>
							<div className="text-sm text-ink-500 mt-0.5">
								{b.address}, {b.city} · {b.phone}
							</div>
						</div>
						<div className="flex gap-5 mr-2 text-sm text-ink-500">
							<span>
								<strong className="text-ink-800">{b.services}</strong> services
							</span>
							<span>
								<strong className="text-ink-800">{b.staff}</strong> staff
							</span>
						</div>
						<div className="flex gap-1">
							<button
								type="button"
								title="Manage hours"
								onClick={() => setManagingHoursId(b.id)}
								className="w-7 h-7 rounded-sm border border-line bg-surface cursor-pointer flex items-center justify-center"
							>
								<Icon name="Clock" size={15} className="text-ink-500" />
							</button>
							<button
								type="button"
								title="Edit branch"
								onClick={() => setEditingBranch(b)}
								className="w-7 h-7 rounded-sm border border-line bg-surface cursor-pointer flex items-center justify-center"
							>
								<Icon name="Pencil" size={15} className="text-ink-500" />
							</button>
							{!b.isMain && (
								<button
									type="button"
									title="Delete branch"
									onClick={() => onDeleteBranch(b.id)}
									className="w-7 h-7 rounded-sm border border-line bg-surface cursor-pointer flex items-center justify-center"
								>
									<Icon name="Trash2" size={15} className="text-danger-fg" />
								</button>
							)}
						</div>
					</div>
				))}
			</Card>

			{addingBranch && (
				<AddBranchModal
					onClose={() => setAddingBranch(false)}
					onAdd={(b) => {
						onAddBranch(b);
						setAddingBranch(false);
					}}
				/>
			)}

			{editingBranch && (
				<EditBranchModal
					branch={editingBranch}
					onClose={() => setEditingBranch(null)}
					onSave={(body) => {
						onEditBranch(editingBranch.id, body);
						setEditingBranch(null);
					}}
				/>
			)}

			{managingHoursId && (
				<BranchHoursModal
					branchId={managingHoursId}
					branchName={
						branches.find((b) => b.id === managingHoursId)?.name ?? "Branch"
					}
					onClose={() => setManagingHoursId(null)}
				/>
			)}

			{onDeleteBusiness && (
				<Card className="mt-6 border-danger-fg/20">
					<h3 className="m-0 text-base font-bold text-danger-fg mb-1">
						Danger zone
					</h3>
					<p className="mt-1 mb-4 text-sm text-ink-500">
						Archiving removes this business from customer search. You can restore
						it later from this page.
					</p>
					<Button variant="danger" icon="Archive" onClick={onDeleteBusiness}>
						Archive business
					</Button>
				</Card>
			)}
		</div>
	);
}

function AddBranchModal({
	onClose,
	onAdd,
}: {
	onClose: () => void;
	onAdd: (b: Branch) => void;
}) {
	const [f, setF] = useState({ name: "", address: "", city: "", phone: "" });
	const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
		setF({ ...f, [k]: e.target.value });
	const valid = f.name.trim() && f.city.trim();

	return (
		<Modal
			title="Add a branch"
			sub="A new location with its own services and staff."
			onClose={onClose}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!valid}
						onClick={() =>
							onAdd({
								id: `brx${Date.now()}`,
								name: f.name.trim(),
								address: f.address.trim() || "—",
								city: f.city.trim(),
								phone: f.phone.trim() || "—",
								services: 0,
								staff: 0,
								isMain: false,
							})
						}
					>
						Add branch
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4">
				<Field label="Branch name">
					<input
						value={f.name}
						onChange={set("name")}
						placeholder="e.g. Powai"
						className={inputClass}
					/>
				</Field>
				<Field label="Address">
					<input
						value={f.address}
						onChange={set("address")}
						placeholder="Street address"
						className={inputClass}
					/>
				</Field>
				<div className="grid grid-cols-2 gap-3.5">
					<Field label="City">
						<input
							value={f.city}
							onChange={set("city")}
							placeholder="Dhaka"
							className={inputClass}
						/>
					</Field>
					<Field label="Phone">
						<input
							value={f.phone}
							onChange={set("phone")}
							placeholder="+880 …"
							className={inputClass}
						/>
					</Field>
				</div>
			</div>
		</Modal>
	);
}

function EditBranchModal({
	branch,
	onClose,
	onSave,
}: {
	branch: Branch;
	onClose: () => void;
	onSave: (
		body: Partial<Pick<Branch, "name" | "address" | "city" | "phone">>,
	) => void;
}) {
	const [f, setF] = useState({
		name: branch.name,
		address: branch.address,
		city: branch.city,
		phone: branch.phone,
	});
	const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
		setF({ ...f, [k]: e.target.value });
	const valid = f.name.trim() && f.city.trim();

	return (
		<Modal
			title="Edit branch"
			onClose={onClose}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!valid}
						onClick={() =>
							onSave({
								name: f.name.trim(),
								address: f.address.trim(),
								city: f.city.trim(),
								phone: f.phone.trim(),
							})
						}
					>
						Save changes
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4">
				<Field label="Branch name">
					<input value={f.name} onChange={set("name")} className={inputClass} />
				</Field>
				<Field label="Address">
					<input
						value={f.address}
						onChange={set("address")}
						className={inputClass}
					/>
				</Field>
				<div className="grid grid-cols-2 gap-3.5">
					<Field label="City">
						<input
							value={f.city}
							onChange={set("city")}
							className={inputClass}
						/>
					</Field>
					<Field label="Phone">
						<input
							value={f.phone}
							onChange={set("phone")}
							className={inputClass}
						/>
					</Field>
				</div>
			</div>
		</Modal>
	);
}

const DAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

function BranchHoursModal({
	branchId,
	branchName,
	onClose,
}: {
	branchId: string;
	branchName: string;
	onClose: () => void;
}) {
	const { flash } = useToast();
	const hoursQ = useBranchHours(branchId);
	const upsertMut = useUpsertBranchHours();

	const defaultHours = DAYS.map((_, i) => ({
		dayOfWeek: i,
		isClosed: i === 0 || i === 6,
		openTime: "09:00",
		closeTime: "18:00",
	}));

	const [hours, setHours] = useState<
		Array<{
			dayOfWeek: number;
			isClosed: boolean;
			openTime: string;
			closeTime: string;
		}>
	>([]);
	const [initialized, setInitialized] = useState(false);

	if (!initialized && hoursQ.data !== undefined) {
		const fetched = hoursQ.data as BranchHours[];
		if (fetched.length > 0) {
			setHours(
				DAYS.map((_, i) => {
					const h = fetched.find((f) => f.dayOfWeek === i);
					return h
						? {
								dayOfWeek: i,
								isClosed: h.isClosed,
								openTime: h.openTime ?? "09:00",
								closeTime: h.closeTime ?? "18:00",
							}
						: defaultHours[i];
				}),
			);
		} else {
			setHours(defaultHours);
		}
		setInitialized(true);
	}

	const activeHours = hours.length > 0 ? hours : defaultHours;

	function setDay(i: number, patch: Partial<(typeof hours)[0]>) {
		setHours((prev) =>
			prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
		);
	}

	function save() {
		upsertMut.mutate(
			{
				id: branchId,
				body: {
					hours: activeHours.map((h) => ({
						dayOfWeek: h.dayOfWeek,
						isClosed: h.isClosed,
						openTime: h.isClosed ? null : h.openTime,
						closeTime: h.isClosed ? null : h.closeTime,
					})),
				},
			},
			{
				onSuccess: () => {
					flash("Working hours saved", "Clock");
					onClose();
				},
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	return (
		<Modal
			title="Working hours"
			sub={`Set opening hours for ${branchName}.`}
			onClose={onClose}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={save}
						disabled={upsertMut.isPending || hoursQ.isLoading}
					>
						{upsertMut.isPending ? "Saving…" : "Save hours"}
					</Button>
				</>
			}
		>
			{hoursQ.isLoading ? (
				<div className="flex flex-col gap-3">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="h-10 rounded-md bg-line animate-pulse" />
					))}
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{activeHours.map((h, i) => (
						<div key={h.dayOfWeek} className="flex items-center gap-3">
							<div className="w-24 font-sans text-sm text-ink-700 shrink-0">
								{DAYS[i]}
							</div>
							<button
								type="button"
								onClick={() => setDay(i, { isClosed: !h.isClosed })}
								className={[
									"px-2.5 py-1 rounded-md text-xs font-semibold border-none cursor-pointer w-16 text-center",
									h.isClosed
										? "bg-line text-ink-500"
										: "bg-success-bg text-success-fg",
								].join(" ")}
							>
								{h.isClosed ? "Closed" : "Open"}
							</button>
							{!h.isClosed && (
								<>
									<input
										type="time"
										value={h.openTime}
										onChange={(e) => setDay(i, { openTime: e.target.value })}
										className={cn(inputClass, "w-32 text-sm")}
									/>
									<span className="text-ink-400 text-sm">–</span>
									<input
										type="time"
										value={h.closeTime}
										onChange={(e) => setDay(i, { closeTime: e.target.value })}
										className={cn(inputClass, "w-32 text-sm")}
									/>
								</>
							)}
						</div>
					))}
				</div>
			)}
		</Modal>
	);
}
