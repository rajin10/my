"use client";
import type {
	AddTeamMemberBody,
	StaffAvailabilitySlot,
	TeamRole,
	User,
} from "@repo/api-client";
import { Mail, Pencil, Phone } from "lucide-react";
import { useState } from "react";
import { useToast } from "../../context/toast";
import {
	useSearchUsers,
	useStaffAvailability,
	useUpsertStaffAvailability,
} from "../../hooks/useOwnerData";
import { cn } from "../../lib/cn";
import type { TeamMember } from "../data";
import {
	Avatar,
	Button,
	Card,
	Field,
	Icon,
	inputClass,
	Modal,
	PageHeader,
} from "../primitives";

interface ApiBranch {
	id: string;
	name: string;
}

interface TeamScreenProps {
	team: TeamMember[];
	apiBranches: ApiBranch[];
	businessId: string | null;
	onAdd: (body: AddTeamMemberBody) => void;
	onUpdate: (
		id: string,
		body: { role?: Exclude<TeamRole, "Owner">; title?: string },
	) => void;
	onRemove: (id: string) => void;
}

type Role = "Owner" | "Manager" | "Staff";

const ROLE_TONE: Record<Role, { bg: string; fg: string }> = {
	Owner: { bg: "var(--color-primary-100)", fg: "var(--color-primary-700)" },
	Manager: { bg: "var(--color-pending-bg)", fg: "var(--color-pending-fg)" },
	Staff: { bg: "var(--color-line-soft)", fg: "var(--color-ink-600)" },
};

function RoleBadge({ role }: { role: string }) {
	const t = ROLE_TONE[role as Role] ?? ROLE_TONE.Staff;
	return (
		<span
			style={{ color: t.fg, background: t.bg }}
			className="text-xs font-bold rounded-full px-2.5 py-0.5 whitespace-nowrap font-sans"
		>
			{role}
		</span>
	);
}

export function TeamScreen({
	team,
	apiBranches,
	businessId,
	onAdd,
	onUpdate,
	onRemove,
}: TeamScreenProps) {
	const [adding, setAdding] = useState(false);
	const [editing, setEditing] = useState<TeamMember | null>(null);
	const [managingAvailabilityId, setManagingAvailabilityId] = useState<
		string | null
	>(null);

	const branches = apiBranches.map((b) => b.name);
	const uniqueBranches =
		branches.length > 0
			? branches
			: [...new Set(team.map((m) => m.branch).filter(Boolean))];

	const byBranch = uniqueBranches.map((br) => ({
		branch: br,
		items: team.filter((m) => m.branch === br),
	}));

	return (
		<div>
			<PageHeader
				eyebrow="Manage"
				title="Team"
				sub="Invite managers and staff, and set who can do what."
				actions={
					<Button icon="UserPlus" onClick={() => setAdding(true)}>
						Add staff member
					</Button>
				}
			/>

			{/* Role legend */}
			<div className="flex gap-4 mb-5 flex-wrap">
				{(["Owner", "Manager", "Staff"] as Role[]).map((r) => (
					<div
						key={r}
						className="flex items-center gap-2 text-sm text-ink-500 font-sans"
					>
						<RoleBadge role={r} />
						<span>
							{r === "Owner"
								? "Full control — business, team, billing, settings"
								: r === "Manager"
									? "Bookings, services, staff & branch settings"
									: "View their own schedule and branch info"}
						</span>
					</div>
				))}
			</div>

			{byBranch.length === 0 && team.length === 0 && (
				<div className="text-center py-16 text-ink-400 text-base">
					<div className="text-3xl mb-3.5">✦</div>
					<strong className="block text-ink-700 mb-1.5">
						No team members yet
					</strong>
					Add your first staff member to get started.
				</div>
			)}
			<div className="flex flex-col gap-5">
				{byBranch.map((grp) => (
					<Card key={grp.branch} padding="none">
						<div className="flex items-center gap-2 px-5 py-4 border-b border-line">
							<Icon name="MapPin" size={16} className="text-primary-600" />
							<h3 className="m-0 font-sans text-base font-bold text-ink-900">
								{grp.branch}
							</h3>
							<span className="text-sm text-ink-400">
								· {grp.items.length}{" "}
								{grp.items.length === 1 ? "person" : "people"}
							</span>
						</div>
						{grp.items.map((m, i) => (
							<div
								key={m.id}
								className={[
									"flex items-center gap-3.5 px-5 py-3",
									i ? "border-t border-line-soft" : "",
								].join(" ")}
							>
								<Avatar name={m.name} size={42} />
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="text-sm font-semibold text-ink-900">
											{m.name}
										</span>
										<RoleBadge role={m.role} />
									</div>
									<div className="text-xs text-ink-500 mt-0.5">{m.title}</div>
								</div>
								<div className="flex flex-col gap-0.5 items-end mr-2">
									<span className="inline-flex items-center gap-1.5 text-sm text-ink-600">
										<Mail size={14} className="text-ink-400" />
										{m.email}
									</span>
									{m.phone && (
										<span className="inline-flex items-center gap-1.5 text-sm text-ink-500">
											<Phone size={13} className="text-ink-400" />
											{m.phone}
										</span>
									)}
								</div>
								{m.role !== "Owner" ? (
									<div className="flex gap-1">
										<button
											type="button"
											title="Availability"
											onClick={() => setManagingAvailabilityId(m.id)}
											className="w-7 h-7 rounded-sm border border-line bg-surface cursor-pointer flex items-center justify-center"
										>
											<Icon name="Clock" size={15} className="text-ink-500" />
										</button>
										<button
											type="button"
											title="Edit"
											onClick={() => setEditing(m)}
											className="w-7 h-7 rounded-sm border border-line bg-surface cursor-pointer flex items-center justify-center"
										>
											<Pencil size={15} className="text-ink-500" />
										</button>
										<button
											type="button"
											title="Remove"
											onClick={() => onRemove(m.id)}
											className="w-7 h-7 rounded-sm border border-line bg-surface cursor-pointer flex items-center justify-center"
										>
											<Icon name="Trash2" size={15} className="text-ink-500" />
										</button>
									</div>
								) : (
									<span className="w-14" />
								)}
							</div>
						))}
					</Card>
				))}
			</div>

			{adding && businessId && (
				<AddStaffModal
					businessId={businessId}
					apiBranches={apiBranches}
					onClose={() => setAdding(false)}
					onAdd={(body) => {
						onAdd(body);
						setAdding(false);
					}}
				/>
			)}

			{editing && (
				<EditTeamMemberModal
					member={editing}
					onClose={() => setEditing(null)}
					onUpdate={(body) => {
						onUpdate(editing.id, body);
						setEditing(null);
					}}
				/>
			)}

			{managingAvailabilityId && (
				<StaffAvailabilityModal
					teamMemberId={managingAvailabilityId}
					memberName={
						team.find((m) => m.id === managingAvailabilityId)?.name ?? "Staff"
					}
					onClose={() => setManagingAvailabilityId(null)}
				/>
			)}
		</div>
	);
}

