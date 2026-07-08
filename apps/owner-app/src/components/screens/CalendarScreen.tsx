import type { Branch, CalendarBooking } from "@repo/api-client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { money } from "../../data";
import { adaptCalendarBooking } from "../../lib/adapters";
import { api } from "../../lib/api";
import { Colors, Shadow } from "../../tokens";
import {
	BackHeader,
	type BookingStatus,
	BranchSwitcher,
	Card,
	FilterTabs,
	Icon,
	StatusPill,
} from "../ui";

function isoDate(d: Date) {
	return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
	const r = new Date(d);
	r.setDate(r.getDate() + n);
	return r;
}

function weekStart(d: Date) {
	const r = new Date(d);
	r.setDate(r.getDate() - r.getDay());
	return r;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

function formatSlot(slot: string) {
	return slot.includes("T") ? slot.split("T")[1]?.slice(0, 5) : slot;
}

function bookingsByDate(bookings: CalendarBooking[], date: string) {
	return bookings.filter((b) => b.slot.slice(0, 10) === date);
}

function DayView({
	bookings,
	date,
	apiBranches,
}: {
	bookings: CalendarBooking[];
	date: string;
	apiBranches: Branch[];
}) {
	const { setSheet } = useApp();
	const dayBookings = bookingsByDate(bookings, date).sort((a, b) =>
		a.slot.localeCompare(b.slot),
	);

	if (dayBookings.length === 0) {
		return (
			<View className="items-center py-10">
				<Icon name="CalendarX2" size={32} color={Colors.ink300} />
				<Text className="mt-3" style={{ fontSize: 15, color: Colors.ink500 }}>
					No bookings this day
				</Text>
			</View>
		);
	}

	return (
		<View className="gap-2.5">
			{dayBookings.map((b) => (
				<Card
					key={b.id}
					pad={14}
					onPress={() =>
						setSheet({
							type: "booking",
							b: adaptCalendarBooking(b, apiBranches),
						})
					}
				>
					<View className="flex-row gap-3">
						<View className="items-center" style={{ width: 44 }}>
							<Text
								className="font-bold"
								style={{ fontSize: 15, color: Colors.primary700 }}
							>
								{formatSlot(b.slot)}
							</Text>
							<View
								className="flex-1 mt-1 rounded-sm"
								style={{ width: 2, backgroundColor: Colors.line }}
							/>
						</View>
						<View className="flex-1 min-w-0">
							<View className="flex-row items-center justify-between">
								<Text
									className="flex-1 font-bold"
									numberOfLines={1}
									style={{ fontSize: 14.5, color: Colors.ink900 }}
								>
									{b.customerName}
								</Text>
								<View className="flex-row items-center gap-1.5">
									<StatusPill status={b.status as BookingStatus} size="sm" />
									<Icon name="ChevronRight" size={14} color={Colors.ink300} />
								</View>
							</View>
							<Text
								className="mt-0.5"
								numberOfLines={1}
								style={{ fontSize: 13, color: Colors.ink500 }}
							>
								{b.serviceName}
							</Text>
							<View className="flex-row items-center justify-between mt-1.5">
								<Text style={{ fontSize: 12.5, color: Colors.ink400 }}>
									{b.serviceDuration} min
								</Text>
								<Text
									className="font-bold"
									style={{ fontSize: 13.5, color: Colors.ink900 }}
								>
									{money(b.price - b.discount)}
								</Text>
							</View>
						</View>
					</View>
				</Card>
			))}
		</View>
	);
}

function WeekView({
	bookings,
	weekStart: ws,
	onDayPress,
}: {
	bookings: CalendarBooking[];
	weekStart: Date;
	onDayPress: (date: string) => void;
}) {
	return (
		<View className="flex-row gap-1.5">
			{Array.from({ length: 7 }).map((_, i) => {
				const day = addDays(ws, i);
				const dateStr = isoDate(day);
				const count = bookingsByDate(bookings, dateStr).length;
				const isToday = isoDate(new Date()) === dateStr;
				return (
					<TouchableOpacity
						key={dateStr}
						onPress={() => onDayPress(dateStr)}
						className="flex-1 rounded-md items-center border py-2.5"
						style={{
							backgroundColor: isToday ? Colors.primary100 : Colors.surface,
							borderColor: isToday ? Colors.primary300 : Colors.line,
							...Shadow.xs,
						}}
					>
						<Text
							className="font-semibold"
							style={{
								fontSize: 10.5,
								color: isToday ? Colors.primary700 : Colors.ink400,
							}}
						>
							{DAY_LABELS[day.getDay()]}
						</Text>
						<Text
							className="font-bold mt-0.5"
							style={{
								fontSize: 16,
								color: isToday ? Colors.primary700 : Colors.ink900,
							}}
						>
							{day.getDate()}
						</Text>
						{count > 0 && (
							<View
								className="mt-1 rounded-full px-1.5 py-0.5"
								style={{ backgroundColor: Colors.primary600 }}
							>
								<Text
									className="font-bold"
									style={{ fontSize: 10, color: "#fff" }}
								>
									{count}
								</Text>
							</View>
						)}
						{count === 0 && <View className="mt-1" style={{ height: 16 }} />}
					</TouchableOpacity>
				);
			})}
		</View>
	);
}

export default function CalendarScreen() {
	const insets = useSafeAreaInsets();
	const { businessId, branch, setBranch, business } = useApp();
	const [view, setView] = useState<"day" | "week">("week");
	const [_today] = useState(() => new Date());
	const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
	const [weekOf, setWeekOf] = useState(() => weekStart(new Date()));

	const activeBranch =
		business.branches.find((b) => b === branch) ?? business.branches[0] ?? "";

	const queryStart = view === "week" ? isoDate(weekOf) : selectedDate;
	const queryEnd = view === "week" ? isoDate(addDays(weekOf, 6)) : selectedDate;

	const branchesQ = useQuery({
		queryKey: ["branches", businessId],
		// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!businessId
		queryFn: () => api.branches.list(businessId!, { limit: 50 }),
		enabled: !!businessId,
		staleTime: 60_000,
	});

	const apiBranches = branchesQ.data?.data ?? [];
	const activeBranchId =
		apiBranches.find((b) => b.name === activeBranch)?.id ?? apiBranches[0]?.id;

	const bookingsQ = useQuery({
		queryKey: ["bookings", "calendar", activeBranchId, queryStart, queryEnd],
		queryFn: () =>
			api.bookings.calendar({
				// biome-ignore lint/style/noNonNullAssertion: guarded by enabled: !!activeBranchId
				branchId: activeBranchId!,
				start: queryStart,
				end: queryEnd,
			}),
		enabled: !!activeBranchId,
		staleTime: 15_000,
	});

	const bookings = bookingsQ.data ?? [];

	return (
		<View className="flex-1 bg-paper">
			<BackHeader title="Calendar" topInset={insets.top} />

			<View className="px-4 pb-2.5">
				<BranchSwitcher
					branches={business.branches}
					active={branch}
					onPick={setBranch}
				/>
			</View>

			<View className="px-4 pb-3">
				<FilterTabs
					tabs={[
						{ id: "week", label: "Week" },
						{ id: "day", label: "Day" },
					]}
					active={view}
					onPick={(id) => setView(id as "day" | "week")}
				/>
			</View>

			{/* Week navigation */}
			<View className="px-4 flex-row items-center justify-between mb-3">
				<TouchableOpacity
					onPress={() => {
						if (view === "week") setWeekOf((w) => addDays(w, -7));
						else setSelectedDate((d) => isoDate(addDays(new Date(d), -1)));
					}}
					className="p-2"
				>
					<Icon name="ChevronLeft" size={20} color={Colors.ink700} />
				</TouchableOpacity>
				<Text
					className="font-semibold"
					style={{ fontSize: 14.5, color: Colors.ink900 }}
				>
					{view === "week"
						? `${weekOf.getDate()} ${MONTH_NAMES[weekOf.getMonth()]} – ${addDays(weekOf, 6).getDate()} ${MONTH_NAMES[addDays(weekOf, 6).getMonth()]}`
						: new Date(selectedDate).toLocaleDateString("en-BD", {
								day: "numeric",
								month: "long",
								year: "numeric",
							})}
				</Text>
				<TouchableOpacity
					onPress={() => {
						if (view === "week") setWeekOf((w) => addDays(w, 7));
						else setSelectedDate((d) => isoDate(addDays(new Date(d), 1)));
					}}
					className="p-2"
				>
					<Icon name="ChevronRight" size={20} color={Colors.ink700} />
				</TouchableOpacity>
			</View>

			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
			>
				{view === "week" ? (
					<View className="gap-4">
						<WeekView
							bookings={bookings}
							weekStart={weekOf}
							onDayPress={(date) => {
								setSelectedDate(date);
								setView("day");
							}}
						/>
						{/* Summary for week */}
						<View className="flex-row gap-2.5">
							<View
								className="flex-1 rounded-lg border border-line bg-surface p-3.5"
								style={{ ...Shadow.sm }}
							>
								<Text
									className="font-light"
									style={{ fontSize: 22, color: Colors.ink900 }}
								>
									{bookings.filter((b) => b.status !== "Cancelled").length}
								</Text>
								<Text
									className="mt-0.5"
									style={{ fontSize: 12.5, color: Colors.ink500 }}
								>
									Bookings this week
								</Text>
							</View>
							<View
								className="flex-1 rounded-lg border border-line bg-surface p-3.5"
								style={{ ...Shadow.sm }}
							>
								<Text
									className="font-light"
									style={{ fontSize: 22, color: Colors.ink900 }}
								>
									{money(
										bookings
											.filter((b) => b.status === "Completed")
											.reduce((s, b) => s + b.price - b.discount, 0),
									)}
								</Text>
								<Text
									className="mt-0.5"
									style={{ fontSize: 12.5, color: Colors.ink500 }}
								>
									Revenue confirmed
								</Text>
							</View>
						</View>
					</View>
				) : (
					<DayView
						bookings={bookings}
						date={selectedDate}
						apiBranches={apiBranches}
					/>
				)}
			</ScrollView>
		</View>
	);
}
