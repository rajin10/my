import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { Pressable, Text } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider, useApp } from "../context";
import { renderWithClient } from "./test-utils";

// --- Module boundaries -------------------------------------------------------

vi.mock("expo-router", () => ({
	router: {
		replace: vi.fn(),
		push: vi.fn(),
		navigate: vi.fn(),
		back: vi.fn(),
		canGoBack: () => false,
	},
}));
vi.mock("../lib/push", () => ({ registerPushToken: vi.fn() }));
vi.mock("../hooks/useOwnerData", () => ({
	useBusinessPhotos: () => ({ data: undefined }),
	useNotifications: () => ({ data: undefined }),
	useMarkNotificationRead: () => ({ mutate: vi.fn() }),
	useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
}));

// vi.hoisted so the (hoisted) vi.mock factory can reference it safely.
const { api, authEvents } = vi.hoisted(() => ({
	api: {
		businesses: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
		auth: { me: vi.fn(), logout: vi.fn() },
		branches: { list: vi.fn(), create: vi.fn() },
		services: {
			list: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		bookings: {
			listBranch: vi.fn(),
			confirm: vi.fn(),
			cancel: vi.fn(),
			complete: vi.fn(),
			assign: vi.fn(),
		},
		reviews: {
			listPending: vi.fn(),
			list: vi.fn(),
			approve: vi.fn(),
			reject: vi.fn(),
		},
		coupons: { list: vi.fn(), create: vi.fn(), delete: vi.fn() },
		team: { list: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() },
	},
	authEvents: {
		setOnUnauthorized: vi.fn(),
		emitUnauthorized: vi.fn(),
	},
}));
vi.mock("../lib/api", () => ({ api, authEvents }));

// --- Probe -------------------------------------------------------------------

const setupForm = {
	ownerName: "Owner",
	businessName: "Glow Studio",
	category: "Salon",
	city: "Dhaka",
	description: "",
	branches: [
		{ name: "Gulshan", area: "Road 1" },
		{ name: "Banani", area: "Road 2" },
	],
	services: [
		{
			id: "tmp",
			name: "Haircut",
			branch: "Gulshan",
			category: "Hair",
			duration: 60,
			price: 500,
		},
	],
};

// One resolved service (Gulshan) + one unresolved service (NoSuchBranch)
const setupFormWithUnresolved = {
	...setupForm,
	services: [
		{
			id: "tmp1",
			name: "Haircut",
			branch: "Gulshan",
			category: "Hair",
			duration: 60,
			price: 500,
		},
		{
			id: "tmp2",
			name: "Ghost Service",
			branch: "NoSuchBranch",
			category: "Hair",
			duration: 30,
			price: 200,
		},
	],
};

function Probe() {
	const app = useApp();
	return (
		<>
			<Text>{`status:${app.status}`}</Text>
			<Text>{`sheet:${app.sheet?.type ?? "none"}`}</Text>
			<Text>{`branches:${app.business.branches.join("|")}`}</Text>
			<Text testID="toast">{app.toast?.msg ?? ""}</Text>
			<Pressable
				testID="open-coupon"
				onPress={() => app.setSheet({ type: "createCoupon" })}
			>
				<Text>open</Text>
			</Pressable>
			<Pressable testID="toggle" onPress={() => app.toggleStatus()}>
				<Text>toggle</Text>
			</Pressable>
			<Pressable
				testID="coupon"
				onPress={() =>
					app.createCoupon({
						code: "SAVE20",
						type: "Percentage",
						value: 20,
						max: 100,
					})
				}
			>
				<Text>coupon</Text>
			</Pressable>
			<Pressable
				testID="staff"
				onPress={() =>
					app.updateStaff("staff1", {
						role: "Manager",
						title: "Lead",
						branch: "Gulshan",
					})
				}
			>
				<Text>staff</Text>
			</Pressable>
			<Pressable testID="golive" onPress={() => app.goLive(setupForm)}>
				<Text>golive</Text>
			</Pressable>
			<Pressable
				testID="golive-unresolved"
				onPress={() => app.goLive(setupFormWithUnresolved)}
			>
				<Text>golive-unresolved</Text>
			</Pressable>
		</>
	);
}

const single = (id: string) => ({ data: { id } });
const business = (status: string) => ({
	data: [
		{
			id: "v1",
			name: "Glow Studio",
			category: "Salon",
			city: "Dhaka",
			description: "",
			status,
		},
	],
});

beforeEach(() => {
	vi.clearAllMocks();
	// Authenticated by default (isAuthed seeds from this sync read).
	(SecureStore.getItem as ReturnType<typeof vi.fn>).mockReturnValue("token");
	api.auth.me.mockResolvedValue({ data: { name: "Owner", email: "o@x.com" } });
	api.businesses.list.mockResolvedValue(business("Active"));
	api.branches.list.mockResolvedValue({
		data: [
			{ id: "b1", name: "Gulshan" },
			{ id: "b2", name: "Banani" },
		],
	});
	api.services.list.mockResolvedValue({ data: [] });
	api.bookings.listBranch.mockResolvedValue({ data: [] });
	api.reviews.listPending.mockResolvedValue([]);
	api.reviews.list.mockResolvedValue({ data: [] });
	api.coupons.list.mockResolvedValue({ data: [] });
	api.team.list.mockResolvedValue({ data: [] });
});

const render = () =>
	renderWithClient(
		<AppProvider>
			<Probe />
		</AppProvider>,
	);

describe("toggleStatus (#5)", () => {
	it("toggles an Active business to Draft via the API", async () => {
		api.businesses.list.mockResolvedValue(business("Active"));
		api.businesses.update.mockResolvedValue({});
		render();
		await screen.findByText("status:Active");

		fireEvent.press(screen.getByTestId("toggle"));
		await waitFor(() =>
			expect(api.businesses.update).toHaveBeenCalledWith("v1", {
				status: "Draft",
			}),
		);
	});

	it("does not call the API for a Suspended business", async () => {
		api.businesses.list.mockResolvedValue(business("Suspended"));
		render();
		await screen.findByText("status:Suspended");

		fireEvent.press(screen.getByTestId("toggle"));
		await Promise.resolve();
		expect(api.businesses.update).not.toHaveBeenCalled();
	});
});

describe("createCoupon close-on-success vs stay-open-on-error (#6)", () => {
	it("closes the sheet only after the coupon is created", async () => {
		api.coupons.create.mockResolvedValue(single("c1"));
		render();
		await screen.findByText("status:Active");

		fireEvent.press(screen.getByTestId("open-coupon"));
		await screen.findByText("sheet:createCoupon");

		fireEvent.press(screen.getByTestId("coupon"));
		await waitFor(() => expect(screen.getByText("sheet:none")).toBeTruthy());
	});

	it("keeps the sheet open when creation fails", async () => {
		api.coupons.create.mockRejectedValue(new Error("duplicate code"));
		render();
		await screen.findByText("status:Active");

		fireEvent.press(screen.getByTestId("open-coupon"));
		await screen.findByText("sheet:createCoupon");

		fireEvent.press(screen.getByTestId("coupon"));
		// Give the rejected mutation a tick to settle, then assert still open.
		await waitFor(() => expect(api.coupons.create).toHaveBeenCalled());
		expect(screen.getByText("sheet:createCoupon")).toBeTruthy();
	});
});

describe("updateStaff maps branch name to id (#1)", () => {
	it("resolves the picked branch name to its branchId", async () => {
		api.team.update.mockResolvedValue(single("staff1"));
		render();
		// Wait until branches have loaded into the local business model.
		await screen.findByText("branches:Gulshan|Banani");

		fireEvent.press(screen.getByTestId("staff"));
		await waitFor(() =>
			expect(api.team.update).toHaveBeenCalledWith("staff1", {
				role: "Manager",
				title: "Lead",
				branchId: "b1",
			}),
		);
	});
});

describe("goLive onboarding (#7)", () => {
	it("creates branches then services with the right branch, in one business", async () => {
		api.businesses.create.mockResolvedValue(single("v1"));
		api.branches.create.mockImplementation((body: { name: string }) =>
			Promise.resolve(single(`branch-${body.name}`)),
		);
		api.services.create.mockResolvedValue({});
		render();

		fireEvent.press(screen.getByTestId("golive"));

		await waitFor(() => expect(api.services.create).toHaveBeenCalled());
		expect(api.businesses.create).toHaveBeenCalledTimes(1);
		expect(api.branches.create).toHaveBeenCalledTimes(2);
		expect(api.services.create).toHaveBeenCalledWith(
			expect.objectContaining({ branchId: "branch-Gulshan", name: "Haircut" }),
		);
	});

	it("recovers without a duplicate business when a branch fails", async () => {
		const { router } = await import("expo-router");
		api.businesses.create.mockResolvedValue(single("v1"));
		api.branches.create.mockRejectedValue(new Error("network"));
		render();

		fireEvent.press(screen.getByTestId("golive"));

		await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(tabs)"));
		expect(api.businesses.create).toHaveBeenCalledTimes(1);
	});

	it("warns about manual completion when a service's branch can't be resolved", async () => {
		api.businesses.create.mockResolvedValue(single("v1"));
		api.branches.create.mockImplementation((body: { name: string }) =>
			Promise.resolve(single(`branch-${body.name}`)),
		);
		api.services.create.mockResolvedValue({});
		render();

		fireEvent.press(screen.getByTestId("golive-unresolved"));

		// The owner is told some items need manual setup instead of a clean success.
		await screen.findByText(
			"Business created — some items may need to be added manually.",
		);
		// The business is created exactly once (no duplicate).
		expect(api.businesses.create).toHaveBeenCalledTimes(1);
		// Only the resolvable service is sent; the unresolved one is not.
		expect(api.services.create).toHaveBeenCalledTimes(1);
		expect(api.services.create).toHaveBeenCalledWith(
			expect.objectContaining({ branchId: "branch-Gulshan", name: "Haircut" }),
		);
	});
});
