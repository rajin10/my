import { useEffect, useState } from "react";
import { ActivityIndicator, Switch, Text, View } from "react-native";
import {
	DAYS,
	type DaySchedule,
	defaultWeekSchedule,
	validateWeekSchedule,
} from "../lib/schedule";
import { Colors } from "../tokens";
import { Button, Sheet, TextField } from "./ui";

export function WeekScheduleEditor({
	title,
	intro,
	saveLabel,
	savingLabel,
	closedLabel,
	data,
	isLoading,
	isError,
	isSaving,
	onClose,
	onSave,
	onRetry,
}: {
	title: string;
	intro: string;
	saveLabel: string;
	savingLabel: string;
	closedLabel: string;
	/** Normalised week from the query, or `undefined` while not yet loaded. */
	data: DaySchedule[] | undefined;
	isLoading: boolean;
	isError: boolean;
	isSaving: boolean;
	onClose: () => void;
	onSave: (schedule: DaySchedule[]) => void;
	onRetry?: () => void;
}) {
	const [schedule, setSchedule] = useState(defaultWeekSchedule());
	const [initialized, setInitialized] = useState(false);

	// Seed from the query exactly once — a later refetch must not clobber edits.
	useEffect(() => {
		if (!initialized && data !== undefined) {
			setSchedule(data);
			setInitialized(true);
		}
	}, [data, initialized]);

	function setDay(i: number, patch: Partial<DaySchedule>) {
		setSchedule((prev) =>
			prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)),
		);
	}

	const dayErrors = validateWeekSchedule(schedule);
	const hasErrors = dayErrors.length > 0;

	// When the load errored there is nothing safe to save — the schedule is just
	// defaults that would clobber the real server data — so we omit the Save
	// button entirely and offer Retry instead (rendered in the error view).
	const footer = isError ? undefined : (
		<Button
			variant="primary"
			full
			disabled={isSaving || isLoading || hasErrors}
			onPress={() => onSave(schedule)}
		>
			{isSaving ? savingLabel : saveLabel}
		</Button>
	);

	return (
		<Sheet visible title={title} onClose={onClose} footer={footer}>
			<Text
				style={{
					fontSize: 13.5,
					color: Colors.ink500,
					marginBottom: 14,
					lineHeight: 20,
				}}
			>
				{intro}
			</Text>
			{isError ? (
				<View style={{ gap: 12, alignItems: "flex-start" }}>
					<Text style={{ fontSize: 14, color: Colors.ink500, lineHeight: 21 }}>
						Couldn't load the schedule. Please try again.
					</Text>
					{onRetry ? (
						<Button variant="ghost" size="sm" onPress={onRetry}>
							Retry
						</Button>
					) : null}
				</View>
			) : isLoading ? (
				<ActivityIndicator color={Colors.primary600} />
			) : (
				<View style={{ gap: 10 }}>
					{schedule.map((d, i) => {
						const dayError = dayErrors.find((e) => e.dayOfWeek === d.dayOfWeek);
						return (
							<View key={d.dayOfWeek} style={{ gap: 4 }}>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 10,
										paddingVertical: 6,
									}}
								>
									<Text
										style={{
											width: 88,
											fontSize: 13.5,
											fontWeight: "600",
											color: Colors.ink700,
										}}
									>
										{DAYS[i]}
									</Text>
									<Switch
										value={!d.isClosed}
										onValueChange={(open) => setDay(i, { isClosed: !open })}
										trackColor={{ false: Colors.line, true: Colors.primary300 }}
										thumbColor={d.isClosed ? Colors.ink300 : Colors.primary600}
									/>
									{!d.isClosed ? (
										<View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
											<TextField
												label=""
												value={d.openTime}
												onChangeText={(t) => setDay(i, { openTime: t })}
												placeholder="09:00"
												style={{ flex: 1 }}
											/>
											<Text
												style={{ alignSelf: "center", color: Colors.ink400 }}
											>
												–
											</Text>
											<TextField
												label=""
												value={d.closeTime}
												onChangeText={(t) => setDay(i, { closeTime: t })}
												placeholder="18:00"
												style={{ flex: 1 }}
											/>
										</View>
									) : (
										<Text
											style={{ flex: 1, fontSize: 13, color: Colors.ink400 }}
										>
											{closedLabel}
										</Text>
									)}
								</View>
								{dayError ? (
									<Text
										style={{
											fontSize: 12.5,
											color: Colors.danger,
											paddingLeft: 98,
										}}
									>
										{dayError.error}
									</Text>
								) : null}
							</View>
						);
					})}
				</View>
			)}
		</Sheet>
	);
}
