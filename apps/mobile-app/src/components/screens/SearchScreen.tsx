import type { SearchSortBy } from "@repo/api-client";
import { useRouter } from "expo-router";
import * as Icons from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { type Business, CATEGORIES } from "../../data";
import {
	businessesWithMapCoordinates,
	useBusinessMapCoordinates,
} from "../../hooks/useBusinessMapCoordinates";
import {
	type BusinessSearchFilters,
	useBusinessSearch,
} from "../../hooks/useBusinessSearch";
import { useDebounce } from "../../hooks/useDebounce";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";
import { useRecentSellers } from "../../hooks/useRecentSellers";
import { formatMoney } from "../../lib/format";
import { Colors, Radius, Shadow } from "../../tokens";
import { NetworkError } from "../NetworkError";
import { TalashMark } from "../TalashMark";
import { EmptyState, Photo, SectionTitle, Stars } from "../ui";
import MapScreen from "./MapScreen";

const DEFAULT_FILTERS: BusinessSearchFilters = {};

const COMMERCE_AREAS = [
	"Gulshan",
	"Banani",
	"Dhanmondi",
	"Mirpur",
	"Uttara",
	"Mohammadpur",
	"Bashundhara",
	"Panthapath",
];

function activeFilterCount(f: BusinessSearchFilters): number {
	let n = 0;
	if (f.city) n++;
	if (f.minPrice !== undefined) n++;
	if (f.maxPrice !== undefined) n++;
	if (f.minRating !== undefined) n++;
	if (f.sortBy && f.sortBy !== "recommended") n++;
	return n;
}

