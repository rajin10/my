import type { OrderStatus, User } from "@repo/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { useApp } from "../context";
import {
	type Booking,
	BUSINESS_CATEGORY_LABELS,
	CATEGORY_OPTIONS,
	type Coupon,
	isOrderCancellable,
	money,
	nextOrderActionLabel,
	nextOrderStatus,
	PRODUCT_CATEGORY_OPTIONS,
	PRODUCT_STATUS_OPTIONS,
	type Product,
	type Service,
	type TeamMember,
	validateCoupon,
} from "../data";
import {
	useBranchHours,
	useOrder,
	useRecordPayment,
	useStaffAvailability,
	useUpdateBranch,
	useUpdateOrderStatus,
	useUpsertBranchHours,
	useUpsertStaffAvailability,
	useUserSearch,
} from "../hooks/useOwnerData";
import { adaptOrderLine } from "../lib/adapters";
import { api } from "../lib/api";
import { mergeWeekSchedule, serializeWeekSchedule } from "../lib/schedule";
import { Colors, Radius } from "../tokens";
import {
	Avatar,
	Button,
	Icon,
	type IconName,
	PickerField,
	Sheet,
	StatusPill,
	TextField,
} from "./ui";
import { WeekScheduleEditor } from "./WeekScheduleEditor";

// ---- Booking detail sheet ----
// (No local state — safe to early-return before hooks)
export function BookingDetailSheet({ b }: { b: Booking }) {
	const {
		setSheet,
		bookings,
		team,
		confirmBooking,
		declineBooking,
		cancelBooking,
		completeBooking,
		assignStaff,
		setComms,
	} = useApp();
	const live = bookings.find((x) => x.id === b.id) || b;
	const staffOptions = team.filter((m) => m.role !== "Owner");
	const [assignee, setAssignee] = useState("");

	const row = (icon: string, label: string, value: string) => (
		<View
			key={label}
			className="flex-row items-center border-t border-line-soft"
			style={{ gap: 12, paddingVertical: 13 }}
		>
			<Icon name={icon as IconName} size={18} color={Colors.primary600} />
			<Text className="text-ink-500" style={{ fontSize: 14, width: 92 }}>
				{label}
			</Text>
			<Text
				className="flex-1 text-ink-900 font-semibold text-right"
				style={{ fontSize: 14.5 }}
			>
				{value}
			</Text>
		</View>
	);

	const footer =
		live.status === "Pending" ? (
			<View className="flex-row" style={{ gap: 10 }}>
				<Button
					variant="ghost"
					icon="X"
					full
					onPress={() => {
						declineBooking(live.id);
						setSheet(null);
					}}
				>
					Decline
				</Button>
				<Button
					variant="primary"
					icon="Check"
					full
					onPress={() => {
						confirmBooking(live.id);
						setSheet(null);
					}}
				>
					Confirm booking
				</Button>
			</View>
		) : live.status === "Confirmed" ? (
			<View style={{ gap: 10 }}>
				{staffOptions.length > 0 && (
					<PickerField
						label="Assign staff"
						value={(assignee || staffOptions[0]?.name) ?? ""}
						options={staffOptions.map((m) => m.name)}
						onChange={(name) => {
							setAssignee(name);
							const member = staffOptions.find((m) => m.name === name);
							if (member) assignStaff(live.id, member.id);
						}}
					/>
				)}
				<View className="flex-row" style={{ gap: 10 }}>
					<Button
						variant="ghost"
						icon="XCircle"
						full
						onPress={() => {
							cancelBooking(live.id);
							setSheet(null);
						}}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						icon="CheckCheck"
						full
						onPress={() => {
							completeBooking(live.id);
							setSheet(null);
						}}
					>
						Mark complete
					</Button>
				</View>
			</View>
		) : undefined;

	return (
		<Sheet
			visible
			title="Booking"
			onClose={() => setSheet(null)}
			footer={footer}
		>
			<View
				className="flex-row items-center"
				style={{ gap: 13, marginBottom: 6 }}
			>
				<Avatar name={live.customer} size={52} />
				<View className="flex-1 min-w-0">
					<Text className="text-ink-900 font-bold" style={{ fontSize: 18 }}>
						{live.customer}
					</Text>
					<Text
						className="text-ink-500"
						style={{ fontSize: 13.5, marginTop: 2 }}
					>
						Booked {live.when}
					</Text>
				</View>
				<StatusPill status={live.status} />
			</View>

			<View style={{ marginTop: 6 }}>
				{row("Sparkles", "Service", live.service)}
				{row("Calendar", "When", `${live.date}, ${live.time}`)}
				{row("Clock", "Duration", `${live.duration} min`)}
				{row("MapPin", "Branch", live.branch)}
				{row("Wallet", "Price", money(live.price))}
			</View>

			<View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
				<Button
					variant="subtle"
					size="sm"
					icon="MessageCircle"
					full
					onPress={() => {
						setSheet(null);
						setComms({ type: "chat", b: live });
					}}
				>
					Message
				</Button>
				<Button
					variant="subtle"
					size="sm"
					icon="Phone"
					full
					onPress={() => {
						setSheet(null);
						setComms({ type: "call", b: live });
					}}
				>
					Call
				</Button>
			</View>

			{live.status === "Pending" && (
				<Text
					style={{
						marginTop: 14,
						fontSize: 13,
						lineHeight: 20,
						color: Colors.ink500,
					}}
				>
					Confirming notifies {live.customer.split(" ")[0]} straight away and
					awards them loyalty points.
				</Text>
			)}
		</Sheet>
	);
}

