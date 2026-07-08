import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
	Alert,
	FlatList,
	RefreshControl,
	ScrollView,
	Share,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { api } from "../../lib/api";
import { Colors } from "../../tokens";
import { BookingCardSkeleton } from "../LoadingScreen";
import { ScreenContainer } from "../ScreenContainer";
import { BranchSwitcher, Empty, FilterTabs, TabHeader } from "../ui";
import { BookingCard } from "./TodayScreen";

export default function BookingsScreen() {
	const insets = useSafeAreaInsets();
	const { bookings, branch, setBranch, filter, setFilter, business, businessId } =
		useApp();
	const qc = useQueryClient();
	const [refreshing, setRefreshing] = useState(false);
	const [exporting, setExporting] = useState(false);
	const exportingRef = useRef(false);

	async function handleExport() {
		if (exportingRef.current || !businessId) return;
		exportingRef.current = true;
		setExporting(true);
		try {
			const blob = await api.bookings.exportCsv({ businessId });
			const text = await blob.text();
			await Share.share({ title: "Bookings export", message: text });
		} catch (e: unknown) {
			Alert.alert(
				"Export failed",
				(e as Error).message ?? "Could not export bookings.",
			);
		} finally {
			exportingRef.current = false;
			setExporting(false);
		}
	}

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await qc.invalidateQueries({ queryKey: ["bookings"] });
		setRefreshing(false);
	}, [qc]);

	const inBranch = (b: { branch: string }) =>
		branch === "All branches" || b.branch === branch;
	const scoped = bookings.filter(inBranch);
	const counts = {
		All: scoped.length,
		Pending: scoped.filter((b) => b.status === "Pending").length,
		Confirmed: scoped.filter((b) => b.status === "Confirmed").length,
		Completed: scoped.filter((b) => b.status === "Completed").length,
		Cancelled: scoped.filter((b) => b.status === "Cancelled").length,
	};
	const list = scoped.filter((b) => filter === "All" || b.status === filter);

	const tabs = [
		{ id: "All", label: "All" },
		{ id: "Pending", label: "Pending", count: counts.Pending },
		{ id: "Confirmed", label: "Confirmed" },
		{ id: "Completed", label: "Completed" },
		{ id: "Cancelled", label: "Cancelled" },
	];

	const isInitialLoad = !business.name && !refreshing;

	return (
		<ScreenContainer>
			<View className="flex-1 bg-paper">
				<TabHeader
					title="Bookings"
					topInset={insets.top}
					action={exporting ? "Exporting…" : "Export"}
					actionIcon="Download"
					onAction={handleExport}
				/>
				<View style={{ paddingTop: 8 }}>
					<BranchSwitcher
						branches={business.branches}
						active={branch}
						onPick={setBranch}
					/>
				</View>
				<View style={{ paddingTop: 12 }}>
					<FilterTabs tabs={tabs} active={filter} onPick={setFilter} />
				</View>

				{isInitialLoad ? (
					<ScrollView
						contentContainerStyle={{
							gap: 11,
							paddingHorizontal: 16,
							paddingTop: 16,
							paddingBottom: 32,
						}}
					>
						{[0, 1, 2].map((i) => (
							<BookingCardSkeleton key={i} />
						))}
					</ScrollView>
				) : (
					<FlatList
						data={list}
						keyExtractor={(b) => b.id}
						renderItem={({ item }) => <BookingCard b={item} />}
						ListEmptyComponent={
							<Empty
								icon="Calendar"
								title="Nothing here yet"
								body={`No ${filter === "All" ? "" : `${filter.toLowerCase()} `}bookings for this branch.`}
							/>
						}
						showsVerticalScrollIndicator={false}
						contentContainerStyle={{
							gap: 11,
							paddingHorizontal: 16,
							paddingTop: 16,
							paddingBottom: 32,
						}}
						refreshControl={
							<RefreshControl
								refreshing={refreshing}
								onRefresh={onRefresh}
								tintColor={Colors.primary600}
								colors={[Colors.primary600]}
							/>
						}
					/>
				)}
			</View>
		</ScreenContainer>
	);
}