function FilterSheet({
	filters,
	onApply,
	onClose,
}: {
	filters: BusinessSearchFilters;
	onApply: (f: BusinessSearchFilters) => void;
	onClose: () => void;
}) {
	const [local, setLocal] = useState<BusinessSearchFilters>(filters);
	const SORTS: Array<{ id: SearchSortBy; label: string }> = [
		{ id: "recommended", label: "Recommended" },
		{ id: "rating", label: "Top rated" },
		{ id: "price", label: "Price: low first" },
	];
	const RATINGS = [
		{ value: 4.0, label: "4.0+" },
		{ value: 4.5, label: "4.5+" },
	];

	return (
		<Modal visible transparent animationType="slide" onRequestClose={onClose}>
			<View
				className="flex-1 justify-end"
				style={{ backgroundColor: "rgba(8,54,44,0.4)" }}
			>
				<TouchableOpacity
					style={StyleSheet.absoluteFill}
					onPress={onClose}
					activeOpacity={1}
				/>
				<View
					style={{
						backgroundColor: Colors.paper,
						borderTopLeftRadius: 28,
						borderTopRightRadius: 28,
						maxHeight: "85%",
						...Shadow.lg,
					}}
				>
					{/* Header */}
					<View className="items-center pt-2.5 pb-1.5">
						<View
							style={{
								width: 40,
								height: 4,
								borderRadius: 2,
								backgroundColor: Colors.lineStrong,
							}}
						/>
					</View>
					<View className="flex-row items-center justify-between px-4 pb-3.5">
						<Text
							className="font-medium"
							style={{ fontSize: 22, color: Colors.ink900 }}
						>
							Filters
						</Text>
						<TouchableOpacity onPress={() => setLocal({})}>
							<Text
								className="font-semibold"
								style={{ fontSize: 14, color: Colors.primary600 }}
							>
								Clear all
							</Text>
						</TouchableOpacity>
					</View>

					<ScrollView
						showsVerticalScrollIndicator={false}
						contentContainerStyle={{
							paddingHorizontal: 16,
							paddingBottom: 32,
							gap: 24,
						}}
					>
						{/* City */}
						<View>
							<Text
								className="font-bold mb-2.5"
								style={{ fontSize: 14, color: Colors.ink700 }}
							>
								City or area
							</Text>
							<TextInput
								value={local.city ?? ""}
								onChangeText={(v) =>
									setLocal((prev) => ({ ...prev, city: v || undefined }))
								}
								placeholder="e.g. Dhaka, Chittagong"
								placeholderTextColor={Colors.ink400}
								className="rounded-md border py-2.5 px-3"
								style={{
									borderColor: Colors.lineStrong,
									fontSize: 15,
									color: Colors.ink900,
									backgroundColor: Colors.surface,
								}}
							/>
						</View>

						{/* Sort */}
						<View>
							<Text
								className="font-bold mb-2.5"
								style={{ fontSize: 14, color: Colors.ink700 }}
							>
								Sort by
							</Text>
							<View className="flex-row flex-wrap gap-2">
								{SORTS.map((s) => {
									const on = (local.sortBy ?? "recommended") === s.id;
									return (
										<TouchableOpacity
											key={s.id}
											onPress={() =>
												setLocal((prev) => ({ ...prev, sortBy: s.id }))
											}
											className="rounded-full border"
											style={{
												paddingVertical: 9,
												paddingHorizontal: 15,
												borderColor: on ? Colors.primary300 : Colors.lineStrong,
												backgroundColor: on
													? Colors.primary100
													: Colors.surface,
											}}
										>
											<Text
												className="font-semibold"
												style={{
													fontSize: 14,
													color: on ? Colors.primary700 : Colors.ink700,
												}}
											>
												{s.label}
											</Text>
										</TouchableOpacity>
									);
								})}
							</View>
						</View>

						{/* Rating */}
						<View>
							<Text
								className="font-bold mb-2.5"
								style={{ fontSize: 14, color: Colors.ink700 }}
							>
								Minimum rating
							</Text>
							<View className="flex-row gap-2">
								{RATINGS.map((r) => {
									const on = local.minRating === r.value;
									return (
										<TouchableOpacity
											key={r.value}
											onPress={() =>
												setLocal((prev) => ({
													...prev,
													minRating: on ? undefined : r.value,
												}))
											}
											className="rounded-full border"
											style={{
												paddingVertical: 9,
												paddingHorizontal: 15,
												borderColor: on ? Colors.primary300 : Colors.lineStrong,
												backgroundColor: on
													? Colors.primary100
													: Colors.surface,
											}}
										>
											<Text
												className="font-semibold"
												style={{
													fontSize: 14,
													color: on ? Colors.primary700 : Colors.ink700,
												}}
											>
												{r.label}
											</Text>
										</TouchableOpacity>
									);
								})}
							</View>
						</View>

						{/* Price range */}
						<View>
							<Text
								className="font-bold mb-2.5"
								style={{ fontSize: 14, color: Colors.ink700 }}
							>
								Price range (৳ per service)
							</Text>
							<View className="flex-row gap-2.5 items-center">
								<TextInput
									value={
										local.minPrice !== undefined ? String(local.minPrice) : ""
									}
									onChangeText={(v) =>
										setLocal((prev) => ({
											...prev,
											minPrice: v ? Number(v) : undefined,
										}))
									}
									placeholder="Min"
									placeholderTextColor={Colors.ink400}
									keyboardType="numeric"
									className="flex-1 rounded-md border py-2.5 px-3"
									style={{
										borderColor: Colors.lineStrong,
										fontSize: 15,
										color: Colors.ink900,
										backgroundColor: Colors.surface,
									}}
								/>
								<Text style={{ color: Colors.ink300 }}>—</Text>
								<TextInput
									value={
										local.maxPrice !== undefined ? String(local.maxPrice) : ""
									}
									onChangeText={(v) =>
										setLocal((prev) => ({
											...prev,
											maxPrice: v ? Number(v) : undefined,
										}))
									}
									placeholder="Max"
									placeholderTextColor={Colors.ink400}
									keyboardType="numeric"
									className="flex-1 rounded-md border py-2.5 px-3"
									style={{
										borderColor: Colors.lineStrong,
										fontSize: 15,
										color: Colors.ink900,
										backgroundColor: Colors.surface,
									}}
								/>
							</View>
						</View>
					</ScrollView>

					{/* Footer CTA */}
					<View
						className="px-4 pt-3 pb-[34px] border-t"
						style={{
							borderTopColor: Colors.line,
							backgroundColor: Colors.surface,
						}}
					>
						<TouchableOpacity
							onPress={() => {
								onApply(local);
								onClose();
							}}
							className="rounded-md items-center py-[15px]"
							style={{ backgroundColor: Colors.primary600 }}
						>
							<Text
								className="font-semibold"
								style={{ color: "#fff", fontSize: 16 }}
							>
								Show results
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	);
}