// ---- Order detail sheet ----
export function OrderDetailSheet({ orderId }: { orderId: string }) {
	const { setSheet, products, flash } = useApp();
	const orderQ = useOrder(orderId);
	const updateMut = useUpdateOrderStatus();
	const order = orderQ.data;

	function advance(status: OrderStatus, doneMsg: string) {
		if (!order) return;
		updateMut.mutate(
			{ id: order.id, status },
			{
				onSuccess: () => {
					setSheet(null);
					flash(doneMsg, { tone: "success" });
				},
				onError: (e: unknown) =>
					flash((e as Error).message ?? "Update failed", { tone: "danger" }),
			},
		);
	}

	function confirmCancel() {
		Alert.alert(
			"Cancel order",
			"Cancel this order? Stock will be restored and the customer notified.",
			[
				{ text: "Keep order", style: "cancel" },
				{
					text: "Cancel order",
					style: "destructive",
					onPress: () =>
						advance("Cancelled", "Order cancelled — stock restored."),
				},
			],
		);
	}

	const next = order ? nextOrderStatus(order.status) : null;
	const cancellable = order ? isOrderCancellable(order.status) : false;

	const footer =
		order && (next || cancellable) ? (
			<View style={{ gap: 10 }}>
				{next ? (
					<Button
						variant="primary"
						icon="ArrowRight"
						full
						disabled={updateMut.isPending}
						onPress={() =>
							advance(next, `${nextOrderActionLabel(next)} — done.`)
						}
					>
						{nextOrderActionLabel(next)}
					</Button>
				) : null}
				{cancellable ? (
					<Button
						variant="ghost"
						icon="XCircle"
						full
						disabled={updateMut.isPending}
						onPress={confirmCancel}
					>
						Cancel order
					</Button>
				) : null}
			</View>
		) : undefined;

	const lines = order?.items?.map((it) => adaptOrderLine(it, products)) ?? [];

	return (
		<Sheet visible title="Order" onClose={() => setSheet(null)} footer={footer}>
			{!order ? (
				<Text
					className="text-ink-500"
					style={{ fontSize: 14, paddingVertical: 20 }}
				>
					{orderQ.isError ? "Couldn't load this order." : "Loading…"}
				</Text>
			) : (
				<View style={{ gap: 14 }}>
					<View className="flex-row items-center justify-between">
						<StatusPill status={order.status} />
						<Text className="text-ink-900 font-bold" style={{ fontSize: 18 }}>
							{money(order.total)}
						</Text>
					</View>

					<View style={{ gap: 8 }}>
						{lines.map((l) => (
							<View
								key={l.id}
								className="flex-row items-center justify-between"
							>
								<Text className="flex-1 text-ink-900" style={{ fontSize: 14 }}>
									{l.quantity} × {l.name}
								</Text>
								<Text
									className="text-ink-700 font-semibold"
									style={{ fontSize: 14 }}
								>
									{money(l.lineTotal)}
								</Text>
							</View>
						))}
					</View>

					<View
						className="border-t border-line-soft"
						style={{ paddingTop: 12 }}
					>
						<Text className="text-ink-500" style={{ fontSize: 13 }}>
							Deliver to
						</Text>
						<Text
							className="text-ink-900 font-semibold"
							style={{ fontSize: 14, marginTop: 2 }}
						>
							{[order.deliveryLine, order.deliveryArea, order.deliveryCity]
								.filter(Boolean)
								.join(", ")}
						</Text>
					</View>
				</View>
			)}
		</Sheet>
	);
}

// ---- Add / edit service sheet ----
export function AddServiceSheet({ initial }: { initial?: Service }) {
	const { setSheet, addService, updateService, business } = useApp();
	const editing = !!initial;

	const [name, setName] = useState(initial?.name ?? "");
	const [desc, setDesc] = useState(initial?.desc ?? "");
	const [branch, setBranch] = useState(
		initial?.branch ?? business.branches[0] ?? "",
	);
	const [category, setCategory] = useState(
		initial?.category ?? CATEGORY_OPTIONS[0],
	);
	const [duration, setDuration] = useState(
		initial ? String(initial.duration) : "60",
	);
	const [price, setPrice] = useState(initial ? String(initial.price) : "");

	const [submitting, setSubmitting] = useState(false);
	const valid = name.trim() && price;

	async function save() {
		if (!valid || submitting) return;
		const data = {
			name: name.trim(),
			desc: desc.trim(),
			branch,
			category,
			duration: Number(duration) || 30,
			price: Number(price) || 0,
		};
		setSubmitting(true);
		try {
			if (editing && initial) await updateService(initial.id, data);
			else await addService(data);
		} finally {
			setSubmitting(false);
		}
	}

	const footer = (
		<Button
			variant="primary"
			full
			disabled={!valid || submitting}
			onPress={save}
		>
			{editing ? "Save changes" : "Add service"}
		</Button>
	);

	return (
		<Sheet
			visible
			title={editing ? "Edit service" : "Add service"}
			onClose={() => setSheet(null)}
			footer={footer}
		>
			<View style={{ gap: 15 }}>
				<TextField
					label="Name"
					value={name}
					onChangeText={setName}
					placeholder="e.g. Signature Hammam Ritual"
					autoFocus={!editing}
				/>
				<TextField
					label="Description (optional)"
					value={desc}
					onChangeText={setDesc}
					placeholder="What can the customer expect?"
				/>
				<View style={{ flexDirection: "row", gap: 12 }}>
					{/* Branch is fixed once a service exists — the API has no branch-reassign path. */}
					{!editing && (
						<PickerField
							label="Branch"
							value={branch}
							options={business.branches}
							onChange={setBranch}
							style={{ flex: 1 }}
						/>
					)}
					<PickerField
						label="Category"
						value={category}
						options={CATEGORY_OPTIONS}
						onChange={setCategory}
						style={{ flex: 1 }}
					/>
				</View>
				<View style={{ flexDirection: "row", gap: 12 }}>
					<TextField
						label="Duration (min)"
						value={duration}
						onChangeText={(v) => setDuration(v.replace(/\D/g, ""))}
						keyboardType="numeric"
						style={{ flex: 1 }}
					/>
					<TextField
						label="Price (৳)"
						value={price}
						onChangeText={(v) => setPrice(v.replace(/\D/g, ""))}
						placeholder="2400"
						keyboardType="numeric"
						style={{ flex: 1 }}
					/>
				</View>
			</View>
		</Sheet>
	);
}

