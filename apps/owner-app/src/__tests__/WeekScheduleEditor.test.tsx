import { fireEvent, render, screen } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";
import { WeekScheduleEditor } from "../components/WeekScheduleEditor";
import { mergeWeekSchedule } from "../lib/schedule";

const baseProps = {
	title: "Working hours",
	intro: "Opening hours.",
	saveLabel: "Save",
	savingLabel: "Saving…",
	closedLabel: "Closed",
	isLoading: false,
	isError: false,
	isSaving: false,
	onClose: () => {},
	onSave: () => {},
};

// Distinctive Monday open time so we can find it among the seven rows.
const dataWithMonday = (open: string) =>
	mergeWeekSchedule([
		{ dayOfWeek: 1, isClosed: false, openTime: open, closeTime: "18:00" },
	]);

describe("WeekScheduleEditor", () => {
	it("seeds its inputs from the query data", () => {
		render(
			<WeekScheduleEditor {...baseProps} data={dataWithMonday("10:30")} />,
		);
		expect(screen.getByDisplayValue("10:30")).toBeTruthy();
	});

	it("does not clobber edits when the query refetches (seed-once)", () => {
		const { rerender } = render(
			<WeekScheduleEditor {...baseProps} data={dataWithMonday("10:30")} />,
		);
		expect(screen.getByDisplayValue("10:30")).toBeTruthy();

		// A background refetch delivers different data...
		rerender(
			<WeekScheduleEditor {...baseProps} data={dataWithMonday("15:45")} />,
		);

		// ...but the editor keeps what it first seeded, never overwriting edits.
		expect(screen.getByDisplayValue("10:30")).toBeTruthy();
		expect(screen.queryByDisplayValue("15:45")).toBeNull();
	});

	it("saves the current schedule when the footer button is pressed", () => {
		const onSave = vi.fn();
		render(
			<WeekScheduleEditor
				{...baseProps}
				data={dataWithMonday("10:30")}
				onSave={onSave}
			/>,
		);
		fireEvent.press(screen.getByText("Save"));
		expect(onSave).toHaveBeenCalled();
		const saved = onSave.mock.calls.at(-1)?.[0] as {
			dayOfWeek: number;
			openTime: string;
		}[];
		expect(saved.find((d) => d.dayOfWeek === 1)?.openTime).toBe("10:30");
	});
});

describe("WeekScheduleEditor — error state", () => {
	it("shows the error message and hides the day grid when isError is true", () => {
		render(<WeekScheduleEditor {...baseProps} isError data={undefined} />);
		expect(
			screen.getByText("Couldn't load the schedule. Please try again."),
		).toBeTruthy();
		// No time inputs should be rendered.
		expect(screen.queryByPlaceholderText("09:00")).toBeNull();
		expect(screen.queryByPlaceholderText("18:00")).toBeNull();
	});

	it("renders no Save button in error state, so defaults can't clobber real data", () => {
		render(<WeekScheduleEditor {...baseProps} isError data={undefined} />);
		// With no Save control there is no way to serialize the default week over
		// the business's real hours — the only action offered is Retry.
		expect(screen.queryByText("Save")).toBeNull();
	});

	it("calls onRetry when the Retry button is pressed in error state", () => {
		const onRetry = vi.fn();
		render(
			<WeekScheduleEditor
				{...baseProps}
				isError
				data={undefined}
				onRetry={onRetry}
			/>,
		);
		fireEvent.press(screen.getByText("Retry"));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("does not render a Retry button when onRetry is not provided", () => {
		render(<WeekScheduleEditor {...baseProps} isError data={undefined} />);
		expect(screen.queryByText("Retry")).toBeNull();
	});
});

describe("WeekScheduleEditor — time validation", () => {
	it("shows an inline error when an open day's time is invalid, and clears it once fixed", () => {
		render(
			<WeekScheduleEditor {...baseProps} data={dataWithMonday("10:30")} />,
		);
		// A valid seeded week shows no time error.
		expect(screen.queryByText("Enter times as HH:MM (24-hour).")).toBeNull();

		// Typing a malformed time surfaces the inline format error reactively...
		fireEvent.changeText(screen.getByDisplayValue("10:30"), "25:99");
		expect(screen.getByText("Enter times as HH:MM (24-hour).")).toBeTruthy();

		// ...and correcting it clears the error again.
		fireEvent.changeText(screen.getByDisplayValue("25:99"), "10:00");
		expect(screen.queryByText("Enter times as HH:MM (24-hour).")).toBeNull();
	});

	it("flags an inverted open/close range with an inline error", () => {
		// Monday opens 10:30, closes 18:00 by default — push open past close.
		render(
			<WeekScheduleEditor {...baseProps} data={dataWithMonday("10:30")} />,
		);
		fireEvent.changeText(screen.getByDisplayValue("10:30"), "19:00");
		expect(
			screen.getByText("Opening time must be before closing time."),
		).toBeTruthy();
	});
});
