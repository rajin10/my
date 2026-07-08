import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	BUSINESS_CATEGORIES,
	type Business,
	CATEGORY_OPTIONS,
	type Service,
} from "../data";
import { Colors, Radius, Shadow } from "../tokens";
import {
	Avatar,
	Button,
	Card,
	Eyebrow,
	Icon,
	type IconName,
	PickerField,
	TextField,
} from "./ui";

const SETUP_STEPS = [
	{
		id: "basics",
		eyebrow: "Your business",
		title: "The basics",
		sub: "Tell customers who you are.",
	},
	{
		id: "branches",
		eyebrow: "Locations",
		title: "Your branches",
		sub: "Where can customers book you?",
	},
	{
		id: "services",
		eyebrow: "Your menu",
		title: "Add services",
		sub: "List what customers can book.",
	},
	{
		id: "review",
		eyebrow: "Almost there",
		title: "Review & go live",
		sub: "Check everything, then make it public.",
	},
];

export type SetupFormData = {
	ownerName: string;
	businessName: string;
	category: string;
	city: string;
	description: string;
	branches: { name: string; area: string }[];
	services: Service[];
};

type FormData = SetupFormData;

function SetupWelcome({
	onStart,
	onCancel,
}: {
	onStart: () => void;
	onCancel: () => void;
}) {
	const insets = useSafeAreaInsets();
	const checklist = [
		{ n: 1, label: "Tell us about your business" },
		{ n: 2, label: "Add your branches & services" },
		{ n: 3, label: "Go live and start taking bookings" },
	];
	return (
		<View style={{ flex: 1, backgroundColor: Colors.primary900 }}>
			<View
				style={{
					position: "absolute",
					top: -80,
					right: -80,
					width: 280,
					height: 280,
					borderRadius: 140,
					backgroundColor: "rgba(63,184,155,0.12)",
				}}
			/>
			<View
				style={{
					position: "absolute",
					bottom: 160,
					left: -60,
					width: 220,
					height: 220,
					borderRadius: 110,
					backgroundColor: "rgba(201,160,99,0.1)",
				}}
			/>

			<View
				style={{
					flex: 1,
					justifyContent: "flex-end",
					paddingHorizontal: 28,
					paddingBottom: 8,
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 10,
						marginBottom: "auto",
						marginTop: insets.top + 20,
					}}
				>
					<View
						style={{
							width: 32,
							height: 32,
							borderRadius: Radius.sm,
							backgroundColor: Colors.primary600,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Icon name="Sparkles" size={18} color="#fff" />
					</View>
					<Text style={{ fontSize: 24, fontWeight: "600", color: "#fff" }}>
						Talash
					</Text>
				</View>

				<Text
					style={{
						fontSize: 11.5,
						fontWeight: "700",
						letterSpacing: 2,
						textTransform: "uppercase",
						color: Colors.gold300,
						marginBottom: 14,
					}}
				>
					Welcome aboard
				</Text>
				<Text
					style={{
						fontSize: 36,
						fontWeight: "400",
						lineHeight: 42,
						letterSpacing: -0.5,
						color: "#fff",
					}}
				>
					Let's set up{"\n"}
					<Text style={{ fontStyle: "italic", color: Colors.primary300 }}>
						your business.
					</Text>
				</Text>
				<Text
					style={{
						marginTop: 16,
						marginBottom: 22,
						fontSize: 16,
						lineHeight: 26,
						color: Colors.primary200,
					}}
				>
					A few quick steps and you'll be live on Talash — taking bookings the
					same day.
				</Text>
				<View style={{ gap: 14 }}>
					{checklist.map((c) => (
						<View
							key={c.n}
							className="flex-row items-center"
							style={{ gap: 13 }}
						>
							<View
								style={{
									width: 30,
									height: 30,
									borderRadius: 15,
									backgroundColor: "rgba(255,255,255,0.1)",
									borderWidth: 1,
									borderColor: "rgba(255,255,255,0.2)",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Text style={{ fontSize: 15, color: Colors.primary200 }}>
									{c.n}
								</Text>
							</View>
							<Text
								style={{ fontSize: 15.5, color: "#fff", fontWeight: "500" }}
							>
								{c.label}
							</Text>
						</View>
					))}
				</View>
			</View>

			<View
				style={{
					paddingHorizontal: 24,
					paddingBottom: insets.bottom + 20,
					paddingTop: 24,
				}}
			>
				<TouchableOpacity
					onPress={onStart}
					style={{
						paddingVertical: 16,
						borderRadius: Radius.md,
						backgroundColor: "#fff",
						alignItems: "center",
					}}
				>
					<Text
						style={{
							fontSize: 16,
							fontWeight: "700",
							color: Colors.primary900,
						}}
					>
						Get started
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={onCancel}
					style={{ paddingVertical: 12, alignItems: "center" }}
				>
					<Text
						style={{
							fontSize: 14,
							fontWeight: "600",
							color: Colors.primary300,
						}}
					>
						I'll do this later
					</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

function BasicsStep({
	f,
	upd,
}: {
	f: FormData;
	upd: (p: Partial<FormData>) => void;
}) {
	return (
		<View style={{ gap: 16 }}>
			<TextField
				label="Your name"
				value={f.ownerName}
				onChangeText={(v) => upd({ ownerName: v })}
				placeholder="e.g. Sara Khan"
			/>
			<TextField
				label="Business name"
				value={f.businessName}
				onChangeText={(v) => upd({ businessName: v })}
				placeholder="e.g. Aanya Spa & Hammam"
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
					Category
				</Text>
				<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
					{BUSINESS_CATEGORIES.map((c) => {
						const on = f.category === c.label;
						return (
							<TouchableOpacity
								key={c.label}
								onPress={() => upd({ category: c.label })}
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: 9,
									paddingHorizontal: 12,
									paddingVertical: 12,
									borderRadius: Radius.md,
									backgroundColor: on ? Colors.primary50 : Colors.surface,
									borderWidth: 1.5,
									borderColor: on ? Colors.primary400 : Colors.lineStrong,
									width: "48%",
								}}
							>
								<Icon
									name={c.icon as IconName}
									size={18}
									color={on ? Colors.primary600 : Colors.ink400}
								/>
								<Text
									style={{
										fontSize: 13.5,
										fontWeight: "600",
										color: on ? Colors.primary800 : Colors.ink700,
										flex: 1,
									}}
								>
									{c.label}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</View>
			<TextField
				label="City"
				value={f.city}
				onChangeText={(v) => upd({ city: v })}
				placeholder="e.g. Mumbai"
			/>
			<TextField
				label="Short description"
				hint="A sentence customers will see on your profile."
				value={f.description}
				onChangeText={(v) => upd({ description: v })}
				placeholder="What makes your place special?"
				multiline
				rows={3}
			/>
		</View>
	);
}

function BranchesStep({
	f,
	upd,
}: {
	f: FormData;
	upd: (p: Partial<FormData>) => void;
}) {
	const [name, setName] = useState("");
	const [area, setArea] = useState("");
	function add() {
		if (!name.trim()) return;
		upd({
			branches: [...f.branches, { name: name.trim(), area: area.trim() }],
		});
		setName("");
		setArea("");
	}
	function remove(i: number) {
		upd({ branches: f.branches.filter((_, k) => k !== i) });
	}
	return (
		<View style={{ gap: 16 }}>
			{f.branches.map((b, i) => (
				<Card key={b.name || i} pad={14}>
					<View className="flex-row items-center" style={{ gap: 12 }}>
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
							<Icon name="MapPin" size={18} color={Colors.primary600} />
						</View>
						<View className="flex-1">
							<Text
								style={{
									fontSize: 15,
									fontWeight: "600",
									color: Colors.ink900,
								}}
							>
								{b.name}
							</Text>
							<Text
								style={{ fontSize: 12.5, color: Colors.ink400, marginTop: 1 }}
							>
								{b.area || (i === 0 ? "Main branch" : "Branch")}
							</Text>
						</View>
						<TouchableOpacity
							onPress={() => remove(i)}
							style={{
								width: 32,
								height: 32,
								borderRadius: 16,
								borderWidth: 1,
								borderColor: Colors.line,
								backgroundColor: Colors.surface,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Icon name="X" size={15} color={Colors.ink400} />
						</TouchableOpacity>
					</View>
				</Card>
			))}

			<View
				style={{
					backgroundColor: Colors.primary50,
					borderWidth: 1,
					borderColor: Colors.primary100,
					borderRadius: Radius.lg,
					padding: 15,
					gap: 11,
				}}
			>
				<TextField
					label="Branch name"
					value={name}
					onChangeText={setName}
					placeholder="e.g. Carter Road"
				/>
				<TextField
					label="Area / landmark (optional)"
					value={area}
					onChangeText={setArea}
					placeholder="e.g. Bandra West"
				/>
				<Button
					variant="ghost"
					full
					icon="Plus"
					disabled={!name.trim()}
					onPress={add}
				>
					Add branch
				</Button>
			</View>

			{f.branches.length === 0 && (
				<Text
					style={{
						fontSize: 13,
						color: Colors.ink400,
						textAlign: "center",
						lineHeight: 20,
					}}
				>
					Add at least one branch. You can add more anytime from the dashboard.
				</Text>
			)}
		</View>
	);
}

function ServicesStep({
	f,
	upd,
}: {
	f: FormData;
	upd: (p: Partial<FormData>) => void;
}) {
	const branchNames = f.branches.map((b) => b.name);
	const [d, setD] = useState({
		name: "",
		branch: branchNames[0] || "",
		category: CATEGORY_OPTIONS[0],
		duration: "60",
		price: "",
	});
	const setd = (patch: Partial<typeof d>) => setD((v) => ({ ...v, ...patch }));
	const valid = d.name.trim() && d.price;

	function add() {
		if (!valid) return;
		upd({
			services: [
				...f.services,
				{
					id: `svc${Date.now()}`,
					name: d.name.trim(),
					branch: d.branch || branchNames[0],
					category: d.category,
					duration: Number(d.duration) || 30,
					price: Number(d.price) || 0,
					desc: "",
				},
			],
		});
		setD({
			name: "",
			branch: d.branch,
			category: d.category,
			duration: "60",
			price: "",
		});
	}
	function remove(id: string) {
		upd({ services: f.services.filter((s) => s.id !== id) });
	}

	return (
		<View style={{ gap: 16 }}>
			{f.services.map((s) => (
				<Card key={s.id} pad={13}>
					<View className="flex-row items-center" style={{ gap: 12 }}>
						<View className="flex-1">
							<View
								style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
							>
								<View
									style={{
										backgroundColor: Colors.primary50,
										borderRadius: Radius.pill,
										paddingHorizontal: 8,
										paddingVertical: 2,
									}}
								>
									<Text
										style={{
											fontSize: 11,
											fontWeight: "600",
											color: Colors.primary700,
										}}
									>
										{s.category}
									</Text>
								</View>
								<Text style={{ fontSize: 12, color: Colors.ink400 }}>
									{s.branch}
								</Text>
							</View>
							<Text
								style={{
									fontSize: 14.5,
									fontWeight: "700",
									color: Colors.ink900,
									marginTop: 5,
								}}
							>
								{s.name}
							</Text>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: 12,
									marginTop: 4,
								}}
							>
								<View
									style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
								>
									<Icon name="Clock" size={13} color={Colors.ink500} />
									<Text style={{ fontSize: 12.5, color: Colors.ink500 }}>
										{s.duration} min
									</Text>
								</View>
								<Text
									style={{
										fontSize: 12.5,
										fontWeight: "700",
										color: Colors.ink900,
									}}
								>
									৳{s.price.toLocaleString("en-BD")}
								</Text>
							</View>
						</View>
						<TouchableOpacity
							onPress={() => remove(s.id)}
							style={{
								width: 32,
								height: 32,
								borderRadius: 16,
								borderWidth: 1,
								borderColor: Colors.line,
								backgroundColor: Colors.surface,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Icon name="X" size={15} color={Colors.ink400} />
						</TouchableOpacity>
					</View>
				</Card>
			))}

			<View
				style={{
					backgroundColor: Colors.primary50,
					borderWidth: 1,
					borderColor: Colors.primary100,
					borderRadius: Radius.lg,
					padding: 15,
					gap: 11,
				}}
			>
				<TextField
					label="Service name"
					value={d.name}
					onChangeText={(v) => setd({ name: v })}
					placeholder="e.g. Signature Hammam Ritual"
				/>
				<View style={{ flexDirection: "row", gap: 11 }}>
					{branchNames.length > 1 && (
						<PickerField
							label="Branch"
							value={d.branch}
							options={branchNames}
							onChange={(v) => setd({ branch: v })}
							style={{ flex: 1 }}
						/>
					)}
					<PickerField
						label="Category"
						value={d.category}
						options={CATEGORY_OPTIONS}
						onChange={(v) => setd({ category: v })}
						style={{ flex: 1 }}
					/>
				</View>
				<View style={{ flexDirection: "row", gap: 11 }}>
					<TextField
						label="Duration (min)"
						value={d.duration}
						onChangeText={(v) => setd({ duration: v.replace(/\D/g, "") })}
						keyboardType="numeric"
						style={{ flex: 1 }}
					/>
					<TextField
						label="Price (৳)"
						value={d.price}
						onChangeText={(v) => setd({ price: v.replace(/\D/g, "") })}
						placeholder="2400"
						keyboardType="numeric"
						style={{ flex: 1 }}
					/>
				</View>
				<Button
					variant="ghost"
					full
					icon="Plus"
					disabled={!valid}
					onPress={add}
				>
					Add service
				</Button>
			</View>

			{f.services.length === 0 && (
				<Text
					style={{
						fontSize: 13,
						color: Colors.ink400,
						textAlign: "center",
						lineHeight: 20,
					}}
				>
					Add at least one service to go live. Most businesses start with two or
					three.
				</Text>
			)}
		</View>
	);
}

function ReviewStep({ f }: { f: FormData }) {
	return (
		<View style={{ gap: 16 }}>
			<Card pad={18}>
				<View className="flex-row items-center" style={{ gap: 13 }}>
					<Avatar
						name={f.businessName || "New business"}
						size={50}
						bg={Colors.primary900}
						fg="#fff"
					/>
					<View className="flex-1">
						<Text
							style={{
								fontSize: 20,
								fontWeight: "500",
								letterSpacing: -0.2,
								color: Colors.ink900,
							}}
						>
							{f.businessName || "Your business"}
						</Text>
						<Text style={{ fontSize: 13, color: Colors.ink500, marginTop: 2 }}>
							{f.category} · {f.city || "—"}
						</Text>
					</View>
					<View
						style={{
							backgroundColor: Colors.lineSoft,
							borderRadius: Radius.pill,
							paddingHorizontal: 10,
							paddingVertical: 4,
						}}
					>
						<Text
							style={{
								fontSize: 11.5,
								fontWeight: "700",
								color: Colors.ink500,
							}}
						>
							Draft
						</Text>
					</View>
				</View>
				{f.description.trim() ? (
					<Text
						style={{
							marginTop: 14,
							fontSize: 13.5,
							lineHeight: 22,
							color: Colors.ink600,
						}}
					>
						{f.description.trim()}
					</Text>
				) : null}
				<View>
					{[
						["Owner", f.ownerName || "—"],
						["Branches", f.branches.map((b) => b.name).join(", ") || "—"],
						["Services", `${f.services.length} added`],
					].map(([label, value], _i) => (
						<View
							key={label}
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								gap: 12,
								paddingVertical: 11,
								borderTopWidth: 1,
								borderTopColor: Colors.lineSoft,
							}}
						>
							<Text style={{ fontSize: 13.5, color: Colors.ink500 }}>
								{label}
							</Text>
							<Text
								style={{
									fontSize: 14,
									fontWeight: "600",
									color: Colors.ink900,
								}}
							>
								{value}
							</Text>
						</View>
					))}
				</View>
			</Card>
			<View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
				<Icon
					name="Info"
					size={16}
					color={Colors.primary600}
					style={{ marginTop: 1 }}
				/>
				<Text
					style={{
						flex: 1,
						fontSize: 13,
						lineHeight: 20,
						color: Colors.ink500,
					}}
				>
					Going live makes{" "}
					<Text style={{ fontWeight: "700", color: Colors.ink700 }}>
						{f.businessName || "your business"}
					</Text>{" "}
					visible to customers on Talash. You can switch back to Draft anytime.
				</Text>
			</View>
		</View>
	);
}

function SetupLive({
	business,
	onContinue,
}: {
	business: Business;
	onContinue: () => void;
}) {
	const insets = useSafeAreaInsets();
	return (
		<View
			style={{
				flex: 1,
				backgroundColor: Colors.primary900,
				alignItems: "center",
				justifyContent: "center",
				padding: 32,
			}}
		>
			<View
				style={{
					position: "absolute",
					top: -80,
					right: -80,
					width: 280,
					height: 280,
					borderRadius: 140,
					backgroundColor: "rgba(63,184,155,0.12)",
				}}
			/>

			<View
				style={{
					width: 96,
					height: 96,
					borderRadius: 48,
					backgroundColor: Colors.primary600,
					alignItems: "center",
					justifyContent: "center",
					...Shadow.lg,
				}}
			>
				<Icon name="Check" size={46} color="#fff" strokeWidth={2.5} />
			</View>

			<Text
				style={{
					fontSize: 11.5,
					fontWeight: "700",
					letterSpacing: 2,
					textTransform: "uppercase",
					color: Colors.gold300,
					marginTop: 34,
					marginBottom: 14,
				}}
			>
				You're live
			</Text>
			<Text
				style={{
					fontSize: 30,
					fontWeight: "400",
					lineHeight: 36,
					letterSpacing: -0.5,
					color: "#fff",
					textAlign: "center",
					maxWidth: 300,
				}}
			>
				{business.name} is now{" "}
				<Text style={{ fontStyle: "italic", color: Colors.primary300 }}>
					open
				</Text>
				.
			</Text>
			<Text
				style={{
					marginTop: 20,
					fontSize: 15.5,
					lineHeight: 25,
					color: Colors.primary200,
					textAlign: "center",
					maxWidth: 300,
				}}
			>
				Customers can find and book you on Talash. Let's open your dashboard.
			</Text>

			<View
				style={{
					position: "absolute",
					left: 24,
					right: 24,
					bottom: insets.bottom + 24,
				}}
			>
				<TouchableOpacity
					onPress={onContinue}
					style={{
						paddingVertical: 16,
						borderRadius: Radius.md,
						backgroundColor: "#fff",
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "center",
						gap: 8,
					}}
				>
					<Text
						style={{
							fontSize: 16,
							fontWeight: "700",
							color: Colors.primary900,
						}}
					>
						Go to dashboard
					</Text>
					<Icon name="ArrowRight" size={18} color={Colors.primary900} />
				</TouchableOpacity>
			</View>
		</View>
	);
}

export default function SetupFlow({
	contact,
	onCancel,
	onComplete,
}: {
	contact: string;
	onCancel: () => void;
	onComplete: (form: SetupFormData) => void;
}) {
	const insets = useSafeAreaInsets();
	const [view, setView] = useState<"welcome" | "form" | "done">("welcome");
	const [si, setSi] = useState(0);
	const [f, setF] = useState<FormData>({
		ownerName: "",
		businessName: "",
		category: BUSINESS_CATEGORIES[0].label,
		city: "",
		description: "",
		branches: [],
		services: [],
	});
	const upd = (patch: Partial<FormData>) => setF((v) => ({ ...v, ...patch }));

	const step = SETUP_STEPS[si];
	const validity: Record<string, boolean> = {
		basics: !!(f.ownerName.trim() && f.businessName.trim() && f.city.trim()),
		branches: f.branches.length >= 1,
		services: f.services.length >= 1,
		review: true,
	};
	const canNext = validity[step.id];

	function buildBusiness(): Business {
		return {
			name: f.businessName.trim(),
			category: f.category,
			city: f.city.trim(),
			status: "Active",
			vertical: "booking",
			rating: 0,
			reviews: 0,
			description:
				f.description.trim() ||
				`${f.businessName.trim()} on Talash — now taking bookings.`,
			branches: f.branches.map((b) => b.name),
			photos: ["forest", "clay"],
			owner: {
				name: f.ownerName.trim(),
				role: "Owner",
				email: contact || "owner@email.com",
			},
		};
	}

	function next() {
		if (!canNext) return;
		if (si < SETUP_STEPS.length - 1) setSi((n) => n + 1);
		else setView("done");
	}

	function back() {
		if (si === 0) setView("welcome");
		else setSi((n) => n - 1);
	}

	if (view === "welcome")
		return <SetupWelcome onStart={() => setView("form")} onCancel={onCancel} />;
	if (view === "done")
		return (
			<SetupLive business={buildBusiness()} onContinue={() => onComplete(f)} />
		);

	return (
		<View className="flex-1 bg-paper">
			{/* Header */}
			<View
				style={{
					paddingHorizontal: 16,
					paddingTop: insets.top + 12,
					paddingBottom: 0,
					backgroundColor: Colors.paper,
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<TouchableOpacity
						onPress={back}
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
							Shadow.xs,
						]}
					>
						<Icon name="ChevronLeft" size={21} color={Colors.ink800} />
					</TouchableOpacity>
					<Text
						style={{ fontSize: 13, fontWeight: "600", color: Colors.ink500 }}
					>
						Step {si + 1} of {SETUP_STEPS.length}
					</Text>
				</View>

				<View style={{ flexDirection: "row", gap: 5, marginTop: 14 }}>
					{SETUP_STEPS.map((s, i) => (
						<View
							key={s.id}
							style={{
								flex: 1,
								height: 4,
								borderRadius: 999,
								backgroundColor: i <= si ? Colors.primary600 : Colors.lineSoft,
							}}
						/>
					))}
				</View>

				<View style={{ paddingTop: 18, paddingBottom: 4 }}>
					<Eyebrow>{step.eyebrow}</Eyebrow>
					<Text
						style={{
							marginTop: 8,
							fontSize: 30,
							fontWeight: "400",
							letterSpacing: -0.3,
							color: Colors.ink900,
						}}
					>
						{step.title}
					</Text>
					<Text
						style={{
							marginTop: 6,
							fontSize: 14.5,
							lineHeight: 22,
							color: Colors.ink500,
						}}
					>
						{step.sub}
					</Text>
				</View>
			</View>

			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ padding: 16, paddingTop: 20 }}
				keyboardShouldPersistTaps="handled"
			>
				{step.id === "basics" && <BasicsStep f={f} upd={upd} />}
				{step.id === "branches" && <BranchesStep f={f} upd={upd} />}
				{step.id === "services" && <ServicesStep f={f} upd={upd} />}
				{step.id === "review" && <ReviewStep f={f} />}
				<View style={{ height: 80 }} />
			</ScrollView>

			<View
				style={{
					paddingHorizontal: 16,
					paddingTop: 12,
					paddingBottom: insets.bottom + 16,
					borderTopWidth: 1,
					borderTopColor: Colors.line,
					backgroundColor: Colors.surface,
				}}
			>
				{step.id === "review" ? (
					<Button variant="primary" full size="lg" icon="Rocket" onPress={next}>
						Go live
					</Button>
				) : (
					<Button
						variant="primary"
						full
						size="lg"
						iconRight="ArrowRight"
						disabled={!canNext}
						onPress={next}
					>
						Continue
					</Button>
				)}
			</View>
		</View>
	);
}