// ---- Add / edit product sheet (commerce vertical) ----
export function AddProductSheet({ initial }: { initial?: Product }) {
	const { setSheet, addProduct, updateProduct, business } = useApp();
	const editing = !!initial;

	const [name, setName] = useState(initial?.name ?? "");
	const [desc, setDesc] = useState(initial?.desc ?? "");
	const [branch, setBranch] = useState(
		initial?.branch ?? business.branches[0] ?? "",
	);
	const [category, setCategory] = useState(
		initial?.category ?? PRODUCT_CATEGORY_OPTIONS[0],
	);
	const [price, setPrice] = useState(initial ? String(initial.price) : "");
	const [stock, setStock] = useState(initial ? String(initial.stock) : "0");
	const [status, setStatus] = useState<"Active" | "Inactive">(
		initial?.status ?? "Active",
	);

	const [submitting, setSubmitting] = useState(false);
	// Stock and price inputs strip non-digits, so they are always non-negative
	// integers — matching the DB CHECK(stock >= 0) invariant. Name + price gate.
	const valid = !!name.trim() && price !== "";

	async function save() {
		if (!valid || submitting) return;
		const data = {
			name: name.trim(),
			desc: desc.trim(),
			branch,
			category,
			price: Number(price) || 0,
			stock: Number(stock) || 0,
			status,
		};
		setSubmitting(true);
		try {
			if (editing && initial) await updateProduct(initial.id, data);
			else await addProduct(data);
		} finally {
			setSubmitting(false);
		}
	}

	const footer = (
		<Button
			variant="primary"
			full
			disabled={!valid || submitting}
			onPress={save}
		>
			{editing ? "Save changes" : "Add product"}
		</Button>
	);

	return (
		<Sheet
			visible
			title={editing ? "Edit product" : "Add product"}
			onClose={() => setSheet(null)}
			footer={footer}
		>
			<View style={{ gap: 15 }}>
				<TextField
					label="Name"
					value={name}
					onChangeText={setName}
					placeholder="e.g. 12kg LPG Cylinder"
					autoFocus={!editing}
				/>
				<TextField
					label="Description (optional)"
					value={desc}
					onChangeText={setDesc}
					placeholder="Brand, size, or other details"
				/>
				<View style={{ flexDirection: "row", gap: 12 }}>
					{/* Branch is fixed once a product exists — the API has no branch-reassign path. */}
					{!editing && (
						<PickerField
							label="Branch"
							value={branch}
							options={business.branches}
							onChange={setBranch}
							style={{ flex: 1 }}
						/>
					)}
					<PickerField
						label="Category"
						value={category}
						options={PRODUCT_CATEGORY_OPTIONS}
						onChange={setCategory}
						style={{ flex: 1 }}
					/>
				</View>
				<View style={{ flexDirection: "row", gap: 12 }}>
					<TextField
						label="Price (৳)"
						value={price}
						onChangeText={(v) => setPrice(v.replace(/\D/g, ""))}
						placeholder="1200"
						keyboardType="numeric"
						style={{ flex: 1 }}
					/>
					<TextField
						label="Stock"
						value={stock}
						onChangeText={(v) => setStock(v.replace(/\D/g, ""))}
						placeholder="0"
						keyboardType="numeric"
						style={{ flex: 1 }}
					/>
				</View>
				<PickerField
					label="Status"
					value={status}
					options={PRODUCT_STATUS_OPTIONS}
					onChange={(v) => setStatus(v as "Active" | "Inactive")}
				/>
			</View>
		</Sheet>
	);
}