function AreaPickerModal({
	visible,
	selectedArea,
	onSelect,
	onClose,
}: {
	visible: boolean;
	selectedArea: string | null;
	onSelect: (area: string) => void;
	onClose: () => void;
}) {
	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
		>
			<View
				className="flex-1 justify-end"
				style={{ backgroundColor: "rgba(8,54,44,0.4)" }}
			>
				<TouchableOpacity
					style={StyleSheet.absoluteFill}
					onPress={onClose}
					activeOpacity={1}
				/>
				<View
					style={{
						backgroundColor: Colors.paper,
						borderTopLeftRadius: 28,
						borderTopRightRadius: 28,
						maxHeight: "70%",
						...Shadow.lg,
					}}
				>
					{/* Handle */}
					<View className="items-center pt-2.5 pb-1.5">
						<View
							style={{
								width: 40,
								height: 4,
								borderRadius: 2,
								backgroundColor: Colors.lineStrong,
							}}
						/>
					</View>
					<View className="px-4 pb-3.5">
						<Text
							className="font-medium"
							style={{ fontSize: 22, color: Colors.ink900 }}
						>
							Choose your area
						</Text>
					</View>
					<ScrollView
						showsVerticalScrollIndicator={false}
						contentContainerStyle={{
							paddingHorizontal: 16,
							paddingBottom: 32,
							gap: 8,
						}}
					>
						{COMMERCE_AREAS.map((a) => {
							const on = selectedArea === a;
							return (
								<TouchableOpacity
									key={a}
									onPress={() => onSelect(a)}
									className="flex-row items-center justify-between rounded-md px-4 py-3.5"
									style={{
										backgroundColor: on ? Colors.primary100 : Colors.surface,
										borderWidth: 1,
										borderColor: on ? Colors.primary300 : Colors.lineStrong,
									}}
								>
									<Text
										className="font-semibold"
										style={{
											fontSize: 15,
											color: on ? Colors.primary700 : Colors.ink900,
										}}
									>
										{a}
									</Text>
									{on && (
										<Icons.Check
											size={16}
											color={Colors.primary600}
											strokeWidth={2}
										/>
									)}
								</TouchableOpacity>
							);
						})}
					</ScrollView>
				</View>
			</View>
		</Modal>
	);
}

function SearchBar({
	value,
	onChange,
	filterCount,
	onFilter,
	showFilter = true,
}: {
	value: string;
	onChange: (v: string) => void;
	filterCount: number;
	onFilter: () => void;
	// The filter sheet is booking-shaped (price-per-service, rating, sort); commerce
	// filtering is done via the location bar, so the affordance is hidden there.
	showFilter?: boolean;
}) {
	return (
		<View style={[styles.searchBar, Shadow.xs]}>
			<Icons.Search size={19} color={Colors.primary600} strokeWidth={1.75} />
			<TextInput
				value={value}
				onChangeText={onChange}
				placeholder="Search services, businesses, places"
				placeholderTextColor={Colors.ink400}
				style={styles.searchInput}
				returnKeyType="search"
			/>
			{showFilter && (
				<TouchableOpacity onPress={onFilter} style={{ position: "relative" }}>
					<Icons.SlidersHorizontal
						size={18}
						color={filterCount > 0 ? Colors.primary600 : Colors.ink400}
						strokeWidth={1.75}
					/>
					{filterCount > 0 && (
						<View
							className="absolute items-center justify-center"
							style={{
								top: -5,
								right: -5,
								width: 14,
								height: 14,
								borderRadius: 7,
								backgroundColor: Colors.primary600,
							}}
						>
							<Text
								className="font-bold"
								style={{ fontSize: 9, color: "#fff" }}
							>
								{filterCount}
							</Text>
						</View>
					)}
				</TouchableOpacity>
			)}
		</View>
	);
}

