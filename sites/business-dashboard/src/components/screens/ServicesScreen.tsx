"use client";
import { Clock, ImagePlus, MapPin, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGetService } from "../../hooks/useOwnerData";
import { cn } from "../../lib/cn";
import { money, type Service } from "../data";
import {
	Button,
	Card,
	Field,
	inputClass,
	Modal,
	PageHeader,
} from "../primitives";

interface ServicesScreenProps {
	services: Service[];
	branches: string[];
	onAdd: (s: Service) => void;
	onRemove: (id: string) => void;
	onUpdate: (
		id: string,
		body: Partial<
			Pick<Service, "name" | "category" | "duration" | "price" | "desc">
		>,
	) => void;
	onUploadPhoto: (id: string, file: File) => void;
	onDeletePhoto?: (id: string) => void;
}

export function ServicesScreen({
	services,
	branches,
	onAdd,
	onRemove,
	onUpdate,
	onUploadPhoto,
	onDeletePhoto,
}: ServicesScreenProps) {
	const [adding, setAdding] = useState(false);
	const [editing, setEditing] = useState<Service | null>(null);

	const allBranches =
		branches.length > 0
			? branches
			: [...new Set(services.map((s) => s.branch))];

	const byBranch = allBranches.map((br) => ({
		branch: br,
		items: services.filter((s) => s.branch === br),
	}));

	return (
		<div>
			<PageHeader
				eyebrow="Manage"
				title="Services"
				sub="Your bookable menu. Each service belongs to a branch."
				actions={
					<Button icon="Plus" onClick={() => setAdding(true)}>
						Add service
					</Button>
				}
			/>

			{byBranch.length === 0 && (
				<div className="text-center py-16 text-ink-400 text-base">
					<div className="text-3xl mb-3.5">✦</div>
					<strong className="block text-ink-700 mb-1.5">No services yet</strong>
					Add your first service to start accepting bookings.
				</div>
			)}
			<div className="flex flex-col gap-6">
				{byBranch.map((grp) => (
					<div key={grp.branch}>
						<div className="flex items-center gap-2 mb-3">
							<MapPin size={16} className="text-primary-600" />
							<h3 className="m-0 font-sans text-base font-bold text-ink-900">
								{grp.branch}
							</h3>
							<span className="text-sm text-ink-400">
								· {grp.items.length} services
							</span>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
							{grp.items.map((s) => (
								<ServiceCard
									key={s.id}
									service={s}
									onEdit={() => setEditing(s)}
									onRemove={() => onRemove(s.id)}
									onUploadPhoto={(file) => onUploadPhoto(s.id, file)}
									onDeletePhoto={
										onDeletePhoto ? () => onDeletePhoto(s.id) : undefined
									}
								/>
							))}
						</div>
					</div>
				))}
			</div>

			{adding && (
				<AddServiceModal
					onClose={() => setAdding(false)}
					onAdd={(svc) => {
						onAdd(svc);
						setAdding(false);
					}}
					branches={allBranches}
				/>
			)}

			{editing && (
				<EditServiceModal
					service={editing}
					onClose={() => setEditing(null)}
					onUpdate={(body) => {
						onUpdate(editing.id, body);
						setEditing(null);
					}}
				/>
			)}
		</div>
	);
}

function ServiceCard({
	service: s,
	onEdit,
	onRemove,
	onUploadPhoto,
	onDeletePhoto,
}: {
	service: Service;
	onEdit: () => void;
	onRemove: () => void;
	onUploadPhoto: (file: File) => void;
	onDeletePhoto?: () => void;
}) {
	const fileRef = useRef<HTMLInputElement>(null);

	return (
		<Card padding="sm" className="flex flex-col gap-2.5">
			{s.photoUrl && (
				<div className="relative -mx-3 -mt-3 mb-1 rounded-t-lg overflow-hidden group">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={s.photoUrl}
						alt={s.name}
						className="w-full h-28 object-cover"
					/>
					{onDeletePhoto && (
						<button
							type="button"
							onClick={onDeletePhoto}
							title="Delete photo"
							className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white border-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
						>
							<Trash2 size={12} />
						</button>
					)}
				</div>
			)}
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="text-base font-bold text-ink-900">{s.name}</div>
					<span className="inline-block mt-1.5 text-xs font-semibold text-primary-700 bg-primary-50 rounded-full px-2.5 py-0.5">
						{s.category}
					</span>
				</div>
				<div className="flex gap-1">
					<button
						type="button"
						title="Upload photo"
						onClick={() => fileRef.current?.click()}
						className="w-7 h-7 rounded-sm border border-line bg-surface cursor-pointer flex items-center justify-center"
					>
						<ImagePlus size={15} className="text-ink-500" />
					</button>
					<button
						type="button"
						title="Edit"
						onClick={onEdit}
						className="w-7 h-7 rounded-sm border border-line bg-surface cursor-pointer flex items-center justify-center"
					>
						<Pencil size={15} className="text-ink-500" />
					</button>
					<button
						type="button"
						title="Remove"
						onClick={onRemove}
						className="w-7 h-7 rounded-sm border border-line bg-surface cursor-pointer flex items-center justify-center"
					>
						<Trash2 size={15} className="text-ink-500" />
					</button>
				</div>
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
			{s.desc && (
				<p className="m-0 text-sm leading-snug text-ink-500">{s.desc}</p>
			)}
			<div className="flex gap-4 mt-auto pt-1.5">
				<span className="inline-flex items-center gap-1.5 text-sm text-ink-600">
					<Clock size={15} className="text-ink-400" />
					{s.duration} min
				</span>
				<span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-900">
					{money(s.price)}
				</span>
			</div>
		</Card>
	);
}

