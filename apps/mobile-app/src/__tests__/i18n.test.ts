import { describe, expect, it, vi } from "vitest";

vi.mock("expo-localization", () => ({
	getLocales: () => [{ languageCode: "en" }],
}));

import { getLocale, setLocale, t } from "../lib/i18n";

describe("i18n", () => {
	it("returns English by default", () => {
		setLocale("en");
		expect(getLocale()).toBe("en");
		expect(t("bookings.title")).toBe("My bookings");
	});

	it("returns Bengali when locale is bn", () => {
		setLocale("bn");
		expect(t("bookings.title")).toBe("আমার বুকিং");
		setLocale("en");
	});
});
