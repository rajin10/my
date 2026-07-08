import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearAuthCookies,
	DISPLAY_USER_COOKIE,
	readAuthInitialState,
	SESSION_HINT_COOKIE,
	setSessionHintCookie,
	syncAuthDisplayCookie,
} from "../auth-cookies";

describe("auth cookies", () => {
	let cookieJar: string;

	beforeEach(() => {
		cookieJar = "";
		vi.stubGlobal("document", {
			get cookie() {
				return cookieJar;
			},
			set cookie(value: string) {
				const [pair] = value.split(";");
				const eq = pair.indexOf("=");
				const name = pair.slice(0, eq);
				const val = pair.slice(eq + 1);
				const parts = cookieJar
					.split("; ")
					.filter(Boolean)
					.filter((p) => !p.startsWith(`${name}=`));
				if (val !== "") parts.push(`${name}=${val}`);
				cookieJar = parts.join("; ");
			},
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("setSessionHintCookie writes talash_session=1", () => {
		setSessionHintCookie();
		expect(cookieJar).toContain(`${SESSION_HINT_COOKIE}=1`);
	});

	it("syncAuthDisplayCookie writes encoded user payload", () => {
		syncAuthDisplayCookie({
			id: "u1",
			email: "a@b.com",
			name: "Sara",
			role: "user",
		});
		expect(cookieJar).toContain(`${DISPLAY_USER_COOKIE}=`);
	});

	it("clearAuthCookies removes session and display cookies", () => {
		setSessionHintCookie();
		syncAuthDisplayCookie({
			id: "u1",
			email: null,
			name: "Sara",
			role: "user",
		});
		clearAuthCookies();
		expect(cookieJar).not.toContain(`${SESSION_HINT_COOKIE}=1`);
		expect(cookieJar).not.toContain(`${DISPLAY_USER_COOKIE}=`);
	});

	it("readAuthInitialState parses cookies from a reader", () => {
		const user = encodeURIComponent(
			JSON.stringify({
				id: "u1",
				email: null,
				name: "Sara",
				role: "user",
			}),
		);
		const state = readAuthInitialState({
			get: (name) => {
				if (name === SESSION_HINT_COOKIE) return { value: "1" };
				if (name === DISPLAY_USER_COOKIE) return { value: user };
				return undefined;
			},
		});
		expect(state.hasSession).toBe(true);
		expect(state.user?.name).toBe("Sara");
	});

	it("readAuthInitialState ignores malformed display cookie", () => {
		const state = readAuthInitialState({
			get: (name) => {
				if (name === SESSION_HINT_COOKIE) return { value: "1" };
				if (name === DISPLAY_USER_COOKIE) return { value: "not-json" };
				return undefined;
			},
		});
		expect(state.hasSession).toBe(true);
		expect(state.user).toBeNull();
	});
});