function AddStaffModal({
	businessId,
	apiBranches,
	onClose,
	onAdd,
}: {
	businessId: string;
	apiBranches: ApiBranch[];
	onClose: () => void;
	onAdd: (body: AddTeamMemberBody) => void;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [role, setRole] = useState<Exclude<TeamRole, "Owner">>("Staff");
	const [title, setTitle] = useState("");
	const [selectedBranchId, setSelectedBranchId] = useState(
		apiBranches[0]?.id ?? "",
	);

	const searchResults = useSearchUsers(searchQuery);
	const users: User[] = (searchResults.data?.data ?? []) as User[];

	const valid = !!selectedUser;

	return (
		<Modal
			title="Add a staff member"
			sub="Search for an existing user by name or email to add them to your team."
			onClose={onClose}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!valid}
						onClick={() => {
							if (!selectedUser) return;
							onAdd({
								userId: selectedUser.id,
								businessId,
								role,
								title: title.trim() || undefined,
								branchId: selectedBranchId || undefined,
							});
						}}
					>
						Add member
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4">
				<Field label="Search user" hint="Type a name or email (min 2 chars)">
					<input
						value={searchQuery}
						onChange={(e) => {
							setSearchQuery(e.target.value);
							setSelectedUser(null);
						}}
						placeholder="e.g. Aisha or aisha@email.com"
						className={inputClass}
					/>
					{searchResults.isLoading && (
						<div className="text-xs text-ink-400 mt-1">Searching…</div>
					)}
					{users.length > 0 && !selectedUser && (
						<div className="mt-1 border border-line rounded-md overflow-hidden">
							{users.map((u) => (
								<button
									key={u.id}
									type="button"
									onClick={() => {
										setSelectedUser(u);
										setSearchQuery(u.name);
									}}
									className="w-full text-left px-3 py-2 font-sans text-sm hover:bg-paper border-none bg-surface cursor-pointer border-b border-line-soft last:border-b-0"
								>
									<div className="font-semibold text-ink-900">{u.name}</div>
									{u.email && (
										<div className="text-xs text-ink-500">{u.email}</div>
									)}
								</button>
							))}
						</div>
					)}
					{searchQuery.length >= 2 &&
						!searchResults.isLoading &&
						users.length === 0 &&
						!selectedUser && (
							<div className="text-xs text-ink-400 mt-1">
								No users found — they must sign up first.
							</div>
						)}
					{selectedUser && (
						<div className="mt-1 text-xs text-success-fg font-semibold">
							✓ {selectedUser.name} selected
						</div>
					)}
				</Field>
				<Field label="Title" hint="Optional">
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="e.g. Senior Therapist"
						className={inputClass}
					/>
				</Field>
				<div className="grid grid-cols-2 gap-3.5">
					<Field label="Role">
						<select
							value={role}
							onChange={(e) =>
								setRole(e.target.value as Exclude<TeamRole, "Owner">)
							}
							className={cn(inputClass, "cursor-pointer")}
						>
							{["Manager", "Staff"].map((r) => (
								<option key={r}>{r}</option>
							))}
						</select>
					</Field>
					{apiBranches.length > 0 && (
						<Field label="Branch">
							<select
								value={selectedBranchId}
								onChange={(e) => setSelectedBranchId(e.target.value)}
								className={cn(inputClass, "cursor-pointer")}
							>
								{apiBranches.map((b) => (
									<option key={b.id} value={b.id}>
										{b.name}
									</option>
								))}
							</select>
						</Field>
					)}
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

function StaffAvailabilityModal({
	teamMemberId,
	memberName,
	onClose,
}: {
	teamMemberId: string;
	memberName: string;
	onClose: () => void;
}) {
	const { flash } = useToast();
	const availQ = useStaffAvailability(teamMemberId);
	const upsertMut = useUpsertStaffAvailability();

	const defaultSlots = DAYS.map((_, i) => ({
		dayOfWeek: i,
		isClosed: i === 0 || i === 6,
		startTime: "09:00",
		endTime: "18:00",
	}));

	const [slots, setSlots] = useState<typeof defaultSlots>([]);
	const [initialized, setInitialized] = useState(false);

	if (!initialized && availQ.data !== undefined) {
		const fetched: StaffAvailabilitySlot[] = availQ.data;
		if (fetched.length > 0) {
			setSlots(
				DAYS.map((_, i) => {
					const h = fetched.find((f) => f.dayOfWeek === i);
					return h
						? {
								dayOfWeek: i,
								isClosed: h.isClosed,
								startTime: h.startTime ?? "09:00",
								endTime: h.endTime ?? "18:00",
							}
						: defaultSlots[i];
				}),
			);
		} else {
			setSlots(defaultSlots);
		}
		setInitialized(true);
	}

	const activeSlots = slots.length > 0 ? slots : defaultSlots;

	function setDay(i: number, patch: Partial<(typeof slots)[0]>) {
		setSlots((prev) =>
			prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
		);
	}

	function save() {
		upsertMut.mutate(
			{
				id: teamMemberId,
				body: {
					availability: activeSlots.map((s) => ({
						dayOfWeek: s.dayOfWeek,
						isClosed: s.isClosed,
						startTime: s.isClosed ? null : s.startTime,
						endTime: s.isClosed ? null : s.endTime,
					})),
				},
			},
			{
				onSuccess: () => {
					flash("Availability saved", "Clock");
					onClose();
				},
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	return (
		<Modal
			title="Staff availability"
			sub={`Set working hours for ${memberName}.`}
			onClose={onClose}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={save}
						disabled={upsertMut.isPending || availQ.isLoading}
					>
						{upsertMut.isPending ? "Saving…" : "Save"}
					</Button>
				</>
			}
		>
			{availQ.isLoading ? (
				<div className="flex flex-col gap-3">
					{[1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="h-10 rounded-md bg-line animate-pulse" />
					))}
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{activeSlots.map((s, i) => (
						<div key={s.dayOfWeek} className="flex items-center gap-3">
							<div className="w-24 font-sans text-sm text-ink-700 shrink-0">
								{DAYS[i]}
							</div>
							<button
								type="button"
								onClick={() => setDay(i, { isClosed: !s.isClosed })}
								className={[
									"px-2.5 py-1 rounded-md text-xs font-semibold border-none cursor-pointer w-16 text-center",
									s.isClosed
										? "bg-line text-ink-500"
										: "bg-success-bg text-success-fg",
								].join(" ")}
							>
								{s.isClosed ? "Closed" : "Open"}
							</button>
							{!s.isClosed && (
								<>
									<input
										type="time"
										value={s.startTime}
										onChange={(e) => setDay(i, { startTime: e.target.value })}
										className={cn(inputClass, "w-32 text-sm")}
									/>
									<span className="text-ink-400 text-sm">–</span>
									<input
										type="time"
										value={s.endTime}
										onChange={(e) => setDay(i, { endTime: e.target.value })}
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

function EditTeamMemberModal({
	member,
	onClose,
	onUpdate,
}: {
	member: TeamMember;
	onClose: () => void;
	onUpdate: (body: {
		role?: Exclude<TeamRole, "Owner">;
		title?: string;
	}) => void;
}) {
	const [role, setRole] = useState<Exclude<TeamRole, "Owner">>(
		member.role === "Owner"
			? "Staff"
			: (member.role as Exclude<TeamRole, "Owner">),
	);
	const [title, setTitle] = useState(member.title);

	return (
		<Modal
			title="Edit team member"
			sub={`Updating role and title for ${member.name}.`}
			onClose={onClose}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={() => onUpdate({ role, title: title.trim() || undefined })}
					>
						Save changes
					</Button>
				</>
			}
		>
			<div className="flex flex-col gap-4">
				<Field label="Role">
					<select
						value={role}
						onChange={(e) =>
							setRole(e.target.value as Exclude<TeamRole, "Owner">)
						}
						className={cn(inputClass, "cursor-pointer")}
					>
						{["Manager", "Staff"].map((r) => (
							<option key={r}>{r}</option>
						))}
					</select>
				</Field>
				<Field label="Title" hint="Optional">
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="e.g. Senior Therapist"
						className={inputClass}
					/>
				</Field>
			</div>
		</Modal>
	);
}