// ---- Add / edit teammate sheet ----
export function AddStaffSheet({ initial }: { initial?: TeamMember }) {
	const { setSheet, addStaff, updateStaff, business, apiBranches } = useApp();
	const editing = !!initial;

	// Edit mode — simple form (no user search needed, member already exists)
	const [title, setTitle] = useState(initial?.title ?? "");
	const [role, setRole] = useState<"Manager" | "Staff">(
		initial?.role === "Manager" ? "Manager" : "Staff",
	);
	const [branch, setBranch] = useState(
		initial?.branch ?? business.branches[0] ?? "",
	);

	if (editing && initial) {
		const footer = (
			<Button
				variant="primary"
				full
				onPress={() =>
					updateStaff(initial.id, {
						title: title.trim() || undefined,
						role,
						branch,
					})
				}
			>
				Save changes
			</Button>
		);
		return (
			<Sheet
				visible
				title="Edit teammate"
				onClose={() => setSheet(null)}
				footer={footer}
			>
				<View style={{ gap: 15 }}>
					<TextField
						label="Job title (optional)"
						value={title}
						onChangeText={setTitle}
						placeholder="e.g. Senior Therapist"
					/>
					<View>
						<Text
							style={{
								fontSize: 13.5,
								fontWeight: "600",
								color: Colors.ink700,
								marginBottom: 8,
							}}
						>
							Role
						</Text>
						<View className="flex-row" style={{ gap: 9 }}>
							{(["Manager", "Staff"] as const).map((r) => (
								<TouchableOpacity
									key={r}
									onPress={() => setRole(r)}
									style={{
										flex: 1,
										padding: 11,
										borderRadius: Radius.md,
										alignItems: "center",
										backgroundColor:
											role === r ? Colors.primary100 : Colors.surface,
										borderWidth: role === r ? 1.5 : 1,
										borderColor:
											role === r ? Colors.primary300 : Colors.lineStrong,
									}}
								>
									<Text
										style={{
											fontSize: 14,
											fontWeight: "600",
											color: role === r ? Colors.primary700 : Colors.ink600,
										}}
									>
										{r}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>
					<PickerField
						label="Branch"
						value={branch}
						options={business.branches}
						onChange={setBranch}
					/>
					<View className="flex-row items-start" style={{ gap: 9 }}>
						<Icon
							name="Info"
							size={15}
							color={Colors.primary600}
							style={{ marginTop: 1 }}
						/>
						<Text
							style={{
								flex: 1,
								fontSize: 12.5,
								lineHeight: 20,
								color: Colors.ink400,
							}}
						>
							Changes apply immediately.
						</Text>
					</View>
				</View>
			</Sheet>
		);
	}

	// Add mode — two-step: search user → set role/branch/title
	return (
		<AddStaffSearchFlow
			business={{
				name: business.name,
				branches: apiBranches.map((b) => ({ id: b.id, name: b.name })),
			}}
			onClose={() => setSheet(null)}
			onAdd={addStaff}
		/>
	);
}

function AddStaffSearchFlow({
	business,
	onClose,
	onAdd,
}: {
	business: { name: string; branches: { id: string; name: string }[] };
	onClose: () => void;
	onAdd: (params: {
		userId: string;
		title: string;
		role: "Manager" | "Staff";
		branchId: string;
	}) => void;
}) {
	const [step, setStep] = useState<"search" | "details">("search");
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<User | null>(null);
	const [role, setRole] = useState<"Manager" | "Staff">("Staff");
	const [title, setTitle] = useState("");
	const [branch, setBranch] = useState(business.branches[0]?.id ?? "");

	const searchQuery = useUserSearch(query);
	const results: User[] = (searchQuery.data?.data ?? []) as User[];

	function pickUser(u: User) {
		setSelected(u);
		setStep("details");
	}

	function submit() {
		if (!selected) return;
		onAdd({
			userId: selected.id,
			title:
				title.trim() || (role === "Manager" ? "Branch Manager" : "Therapist"),
			role,
			branchId: branch,
		});
	}

	if (step === "search") {
		return (
			<Sheet visible title="Add a teammate" onClose={onClose}>
				<View style={{ gap: 14 }}>
					<TextField
						label="Search by name or email"
						value={query}
						onChangeText={setQuery}
						placeholder="e.g. Priya Menon"
						autoFocus
					/>

					{searchQuery.isFetching && (
						<View style={{ alignItems: "center", paddingVertical: 12 }}>
							<ActivityIndicator size="small" color={Colors.primary600} />
						</View>
					)}

					{!searchQuery.isFetching &&
						query.trim().length >= 2 &&
						results.length === 0 && (
							<Text
								style={{
									fontSize: 14,
									color: Colors.ink400,
									textAlign: "center",
									paddingVertical: 12,
								}}
							>
								No users found for "{query}"
							</Text>
						)}

					{results.map((u) => (
						<TouchableOpacity
							key={u.id}
							onPress={() => pickUser(u)}
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 12,
								padding: 12,
								borderRadius: Radius.md,
								backgroundColor: Colors.surface,
								borderWidth: 1,
								borderColor: Colors.line,
							}}
						>
							<View
								style={{
									width: 40,
									height: 40,
									borderRadius: 20,
									backgroundColor: Colors.primary100,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Text
									style={{
										fontSize: 16,
										fontWeight: "600",
										color: Colors.primary700,
									}}
								>
									{(u.name?.trim()[0] ?? "?").toUpperCase()}
								</Text>
							</View>
							<View style={{ flex: 1 }}>
								<Text
									style={{
										fontSize: 15,
										fontWeight: "600",
										color: Colors.ink900,
									}}
								>
									{u.name}
								</Text>
								{u.email && (
									<Text
										style={{ fontSize: 13, color: Colors.ink500, marginTop: 1 }}
									>
										{u.email}
									</Text>
								)}
							</View>
							<Icon name="ChevronRight" size={16} color={Colors.ink300} />
						</TouchableOpacity>
					))}

					{query.trim().length < 2 && (
						<Text
							style={{
								fontSize: 13,
								color: Colors.ink400,
								textAlign: "center",
								paddingVertical: 8,
							}}
						>
							Type at least 2 characters to search
						</Text>
					)}
				</View>
			</Sheet>
		);
	}

	// Details step
	const footer = (
		<Button variant="primary" full onPress={submit}>
			Add to team
		</Button>
	);

	return (
		<Sheet visible title="Add a teammate" onClose={onClose} footer={footer}>
			<View style={{ gap: 15 }}>
				{/* Selected user chip */}
				<View
					className="flex-row items-center bg-primary-50 border border-primary-200 rounded-md"
					style={{ gap: 10, padding: 12 }}
				>
					<View
						style={{
							width: 36,
							height: 36,
							borderRadius: 18,
							backgroundColor: Colors.primary100,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Text
							style={{
								fontSize: 14,
								fontWeight: "600",
								color: Colors.primary700,
							}}
						>
							{(selected?.name?.trim()[0] ?? "?").toUpperCase()}
						</Text>
					</View>
					<View style={{ flex: 1 }}>
						<Text
							style={{
								fontSize: 15,
								fontWeight: "700",
								color: Colors.primary900,
							}}
						>
							{selected?.name}
						</Text>
						{selected?.email && (
							<Text style={{ fontSize: 12.5, color: Colors.primary700 }}>
								{selected.email}
							</Text>
						)}
					</View>
					<TouchableOpacity
						onPress={() => {
							setSelected(null);
							setStep("search");
						}}
					>
						<Icon name="X" size={16} color={Colors.primary600} />
					</TouchableOpacity>
				</View>

				<View>
					<Text
						style={{
							fontSize: 13.5,
							fontWeight: "600",
							color: Colors.ink700,
							marginBottom: 8,
						}}
					>
						Role
					</Text>
					<View className="flex-row" style={{ gap: 9 }}>
						{(["Manager", "Staff"] as const).map((r) => (
							<TouchableOpacity
								key={r}
								onPress={() => setRole(r)}
								style={{
									flex: 1,
									padding: 11,
									borderRadius: Radius.md,
									alignItems: "center",
									backgroundColor:
										role === r ? Colors.primary100 : Colors.surface,
									borderWidth: role === r ? 1.5 : 1,
									borderColor:
										role === r ? Colors.primary300 : Colors.lineStrong,
								}}
							>
								<Text
									style={{
										fontSize: 14,
										fontWeight: "600",
										color: role === r ? Colors.primary700 : Colors.ink600,
									}}
								>
									{r}
								</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>

				<PickerField
					label="Branch"
					value={business.branches.find((b) => b.id === branch)?.name ?? ""}
					options={business.branches.map((b) => b.name)}
					onChange={(name) => {
						const found = business.branches.find((b) => b.name === name);
						if (found) setBranch(found.id);
					}}
				/>
				<TextField
					label="Job title (optional)"
					value={title}
					onChangeText={setTitle}
					placeholder={role === "Manager" ? "Branch Manager" : "Therapist"}
				/>

				<View className="flex-row items-start" style={{ gap: 9 }}>
					<Icon
						name="Mail"
						size={15}
						color={Colors.primary600}
						style={{ marginTop: 1 }}
					/>
					<Text
						style={{
							flex: 1,
							fontSize: 12.5,
							lineHeight: 20,
							color: Colors.ink400,
						}}
					>
						{selected?.name?.split(" ")[0]} will be added to {business.name} on
						Talash for Business.
					</Text>
				</View>
			</View>
		</Sheet>
	);
}

// ---- Add branch sheet ----
export function AddBranchSheet() {
	const { setSheet, addBranchToBusiness } = useApp();
	const [name, setName] = useState("");
	const [area, setArea] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const valid = name.trim();

	async function save() {
		if (!valid || submitting) return;
		setSubmitting(true);
		try {
			await addBranchToBusiness(name.trim(), area.trim() || undefined);
		} finally {
			setSubmitting(false);
		}
	}

	const footer = (
		<Button
			variant="primary"
			full
			disabled={!valid || submitting}
			onPress={save}
		>
			Add branch
		</Button>
	);

	return (
		<Sheet
			visible
			title="Add a branch"
			onClose={() => setSheet(null)}
			footer={footer}
		>
			<View style={{ gap: 15 }}>
				<TextField
					label="Branch name"
					value={name}
					onChangeText={setName}
					placeholder="e.g. Powai"
					autoFocus
				/>
				<TextField
					label="Area / landmark (optional)"
					value={area}
					onChangeText={setArea}
					placeholder="e.g. Hiranandani Gardens"
				/>
				<View className="flex-row items-start" style={{ gap: 9 }}>
					<Icon
						name="Info"
						size={15}
						color={Colors.primary600}
						style={{ marginTop: 1 }}
					/>
					<Text
						style={{
							flex: 1,
							fontSize: 12.5,
							lineHeight: 20,
							color: Colors.ink400,
						}}
					>
						New branches start empty — add services and assign team once it's
						created.
					</Text>
				</View>
			</View>
		</Sheet>
	);
}

// ---- Edit business profile sheet ----
export function EditBusinessSheet() {
	const qc = useQueryClient();
	const {
		setSheet,
		businessId,
		business,
		updateBusiness,
		appendBusinessPhotoUrl,
		flash,
	} = useApp();
	const cats = BUSINESS_CATEGORY_LABELS.includes(business.category)
		? BUSINESS_CATEGORY_LABELS
		: [business.category, ...BUSINESS_CATEGORY_LABELS];

	const [name, setName] = useState(business.name);
	const [category, setCategory] = useState(business.category);
	const [city, setCity] = useState(business.city);
	const [description, setDescription] = useState(business.description);
	const [uploading, setUploading] = useState(false);

	const valid = name.trim() && city.trim();

	function save() {
		if (!valid) return;
		updateBusiness({
			name: name.trim(),
			category,
			city: city.trim(),
			description: description.trim(),
		});
	}

	async function pickAndUploadPhoto() {
		const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!perm.granted) {
			flash("Camera roll permission required", { tone: "danger" });
			return;
		}
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: true,
			aspect: [16, 9],
			quality: 0.85,
		});
		if (result.canceled || !result.assets[0]) return;
		const asset = result.assets[0];
		const formData = new FormData();
		formData.append("file", {
			uri: asset.uri,
			name: asset.fileName ?? "business.jpg",
			type: asset.mimeType ?? "image/jpeg",
		} as unknown as Blob);
		if (!businessId) {
			flash("Business not loaded yet", { tone: "danger" });
			return;
		}
		setUploading(true);
		try {
			const res = await api.businesses.uploadPhoto(businessId, formData);
			const url =
				(res as { data?: { url: string }; url?: string }).data?.url ??
				(res as { url?: string }).url;
			if (url) appendBusinessPhotoUrl(url);
			await qc.invalidateQueries({ queryKey: ["business", "owner"] });
			if (businessId)
				await qc.invalidateQueries({
					queryKey: ["business-photos", businessId],
				});
			flash("Photo uploaded", { tone: "success", icon: "Image" });
		} catch (e: unknown) {
			flash((e as Error).message ?? "Upload failed", { tone: "danger" });
		} finally {
			setUploading(false);
		}
	}

	const footer = (
		<Button variant="primary" full disabled={!valid} onPress={save}>
			Save changes
		</Button>
	);

	return (
		<Sheet
			visible
			title="Edit business profile"
			onClose={() => setSheet(null)}
			footer={footer}
		>
			<View style={{ gap: 15 }}>
				<TextField
					label="Business name"
					value={name}
					onChangeText={setName}
					placeholder="e.g. Aanya Spa & Hammam"
				/>
				<View style={{ flexDirection: "row", gap: 12 }}>
					<PickerField
						label="Category"
						value={category}
						options={cats}
						onChange={setCategory}
						style={{ flex: 1 }}
					/>
					<TextField
						label="City"
						value={city}
						onChangeText={setCity}
						placeholder="e.g. Mumbai"
						style={{ flex: 1 }}
					/>
				</View>
				<TextField
					label="Description"
					hint="Shown on your public profile."
					value={description}
					onChangeText={setDescription}
					placeholder="What makes your place special?"
					multiline
					rows={4}
				/>
				<TouchableOpacity
					onPress={pickAndUploadPhoto}
					disabled={uploading}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 9,
						padding: 13,
						borderRadius: Radius.md,
						borderWidth: 1.5,
						borderStyle: "dashed",
						borderColor: Colors.lineStrong,
						opacity: uploading ? 0.6 : 1,
					}}
				>
					{uploading ? (
						<ActivityIndicator size="small" color={Colors.primary600} />
					) : (
						<Icon name="ImagePlus" size={18} color={Colors.primary600} />
					)}
					<Text
						style={{
							fontSize: 14,
							fontWeight: "600",
							color: Colors.primary600,
						}}
					>
						{uploading ? "Uploading…" : "Add a business photo"}
					</Text>
				</TouchableOpacity>
			</View>
		</Sheet>
	);
}

export function EditBranchSheet({
	branchId,
	name: initialName,
	address: initialAddress,
	city: initialCity,
}: {
	branchId: string;
	name: string;
	address: string;
	city: string;
}) {
	const { setSheet, flash } = useApp();
	const updateMut = useUpdateBranch();
	const [name, setName] = useState(initialName);
	const [address, setAddress] = useState(initialAddress);
	const [city, setCity] = useState(initialCity);
	const valid = name.trim() && city.trim();

	const footer = (
		<Button
			variant="primary"
			full
			disabled={!valid || updateMut.isPending}
			onPress={() => {
				updateMut.mutate(
					{
						id: branchId,
						body: {
							name: name.trim(),
							address: address.trim() || name.trim(),
							city: city.trim(),
						},
					},
					{
						onSuccess: () => {
							setSheet(null);
							flash("Branch updated.", { tone: "success", icon: "MapPin" });
						},
						onError: (e: Error) => flash(e.message, { tone: "danger" }),
					},
				);
			}}
		>
			Save changes
		</Button>
	);

	return (
		<Sheet
			visible
			title="Edit branch"
			onClose={() => setSheet(null)}
			footer={footer}
		>
			<View style={{ gap: 15 }}>
				<TextField label="Branch name" value={name} onChangeText={setName} />
				<TextField
					label="Address"
					value={address}
					onChangeText={setAddress}
					placeholder="Street address"
				/>
				<TextField label="City" value={city} onChangeText={setCity} />
			</View>
		</Sheet>
	);
}

export function BranchHoursSheet({
	branchId,
	branchName,
}: {
	branchId: string;
	branchName: string;
}) {
	const { setSheet, flash } = useApp();
	const hoursQ = useBranchHours(branchId);
	const upsertMut = useUpsertBranchHours();

	return (
		<WeekScheduleEditor
			title="Working hours"
			intro={`Opening hours for ${branchName}.`}
			saveLabel="Save hours"
			savingLabel="Saving…"
			closedLabel="Closed"
			isLoading={hoursQ.isLoading}
			isError={hoursQ.isError}
			isSaving={upsertMut.isPending}
			data={
				hoursQ.data === undefined ? undefined : mergeWeekSchedule(hoursQ.data)
			}
			onClose={() => setSheet(null)}
			onRetry={() => hoursQ.refetch()}
			onSave={(schedule) => {
				upsertMut.mutate(
					{ id: branchId, body: { hours: serializeWeekSchedule(schedule) } },
					{
						onSuccess: () => {
							setSheet(null);
							flash("Working hours saved.", { tone: "success", icon: "Clock" });
						},
						onError: (e: Error) => flash(e.message, { tone: "danger" }),
					},
				);
			}}
		/>
	);
}

// ---- Staff availability sheet ----
export function StaffAvailabilitySheet({
	teamMemberId,
	memberName,
}: {
	teamMemberId: string;
	memberName: string;
}) {
	const { setSheet, flash } = useApp();
	const availQ = useStaffAvailability(teamMemberId);
	const upsertMut = useUpsertStaffAvailability();

	return (
		<WeekScheduleEditor
			title="Staff availability"
			intro={`Working hours for ${memberName}.`}
			saveLabel="Save availability"
			savingLabel="Saving…"
			closedLabel="Off"
			isLoading={availQ.isLoading}
			isError={availQ.isError}
			isSaving={upsertMut.isPending}
			data={
				availQ.data === undefined
					? undefined
					: mergeWeekSchedule(
							availQ.data.map((a) => ({
								dayOfWeek: a.dayOfWeek,
								isClosed: a.isClosed,
								openTime: a.startTime,
								closeTime: a.endTime,
							})),
						)
			}
			onClose={() => setSheet(null)}
			onRetry={() => availQ.refetch()}
			onSave={(schedule) => {
				upsertMut.mutate(
					{
						id: teamMemberId,
						body: {
							availability: serializeWeekSchedule(schedule).map((d) => ({
								dayOfWeek: d.dayOfWeek,
								isClosed: d.isClosed,
								startTime: d.openTime,
								endTime: d.closeTime,
							})),
						},
					},
					{
						onSuccess: () => {
							setSheet(null);
							flash("Availability saved.", { tone: "success", icon: "Clock" });
						},
						onError: (e: Error) => flash(e.message, { tone: "danger" }),
					},
				);
			}}
		/>
	);
}

// ---- Create coupon sheet ----
export function CreateCouponSheet() {
	const { setSheet, createCoupon } = useApp();
	const [code, setCode] = useState("");
	const [type, setType] = useState<"Percentage" | "Fixed">("Percentage");
	const [value, setValue] = useState("");
	const [max, setMax] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const draftValue = value === "" ? Number.NaN : Number(value);
	const draftMax = max === "" ? undefined : Number(max);
	const validation = validateCoupon({
		code,
		type,
		value: draftValue,
		max: draftMax,
	});
	const errorText = validation.ok ? null : validation.error;
	// Only nag once the owner has started entering something.
	const showError =
		(code.trim() !== "" || value !== "" || max !== "") && !!errorText;

	async function save() {
		if (!validation.ok || submitting) return;
		setSubmitting(true);
		try {
			await createCoupon({
				code: code.trim().toUpperCase(),
				type,
				value: draftValue,
				max: draftMax ?? 100,
			});
		} finally {
			setSubmitting(false);
		}
	}

	const footer = (
		<Button
			variant="primary"
			full
			disabled={!validation.ok || submitting}
			onPress={save}
		>
			Create coupon
		</Button>
	);

	return (
		<Sheet
			visible
			title="Create coupon"
			onClose={() => setSheet(null)}
			footer={footer}
		>
			<View style={{ gap: 15 }}>
				<TextField
					label="Code"
					hint="What customers type at checkout."
					value={code}
					onChangeText={setCode}
					placeholder="WELCOME20"
					autoFocus
				/>
				<View>
					<Text
						style={{
							fontSize: 13.5,
							fontWeight: "600",
							color: Colors.ink700,
							marginBottom: 8,
						}}
					>
						Discount type
					</Text>
					<View className="flex-row" style={{ gap: 9 }}>
						{(["Percentage", "Fixed"] as const).map((t) => (
							<TouchableOpacity
								key={t}
								onPress={() => setType(t)}
								style={{
									flex: 1,
									padding: 11,
									borderRadius: Radius.md,
									alignItems: "center",
									backgroundColor:
										type === t ? Colors.primary100 : Colors.surface,
									borderWidth: type === t ? 1.5 : 1,
									borderColor:
										type === t ? Colors.primary300 : Colors.lineStrong,
								}}
							>
								<Text
									style={{
										fontSize: 14,
										fontWeight: "600",
										color: type === t ? Colors.primary700 : Colors.ink600,
									}}
								>
									{t === "Percentage" ? "% off" : "৳ off"}
								</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>
				<View style={{ flexDirection: "row", gap: 12 }}>
					<TextField
						label={type === "Percentage" ? "Percent off" : "Amount off (৳)"}
						value={value}
						onChangeText={(v) => setValue(v.replace(/\D/g, ""))}
						placeholder={type === "Percentage" ? "20" : "500"}
						keyboardType="numeric"
						style={{ flex: 1 }}
					/>
					<TextField
						label="Max uses"
						value={max}
						onChangeText={(v) => setMax(v.replace(/\D/g, ""))}
						placeholder="100"
						keyboardType="numeric"
						style={{ flex: 1 }}
					/>
				</View>
				{showError && (
					<Text style={{ fontSize: 13, color: Colors.danger }}>
						{errorText}
					</Text>
				)}
			</View>
		</Sheet>
	);
}

// ---- Coupon detail sheet ----
export function CouponDetailSheet({ coupon }: { coupon: Coupon }) {
	const { setSheet, toggleCoupon } = useApp();
	const detailQuery = useQuery({
		queryKey: ["coupon", coupon.id],
		queryFn: () => api.coupons.get(coupon.id),
		staleTime: 30_000,
		placeholderData: {
			data: {
				...coupon,
				usedCount: coupon.used,
				maxUses: coupon.max,
				expiresAt: coupon.expires,
				status: coupon.status,
				// biome-ignore lint/suspicious/noExplicitAny: placeholder shape differs from API response type
			} as any,
		},
	});
	const c = detailQuery.data?.data ?? null;
	const pct =
		c && c.maxUses > 0
			? Math.min(100, Math.round((c.usedCount / c.maxUses) * 100))
			: 0;

	const row = (label: string, val: string) => (
		<View
			key={label}
			style={{
				flexDirection: "row",
				justifyContent: "space-between",
				paddingVertical: 12,
				borderTopWidth: 1,
				borderTopColor: Colors.lineSoft,
			}}
		>
			<Text style={{ fontSize: 14, color: Colors.ink500 }}>{label}</Text>
			<Text style={{ fontSize: 14, fontWeight: "600", color: Colors.ink900 }}>
				{val}
			</Text>
		</View>
	);

	const footer =
		coupon.status === "Active" ? (
			<Button
				variant="ghost"
				full
				icon="X"
				onPress={() => {
					toggleCoupon(coupon.id);
					setSheet(null);
				}}
			>
				Deactivate code
			</Button>
		) : undefined;

	return (
		<Sheet
			visible
			title={coupon.code}
			onClose={() => setSheet(null)}
			footer={footer}
		>
			{c ? (
				<View>
					{row(
						"Type",
						c.type === "Percentage"
							? `${c.value}% off`
							: `${money(c.value)} off`,
					)}
					{row("Status", c.status)}
					{row("Max uses", String(c.maxUses))}
					{row("Used", String(c.usedCount))}
					{row("Expires", coupon.expires)}
					<View style={{ marginTop: 14 }}>
						<View
							style={{
								flexDirection: "row",
								justifyContent: "space-between",
								marginBottom: 5,
							}}
						>
							<Text style={{ fontSize: 12.5, color: Colors.ink500 }}>
								{c.usedCount} of {c.maxUses} redemptions
							</Text>
							<Text style={{ fontSize: 12.5, color: Colors.ink500 }}>
								{pct}%
							</Text>
						</View>
						<View
							style={{
								height: 7,
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
									backgroundColor: Colors.primary500,
								}}
							/>
						</View>
					</View>
				</View>
			) : (
				<ActivityIndicator color={Colors.primary600} />
			)}
		</Sheet>
	);
}

// ---- Record payment sheet ----
export function RecordPaymentSheet({
	businessId,
	userId,
	customerName,
	due,
}: {
	businessId: string;
	userId: string;
	customerName: string;
	due: number;
}) {
	const { setSheet, flash } = useApp();
	const recordMut = useRecordPayment();
	const [amount, setAmount] = useState(due > 0 ? String(due) : "");
	const [note, setNote] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const amountNum = Number(amount) || 0;
	const valid = Number.isInteger(amountNum) && amountNum > 0;

	function submit() {
		if (!valid || submitting) return;
		setSubmitting(true);
		recordMut.mutate(
			{
				businessId,
				userId,
				amount: amountNum,
				note: note.trim() ? note.trim() : undefined,
			},
			{
				onSuccess: () => {
					setSheet(null);
					flash("Payment recorded.", { tone: "success" });
				},
				onError: (e: unknown) => {
					setSubmitting(false);
					flash((e as Error).message ?? "Failed to record payment", {
						tone: "danger",
					});
				},
			},
		);
	}

	const footer = (
		<Button
			variant="primary"
			icon="Check"
			full
			disabled={!valid || submitting}
			onPress={submit}
		>
			Record payment
		</Button>
	);

	return (
		<Sheet
			visible
			title="Record Payment"
			onClose={() => setSheet(null)}
			footer={footer}
		>
			<View style={{ gap: 14 }}>
				<Text className="text-ink-500" style={{ fontSize: 13.5 }}>
					Cash received from {customerName} (current due {money(due)})
				</Text>
				<TextField
					label="Amount (৳)"
					value={amount}
					onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
					keyboardType="numeric"
					placeholder="0"
				/>
				<TextField
					label="Note (optional)"
					value={note}
					onChangeText={setNote}
					placeholder="e.g. partial, bKash ref…"
				/>
			</View>
		</Sheet>
	);
}

// ---- Edit profile sheet ----
export function EditProfileSheet({
	userId,
	name,
	email,
}: {
	userId: string;
	name: string;
	email: string;
}) {
	const { setSheet } = useApp();
	const qc = useQueryClient();
	const [editName, setEditName] = useState(name);

	const updateMut = useMutation({
		mutationFn: (n: string) => api.users.update(userId, { name: n }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["auth", "me"] });
			qc.invalidateQueries({ queryKey: ["business", "owner"] });
			setSheet(null);
		},
	});

	const footer = (
		<Button
			variant="primary"
			full
			disabled={!editName.trim() || editName === name || updateMut.isPending}
			onPress={() => {
				if (editName.trim() !== name) updateMut.mutate(editName.trim());
			}}
		>
			{updateMut.isPending ? "Saving…" : "Save changes"}
		</Button>
	);

	return (
		<Sheet
			visible
			title="Edit profile"
			onClose={() => setSheet(null)}
			footer={footer}
		>
			<View style={{ gap: 15 }}>
				<TextField
					label="Full name"
					value={editName}
					onChangeText={setEditName}
					autoFocus
				/>
				<View>
					<Text
						style={{
							fontSize: 13.5,
							fontWeight: "600",
							color: Colors.ink700,
							marginBottom: 6,
						}}
					>
						Email
					</Text>
					<View
						style={{
							padding: 12,
							borderRadius: Radius.md,
							borderWidth: 1,
							borderColor: Colors.line,
							backgroundColor: Colors.lineSoft,
						}}
					>
						<Text style={{ fontSize: 15.5, color: Colors.ink400 }}>
							{email}
						</Text>
					</View>
					<Text style={{ fontSize: 12, color: Colors.ink400, marginTop: 5 }}>
						Email cannot be changed.
					</Text>
				</View>
			</View>
		</Sheet>
	);
}
