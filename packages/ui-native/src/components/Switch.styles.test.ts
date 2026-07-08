import { describe, expect, it } from "vitest";
import { resolveSwitchTrack, SWITCH_TRACK } from "./Switch.styles";

describe("resolveSwitchTrack", () => {
	it("returns the track dimensions for each size", () => {
		expect(resolveSwitchTrack("sm")).toEqual(SWITCH_TRACK.sm);
		expect(resolveSwitchTrack("lg")).toEqual(SWITCH_TRACK.lg);
	});

	it("defaults to md", () => {
		expect(resolveSwitchTrack(undefined)).toEqual(SWITCH_TRACK.md);
	});
});