function CategoryChips({
	active,
	onPick,
}: {
	active: string;
	onPick: (c: string) => void;
}) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
		>
			{CATEGORIES.map((c) => {
				const on = c === active;
				return (
					<TouchableOpacity
						key={c}
						onPress={() => onPick(c)}
						style={[styles.chip, on ? styles.chipActive : styles.chipInactive]}
					>
						<Text
							style={{
								fontSize: 14,
								fontWeight: "600",
								color: on ? "#fff" : Colors.ink700,
							}}
						>
							{c}
						</Text>
					</TouchableOpacity>
				);
			})}
		</ScrollView>
	);
}

function BusinessCard({
	business,
	isSaved,
}: {
	business: Business;
	isSaved: boolean;
}) {
	const { openBusiness, toggleSave } = useApp();
	return (
		<TouchableOpacity
			onPress={() => openBusiness(business)}
			style={[styles.card, Shadow.sm]}
			activeOpacity={0.9}
			accessibilityRole="button"
			accessibilityLabel={`${business.name}, ${business.category}, ${business.city}, rated ${business.rating}, from ${formatMoney(business.from)}`}
		>
			<Photo tone={business.tone} height={150} uri={business.coverPhotoUrl}>
				<TouchableOpacity
					onPress={(e) => {
						e.stopPropagation?.();
						toggleSave(business);
					}}
					style={styles.heartBtn}
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel={
						isSaved
							? `Remove ${business.name} from favourites`
							: `Save ${business.name} to favourites`
					}
					accessibilityState={{ checked: isSaved }}
				>
					<Icons.Heart
						size={18}
						color={isSaved ? Colors.danger : Colors.ink700}
						fill={isSaved ? Colors.danger : "transparent"}
						strokeWidth={1.75}
					/>
				</TouchableOpacity>
				{business.premium && (
					<View style={styles.premiumBadge}>
						<Icons.Sparkles
							size={12}
							color={Colors.gold300}
							strokeWidth={1.75}
						/>
						<Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "600" }}>
							Premium
						</Text>
					</View>
				)}
			</Photo>
			{/* Cross-venue accent (#60): a thin stripe in the venue's brand accent —
			    never a full reskin in mixed lists (ADR-0002). Neutral when unset. */}
			{business.brandPalette?.accent ? (
				<View
					style={{ height: 3, backgroundColor: business.brandPalette.accent }}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
				/>
			) : null}
			<View className="p-3.5 pb-4">
				<Text style={styles.cardName}>{business.name}</Text>
				<View style={styles.cardCity}>
					<Icons.MapPin size={14} color={Colors.ink500} strokeWidth={1.75} />
					<Text style={{ fontSize: 13.5, color: Colors.ink500 }}>
						{business.vertical === "commerce"
							? business.distanceKm != null
								? `${business.distanceKm.toFixed(1)} km away`
								: (business.area ?? business.city)
							: business.city}
					</Text>
				</View>
				<View style={styles.cardMeta}>
					<Stars value={business.rating} />
					<Text
						style={{ fontWeight: "700", fontSize: 13.5, color: Colors.ink700 }}
					>
						{business.rating}
					</Text>
					<Text style={{ color: Colors.ink400, fontSize: 13.5 }}>
						({business.reviews})
					</Text>
					<Text style={{ color: Colors.ink300 }}>·</Text>
					<Text style={{ color: Colors.ink500, fontSize: 13.5 }}>
						{business.category}
					</Text>
				</View>
				<View style={styles.cardPrice}>
					<Text style={{ fontSize: 12.5, color: Colors.ink400 }}>From</Text>
					<Text
						style={{ fontSize: 15, fontWeight: "700", color: Colors.ink900 }}
					>
						{formatMoney(business.from)}
					</Text>
				</View>
			</View>
		</TouchableOpacity>
	);
}