function AddServiceModal({
	onClose,
	onAdd,
	branches,
}: {
	onClose: () => void;
	onAdd: (s: Service) => void;
	branches: string[];
}) {
	const [f, setF] = useState({
		name: "",
		branch: branches[0] ?? "",
		category: "Spa",
		duration: "60",
		price: "",
	});
	const set =
		(k: string) =>
		(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
			setF({ ...f, [k]: e.target.value });
	const valid = f.name.trim() && f.price;

	return (
		<Modal
			title="Add a service"
			sub="Customers will see this on your public menu."
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
								id: `sx${Date.now()}`,
								name: f.name.trim(),
								branch: f.branch,
								category: f.category,
								duration: Number(f.duration) || 30,
								price: Number(f.price) || 0,
								desc: "",
							})
						}
					>
						Add service
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4">
				<Field label="Service name">
					<input
						value={f.name}
						onChange={set("name")}
						placeholder="e.g. Hot Stone Massage"
						className={inputClass}
					/>
				</Field>
				<div className="grid grid-cols-2 gap-3.5">
					<Field label="Branch">
						<select
							value={f.branch}
							onChange={set("branch")}
							className={cn(inputClass, "cursor-pointer")}
						>
							{branches.length > 0 ? (
								branches.map((b) => <option key={b}>{b}</option>)
							) : (
								<option value="">No branches yet</option>
							)}
						</select>
					</Field>
					<Field label="Category">
						<select
							value={f.category}
							onChange={set("category")}
							className={cn(inputClass, "cursor-pointer")}
						>
							{["Spa", "Massage", "Face", "Hair", "Nails"].map((c) => (
								<option key={c}>{c}</option>
							))}
						</select>
					</Field>
				</div>
				<div className="grid grid-cols-2 gap-3.5">
					<Field label="Duration (min)">
						<input
							value={f.duration}
							onChange={set("duration")}
							inputMode="numeric"
							className={inputClass}
						/>
					</Field>
					<Field label="Price (৳)">
						<input
							value={f.price}
							onChange={set("price")}
							inputMode="numeric"
							placeholder="2400"
							className={inputClass}
						/>
					</Field>
				</div>
			</div>
		</Modal>
	);
}

function EditServiceModal({
	service,
	onClose,
	onUpdate,
}: {
	service: Service;
	onClose: () => void;
	onUpdate: (
		body: Partial<
			Pick<Service, "name" | "category" | "duration" | "price" | "desc">
		>,
	) => void;
}) {
	const [f, setF] = useState({
		name: service.name,
		category: service.category,
		duration: String(service.duration),
		price: String(service.price),
		desc: service.desc,
	});

	const freshQuery = useGetService(service.id);
	useEffect(() => {
		const s = freshQuery.data?.data;
		if (!s) return;
		setF({
			name: s.name,
			category: s.category,
			duration: String(s.duration),
			price: String(s.price),
			desc: s.description ?? "",
		});
	}, [freshQuery.data]);
	const set =
		(k: string) =>
		(
			e: React.ChangeEvent<
				HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
			>,
		) =>
			setF({ ...f, [k]: e.target.value });
	const valid = f.name.trim() && f.price;

	return (
		<Modal
			title="Edit service"
			sub="Changes apply immediately to your public menu."
			onClose={onClose}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!valid}
						onClick={() =>
							onUpdate({
								name: f.name.trim(),
								category: f.category,
								duration: Number(f.duration) || service.duration,
								price: Number(f.price) || service.price,
								desc: f.desc,
							})
						}
					>
						Save changes
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4">
				<Field label="Service name">
					<input value={f.name} onChange={set("name")} className={inputClass} />
				</Field>
				<Field label="Category">
					<select
						value={f.category}
						onChange={set("category")}
						className={cn(inputClass, "cursor-pointer")}
					>
						{["Spa", "Massage", "Face", "Hair", "Nails"].map((c) => (
							<option key={c}>{c}</option>
						))}
					</select>
				</Field>
				<div className="grid grid-cols-2 gap-3.5">
					<Field label="Duration (min)">
						<input
							value={f.duration}
							onChange={set("duration")}
							inputMode="numeric"
							className={inputClass}
						/>
					</Field>
					<Field label="Price (৳)">
						<input
							value={f.price}
							onChange={set("price")}
							inputMode="numeric"
							className={inputClass}
						/>
					</Field>
				</div>
				<Field label="Description">
					<textarea
						value={f.desc}
						onChange={set("desc")}
						rows={3}
						className={cn(inputClass, "resize-none")}
					/>
				</Field>
			</div>
		</Modal>
	);
}