function BusinessTile({ business }: { business: Business }) {
	const { openBusiness } = useApp();
	return (
		<TouchableOpacity
			onPress={() => openBusiness(business)}
			style={{ width: 220 }}
			activeOpacity={0.9}
		>
			<Photo
				tone={business.tone}
				height={130}
				radiusPx={16}
				uri={business.coverPhotoUrl}
			/>
			<Text style={styles.tileName}>{business.name}</Text>
			<View className="flex-row items-center mt-0.5" style={{ gap: 5 }}>
				<Stars value={business.rating} sizePx={12} />
				<Text style={{ fontSize: 13, color: Colors.ink500 }}>
					{business.rating}
				</Text>
				<Text style={{ color: Colors.ink300 }}>·</Text>
				<Text style={{ fontSize: 13, color: Colors.ink500 }}>
					{business.city.split(",")[0]}
				</Text>
			</View>
		</TouchableOpacity>
	);
}

export default function SearchScreen() {
	const { saved, openNotifications, notifications, authedUser, openBusiness } =
		useApp();
	const insets = useSafeAreaInsets();
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("All");
	const [filters, setFilters] =
		useState<BusinessSearchFilters>(DEFAULT_FILTERS);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [viewMode, setViewMode] = useState<"list" | "map">("list");
	const filterCount = activeFilterCount(filters);
	const debouncedQuery = useDebounce(query, 300);

	// Commerce segment state
	const [vertical, setVertical] = useState<"booking" | "commerce">("booking");
	const [area, setArea] = useState<string | null>(null);
	const [areaPickerOpen, setAreaPickerOpen] = useState(false);
	const location = useDeviceLocation();
	const router = useRouter();
	const recentSellers = useRecentSellers();

	// Request GPS on entering commerce segment. Guard on `area == null` so picking
	// a manual area (which calls location.clear() → status "idle") doesn't re-prompt
	// for GPS — manual area and device location are mutually exclusive inputs.
	useEffect(() => {
		if (vertical === "commerce" && location.status === "idle" && area == null) {
			void location.request();
		}
	}, [vertical, location, area]);

	// Single search call, params vary by vertical
	const commerceReady =
		vertical === "commerce" && (location.coords != null || area != null);
	const searchParams: BusinessSearchFilters =
		vertical === "booking"
			? {
					q: debouncedQuery.trim() || undefined,
					category: category !== "All" ? category : undefined,
					...filters,
				}
			: {
					vertical: "commerce" as const,
					q: debouncedQuery.trim() || undefined,
					city: filters.city,
					area: area ?? undefined,
					lat: location.coords?.lat,
					lng: location.coords?.lng,
					enabled: commerceReady,
				};

	const {
		data: apiBusinesses,
		isLoading,
		isError,
		refetch,
	} = useBusinessSearch(searchParams);

	const unreadCount = notifications.filter((n) => n.unread).length;

	// Filter to the active vertical so stale placeholder results from the other
	// vertical (placeholderData carries the previous page across the switch) don't
	// flash with the wrong card layout.
	const results: Business[] = (apiBusinesses ?? []).filter(
		(b) => b.vertical === vertical,
	);
	const { coordMap, isLoading: mapCoordsLoading } = useBusinessMapCoordinates(
		results,
		vertical === "booking" && viewMode === "map" && results.length > 0,
	);
	const mapBusinesses = useMemo(
		() => businessesWithMapCoordinates(results, coordMap),
		[results, coordMap],
	);

	const featured = results.filter((v) => v.rating >= 4.7).slice(0, 10);

	if (isLoading && !apiBusinesses) {
		return (
			<View className="flex-1 bg-paper">
				<View className="px-4 gap-4" style={{ paddingTop: insets.top + 20 }}>
					{[1, 2, 3].map((i) => (
						<View
							key={i}
							style={[styles.skeleton, { height: 220, borderRadius: 20 }]}
						/>
					))}
				</View>
			</View>
		);
	}

	if (isError && !apiBusinesses) {
		return <NetworkError onRetry={() => refetch()} />;
	}

	const locationBarText = area
		? `Delivering to ${area}`
		: location.coords
			? "Near you"
			: "Choose your area";

	return (
		<>
			<ScrollView
				className="flex-1"
				style={{ backgroundColor: Colors.paper }}
				contentContainerStyle={{ paddingBottom: 24 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Brand header */}
				<View style={[styles.header, { paddingTop: insets.top + 12 }]}>
					<View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
						<TalashMark size={28} />
						<Text style={styles.brand}>Talash</Text>
					</View>
					<TouchableOpacity
						onPress={openNotifications}
						style={[styles.bellBtn, Shadow.sm]}
					>
						<Icons.Bell size={19} color={Colors.ink700} strokeWidth={1.75} />
						{unreadCount > 0 && <View style={styles.unreadDot} />}
					</TouchableOpacity>
				</View>

				{/* Greeting */}
				<View className="px-4 py-3.5">
					<Text style={styles.eyebrow}>
						{authedUser?.name
							? `Hello, ${authedUser.name.split(" ")[0]}`
							: "Welcome"}
					</Text>
					<Text style={styles.headline}>
						What are you in{" "}
						<Text style={{ fontStyle: "italic", color: Colors.primary600 }}>
							search
						</Text>{" "}
						of?
					</Text>
				</View>

				{/* Search bar */}
				<View className="px-4 pb-4">
					<SearchBar
						value={query}
						onChange={setQuery}
						filterCount={filterCount}
						onFilter={() => setFiltersOpen(true)}
						showFilter={vertical === "booking"}
					/>
				</View>

				{/* Segment toggle — always visible */}
				<View className="px-4 pb-4">
					<View
						className="flex-row self-start rounded-md p-[3px]"
						style={{ backgroundColor: Colors.lineSoft }}
					>
						{(["booking", "commerce"] as const).map((v) => {
							const on = vertical === v;
							return (
								<TouchableOpacity
									key={v}
									onPress={() => setVertical(v)}
									className="flex-row items-center gap-[5px] px-3 py-1.5"
									style={{
										borderRadius: 8,
										backgroundColor: on ? Colors.surface : "transparent",
									}}
								>
									<Text
										className="font-semibold"
										style={{
											fontSize: 13,
											color: on ? Colors.ink900 : Colors.ink500,
										}}
									>
										{v === "booking" ? "Salons" : "Gas sellers"}
									</Text>
								</TouchableOpacity>
							);
						})}
					</View>
				</View>

				{/* ── Booking body ── */}
				{vertical === "booking" && (
					<>
						{/* Category chips */}
						<View className="mb-2.5">
							<CategoryChips active={category} onPick={setCategory} />
						</View>

						{/* View toggle */}
						<View className="flex-row items-center px-4 mb-4">
							<View
								className="flex-row self-start rounded-md p-[3px]"
								style={{ backgroundColor: Colors.lineSoft }}
							>
								{(["list", "map"] as const).map((mode) => {
									const on = viewMode === mode;
									return (
										<TouchableOpacity
											key={mode}
											onPress={() => setViewMode(mode)}
											className="flex-row items-center gap-[5px] px-3 py-1.5"
											style={{
												borderRadius: 8,
												backgroundColor: on ? Colors.surface : "transparent",
											}}
										>
											<Icons.List
												size={14}
												color={on ? Colors.ink900 : Colors.ink400}
												strokeWidth={1.75}
												style={{ display: mode === "list" ? "flex" : "none" }}
											/>
											<Icons.Map
												size={14}
												color={on ? Colors.ink900 : Colors.ink400}
												strokeWidth={1.75}
												style={{ display: mode === "map" ? "flex" : "none" }}
											/>
											<Text
												className="font-semibold"
												style={{
													fontSize: 13,
													color: on ? Colors.ink900 : Colors.ink500,
												}}
											>
												{mode === "list" ? "List" : "Map"}
											</Text>
										</TouchableOpacity>
									);
								})}
							</View>
						</View>

						{/* Featured rail */}
						{!debouncedQuery.trim() && category === "All" && (
							<View className="mb-6">
								<SectionTitle>Editor's picks</SectionTitle>
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									contentContainerStyle={{
										gap: 16,
										paddingHorizontal: 16,
										paddingTop: 14,
										paddingBottom: 4,
									}}
								>
									{featured.map((v) => (
										<BusinessTile key={v.id} business={v} />
									))}
								</ScrollView>
							</View>
						)}

						{/* Results */}
						<View>
							<SectionTitle>
								{debouncedQuery.trim() || category !== "All"
									? `${results.length} ${results.length === 1 ? "business" : "businesses"}`
									: "Near you"}
							</SectionTitle>
							<View className="gap-4 px-4 pt-3.5">
								{results.length === 0 ? (
									<EmptyState
										icon="SearchX"
										title={`No results for "${debouncedQuery}"`}
										body="Try a different search or browse by category."
									/>
								) : (
									results.map((v) => (
										<BusinessCard
											key={v.id}
											business={v}
											isSaved={saved.has(v.id)}
										/>
									))
								)}
							</View>
						</View>
					</>
				)}

				{/* ── Commerce body ── */}
				{vertical === "commerce" && (
					<>
						{/* Location bar — always shown in commerce */}
						<TouchableOpacity
							onPress={() => setAreaPickerOpen(true)}
							className="flex-row items-center mx-4 mb-4 px-4 py-3 rounded-md"
							style={{
								backgroundColor: Colors.surface,
								borderWidth: 1,
								borderColor: Colors.lineStrong,
								gap: 10,
							}}
						>
							<Icons.MapPin
								size={16}
								color={Colors.primary600}
								strokeWidth={1.75}
							/>
							<Text
								className="flex-1 font-medium"
								style={{ fontSize: 14, color: Colors.ink700 }}
							>
								{locationBarText}
							</Text>
							<Text
								className="font-semibold"
								style={{ fontSize: 13, color: Colors.primary600 }}
							>
								Change
							</Text>
						</TouchableOpacity>

						{!commerceReady ? (
							/* Cold start — no location or area yet */
							<EmptyState
								icon="MapPin"
								title="Where should we deliver?"
								body="Choose your area or enable location to find gas sellers near you."
							/>
						) : (
							<>
								{/* Order again row */}
								{recentSellers.length > 0 && (
									<View className="mb-6">
										<SectionTitle>Order again</SectionTitle>
										<ScrollView
											horizontal
											showsHorizontalScrollIndicator={false}
											contentContainerStyle={{
												gap: 10,
												paddingHorizontal: 16,
												paddingTop: 12,
												paddingBottom: 4,
											}}
										>
											{recentSellers.map((s) => (
												<TouchableOpacity
													key={s.id}
													onPress={() => router.push(`/business?id=${s.id}`)}
													className="rounded-full px-4 py-2.5"
													style={{
														backgroundColor: Colors.primary100,
														borderWidth: 1,
														borderColor: Colors.primary300,
													}}
												>
													<Text
														className="font-semibold"
														style={{ fontSize: 14, color: Colors.primary700 }}
													>
														{s.name}
													</Text>
												</TouchableOpacity>
											))}
										</ScrollView>
									</View>
								)}

								{/* Seller results */}
								<View>
									<SectionTitle>
										{results.length}{" "}
										{results.length === 1 ? "seller" : "sellers"}
									</SectionTitle>
									<View className="gap-4 px-4 pt-3.5">
										{results.length === 0 ? (
											<EmptyState
												icon="SearchX"
												title={`No gas sellers in ${area ?? "your area"} yet`}
												body="Check back soon — we're expanding coverage."
											/>
										) : (
											results.map((v) => (
												<BusinessCard
													key={v.id}
													business={v}
													isSaved={saved.has(v.id)}
												/>
											))
										)}
									</View>
								</View>
							</>
						)}
					</>
				)}
			</ScrollView>

			{/* Map view overlay — booking only */}
			{vertical === "booking" && viewMode === "map" && (
				<View className="absolute inset-0 bg-paper" style={{ zIndex: 10 }}>
					{/* Keep brand header visible */}
					<View
						style={[
							styles.header,
							{ paddingTop: insets.top + 12, backgroundColor: Colors.paper },
						]}
					>
						<View className="flex-row items-center" style={{ gap: 9 }}>
							<TalashMark size={28} />
							<Text style={styles.brand}>Talash</Text>
						</View>
						<TouchableOpacity
							onPress={() => setViewMode("list")}
							className="flex-row items-center gap-1.5 rounded-full px-3 py-[7px]"
							style={{ backgroundColor: Colors.primary100 }}
						>
							<Icons.List
								size={14}
								color={Colors.primary700}
								strokeWidth={1.75}
							/>
							<Text
								className="font-semibold"
								style={{ fontSize: 13, color: Colors.primary700 }}
							>
								List
							</Text>
						</TouchableOpacity>
					</View>
					<MapScreen
						businesses={mapBusinesses}
						loadingCoords={mapCoordsLoading}
						onBusinessPress={(v) => openBusiness(v)}
					/>
				</View>
			)}

			{filtersOpen && (
				<FilterSheet
					filters={filters}
					onApply={(f) => setFilters(f)}
					onClose={() => setFiltersOpen(false)}
				/>
			)}

			<AreaPickerModal
				visible={areaPickerOpen}
				selectedArea={area}
				onSelect={(a) => {
					setArea(a);
					location.clear();
					setAreaPickerOpen(false);
				}}
				onClose={() => setAreaPickerOpen(false)}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingBottom: 4,
	},
	brand: {
		fontSize: 24,
		fontWeight: "600",
		letterSpacing: -0.5,
		color: Colors.ink900,
	},
	bellBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: Colors.surface,
		alignItems: "center",
		justifyContent: "center",
	},
	unreadDot: {
		position: "absolute",
		top: 9,
		right: 10,
		width: 7,
		height: 7,
		borderRadius: 4,
		backgroundColor: Colors.primary500,
		borderWidth: 2,
		borderColor: Colors.paper,
	},
	eyebrow: {
		fontSize: 12,
		fontWeight: "600",
		letterSpacing: 2,
		textTransform: "uppercase",
		color: Colors.primary600,
		marginBottom: 8,
	},
	headline: {
		fontSize: 34,
		fontWeight: "400",
		letterSpacing: -0.5,
		color: Colors.ink900,
		lineHeight: 40,
	},
	searchBar: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: Colors.surface,
		borderWidth: 1,
		borderColor: Colors.lineStrong,
		borderRadius: Radius.md,
		paddingHorizontal: 14,
		paddingVertical: 12,
	},
	searchInput: {
		flex: 1,
		fontSize: 16,
		color: Colors.ink900,
		padding: 0,
	},
	chip: {
		paddingVertical: 8,
		paddingHorizontal: 15,
		borderRadius: Radius.pill,
	},
	chipActive: {
		backgroundColor: Colors.primary900,
	},
	chipInactive: {
		backgroundColor: Colors.surface,
		borderWidth: 1,
		borderColor: Colors.lineStrong,
	},
	card: {
		backgroundColor: Colors.surface,
		borderRadius: Radius.lg,
		borderWidth: 1,
		borderColor: Colors.line,
		overflow: "hidden",
	},
	cardName: {
		fontSize: 21,
		fontWeight: "500",
		letterSpacing: -0.25,
		color: Colors.ink900,
		marginBottom: 4,
	},
	cardCity: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		marginTop: 4,
	},
	cardMeta: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 10,
	},
	cardPrice: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "baseline",
		marginTop: 12,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: Colors.lineSoft,
	},
	heartBtn: {
		position: "absolute",
		top: 12,
		right: 12,
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "rgba(251,250,246,0.92)",
		alignItems: "center",
		justifyContent: "center",
	},
	premiumBadge: {
		position: "absolute",
		top: 14,
		left: 14,
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		paddingVertical: 4,
		paddingHorizontal: 10,
		borderRadius: Radius.pill,
		backgroundColor: "rgba(8,54,44,0.55)",
	},
	tileName: {
		fontSize: 18,
		fontWeight: "500",
		letterSpacing: -0.25,
		color: Colors.ink900,
		marginTop: 10,
	},
	skeleton: {
		backgroundColor: Colors.line,
	},
});
