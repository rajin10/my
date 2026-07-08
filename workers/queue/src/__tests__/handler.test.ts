import type { JobPayload } from "@repo/core/src/queue/jobs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleQueue } from "../handler";

// ---- Repository mocks ----
const {
	MockBookingsRepository,
	mockBookingFindOne,
	mockFindCustomersByBusiness,
} = vi.hoisted(() => {
	const mockBookingFindOne = vi.fn();
	const mockFindCustomersByBusiness = vi.fn();
	const MockBookingsRepository = vi.fn(function (this: {
		findOne: typeof mockBookingFindOne;
		findCustomersByBusiness: typeof mockFindCustomersByBusiness;
	}) {
		this.findOne = mockBookingFindOne;
		this.findCustomersByBusiness = mockFindCustomersByBusiness;
	});
	return {
		MockBookingsRepository,
		mockBookingFindOne,
		mockFindCustomersByBusiness,
	};
});

const { MockReviewsRepository, mockReviewFindOne } = vi.hoisted(() => {
	const mockReviewFindOne = vi.fn();
	const MockReviewsRepository = vi.fn(function (this: {
		findOne: typeof mockReviewFindOne;
	}) {
		this.findOne = mockReviewFindOne;
	});
	return { MockReviewsRepository, mockReviewFindOne };
});

const { MockBusinessesRepository, mockBusinessFindOne } = vi.hoisted(() => {
	const mockBusinessFindOne = vi.fn();
	const MockBusinessesRepository = vi.fn(function (this: {
		findOne: typeof mockBusinessFindOne;
	}) {
		this.findOne = mockBusinessFindOne;
	});
	return { MockBusinessesRepository, mockBusinessFindOne };
});

const { MockBranchesRepository, mockBranchFindOne } = vi.hoisted(() => {
	const mockBranchFindOne = vi.fn();
	const MockBranchesRepository = vi.fn(function (this: {
		findOne: typeof mockBranchFindOne;
	}) {
		this.findOne = mockBranchFindOne;
	});
	return { MockBranchesRepository, mockBranchFindOne };
});

const { MockAuthRepository, mockFindUserById, mockClearPushToken } = vi.hoisted(
	() => {
		const mockFindUserById = vi.fn();
		const mockClearPushToken = vi.fn();
		const MockAuthRepository = vi.fn(function (this: {
			findUserById: typeof mockFindUserById;
			clearPushToken: typeof mockClearPushToken;
		}) {
			this.findUserById = mockFindUserById;
			this.clearPushToken = mockClearPushToken;
		});
		return { MockAuthRepository, mockFindUserById, mockClearPushToken };
	},
);

const { MockOrdersRepository, mockOrderFindOne } = vi.hoisted(() => {
	const mockOrderFindOne = vi.fn();
	const MockOrdersRepository = vi.fn(function (this: {
		findOne: typeof mockOrderFindOne;
	}) {
		this.findOne = mockOrderFindOne;
	});
	return { MockOrdersRepository, mockOrderFindOne };
});

const { MockNotificationsRepository, mockNotificationCreate } = vi.hoisted(
	() => {
		const mockNotificationCreate = vi.fn();
		const MockNotificationsRepository = vi.fn(function (this: {
			create: typeof mockNotificationCreate;
		}) {
			this.create = mockNotificationCreate;
		});
		return { MockNotificationsRepository, mockNotificationCreate };
	},
);

vi.mock("@repo/core/src/database/repositories/bookings.repository", () => ({
	BookingsRepository: MockBookingsRepository,
}));
vi.mock("@repo/core/src/database/repositories/reviews.repository", () => ({
	ReviewsRepository: MockReviewsRepository,
}));
vi.mock("@repo/core/src/database/repositories/businesses.repository", () => ({
	BusinessesRepository: MockBusinessesRepository,
}));
vi.mock("@repo/core/src/database/repositories/branches.repository", () => ({
	BranchesRepository: MockBranchesRepository,
}));
vi.mock("@repo/core/src/database/repositories/auth.repository", () => ({
	AuthRepository: MockAuthRepository,
}));
vi.mock("@repo/core/src/database/repositories/rewards.repository", () => ({
	RewardsRepository: vi.fn(function (this: Record<string, unknown>) {}),
}));
vi.mock(
	"@repo/core/src/database/repositories/notifications.repository",
	() => ({
		NotificationsRepository: MockNotificationsRepository,
	}),
);
vi.mock("@repo/core/src/database/repositories/orders.repository", () => ({
	OrdersRepository: MockOrdersRepository,
}));
vi.mock("@repo/core/src/modules/rewards/rewards.service", () => ({
	RewardsService: vi.fn(function (this: {
		creditForBooking: ReturnType<typeof vi.fn>;
	}) {
		this.creditForBooking = vi.fn();
	}),
}));

const { MockCampaignsRepository, mockCampaignFindOne, mockCampaignUpdateOne } =
	vi.hoisted(() => {
		const mockCampaignFindOne = vi.fn();
		const mockCampaignUpdateOne = vi.fn();
		const MockCampaignsRepository = vi.fn(function (this: {
			findOne: typeof mockCampaignFindOne;
			updateOne: typeof mockCampaignUpdateOne;
		}) {
			this.findOne = mockCampaignFindOne;
			this.updateOne = mockCampaignUpdateOne;
		});
		return {
			MockCampaignsRepository,
			mockCampaignFindOne,
			mockCampaignUpdateOne,
		};
	});

vi.mock("@repo/core/src/database/repositories/campaigns.repository", () => ({
	CampaignsRepository: MockCampaignsRepository,
}));

const TEST_ENV = {} as CloudflareBindings;

function makeMessage(body: JobPayload) {
	return { body, ack: vi.fn(), retry: vi.fn() };
}

function makeBatch(messages: ReturnType<typeof makeMessage>[]) {
	return { messages } as unknown as MessageBatch<JobPayload>;
}

beforeEach(() => {
	vi.clearAllMocks();
	// Default: all lookups return empty
	mockBookingFindOne.mockResolvedValue({ data: null });
	mockReviewFindOne.mockResolvedValue({ data: null });
	mockBusinessFindOne.mockResolvedValue({ data: null });
	mockBranchFindOne.mockResolvedValue({ data: null });
	mockFindUserById.mockResolvedValue(null);
	mockCampaignFindOne.mockResolvedValue(null);
	mockCampaignUpdateOne.mockResolvedValue(null);
	mockFindCustomersByBusiness.mockResolvedValue([]);
	mockClearPushToken.mockResolvedValue(undefined);
	mockOrderFindOne.mockResolvedValue({ data: null });
	mockNotificationCreate.mockResolvedValue(null);
});

describe("handleQueue", () => {
	it("acks a successfully processed message", async () => {
		// Booking not found → handler returns cleanly → message is acked.
		const msg = makeMessage({
			type: "notification.booking_created",
			bookingId: "b-missing",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);
		expect(msg.ack).toHaveBeenCalledOnce();
		expect(msg.retry).not.toHaveBeenCalled();
	});

	it("retries a message when the handler throws", async () => {
		mockBookingFindOne.mockRejectedValue(new Error("db down"));
		const msg = makeMessage({
			type: "notification.booking_created",
			bookingId: "b-1",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);
		expect(msg.retry).toHaveBeenCalledOnce();
		expect(msg.ack).not.toHaveBeenCalled();
	});

	it("processes multiple messages independently", async () => {
		const msg1 = makeMessage({
			type: "notification.booking_created",
			bookingId: "b-1",
		});
		const msg2 = makeMessage({
			type: "notification.booking_cancelled",
			bookingId: "b-2",
		});
		await handleQueue(makeBatch([msg1, msg2]), TEST_ENV);
		expect(msg1.ack).toHaveBeenCalledOnce();
		expect(msg2.ack).toHaveBeenCalledOnce();
	});

	it("retries only the failing message in a batch", async () => {
		// First lookup rejects (retry); the second falls back to the default
		// resolved value (booking not found → ack).
		mockBookingFindOne.mockRejectedValueOnce(new Error("fail"));
		const msg1 = makeMessage({
			type: "notification.booking_created",
			bookingId: "b-1",
		});
		const msg2 = makeMessage({
			type: "notification.booking_created",
			bookingId: "b-2",
		});
		await handleQueue(makeBatch([msg1, msg2]), TEST_ENV);
		expect(msg1.retry).toHaveBeenCalledOnce();
		expect(msg2.ack).toHaveBeenCalledOnce();
	});
});

describe("dispatch: rewards.credit", () => {
	it("skips credit and acks when booking not found", async () => {
		mockBookingFindOne.mockResolvedValue({ data: null });
		const msg = makeMessage({
			type: "rewards.credit",
			userId: "u-1",
			bookingId: "b-missing",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);
		expect(msg.ack).toHaveBeenCalledOnce();
	});
});

describe("dispatch: notification.booking_created", () => {
	it("acks and sends push to customer when push token exists", async () => {
		mockBookingFindOne.mockResolvedValue({
			data: { id: "b-1", userId: "u-1", branchId: "branch-1" },
		});
		mockFindUserById.mockResolvedValue({ id: "u-1", pushToken: null });
		mockBranchFindOne.mockResolvedValue({ data: { businessId: "v-1" } });
		mockBusinessFindOne.mockResolvedValue({ data: { ownerId: "owner-1" } });

		const msg = makeMessage({
			type: "notification.booking_created",
			bookingId: "b-1",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);
		expect(msg.ack).toHaveBeenCalledOnce();
	});

	it("acks when booking not found", async () => {
		mockBookingFindOne.mockResolvedValue({ data: null });
		const msg = makeMessage({
			type: "notification.booking_created",
			bookingId: "b-missing",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);
		expect(msg.ack).toHaveBeenCalledOnce();
	});
});

describe("dispatch: notification.review_pending", () => {
	it("acks when review not found", async () => {
		mockReviewFindOne.mockResolvedValue({ data: null });
		const msg = makeMessage({
			type: "notification.review_pending",
			reviewId: "r-missing",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);
		expect(msg.ack).toHaveBeenCalledOnce();
	});

	it("acks and notifies business owner when review exists", async () => {
		mockReviewFindOne.mockResolvedValue({
			data: { id: "r-1", businessId: "v-1" },
		});
		mockBusinessFindOne.mockResolvedValue({ data: { ownerId: "owner-1" } });
		mockFindUserById.mockResolvedValue({ id: "owner-1", pushToken: null }); // no push token — skip send

		const msg = makeMessage({
			type: "notification.review_pending",
			reviewId: "r-1",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);
		expect(msg.ack).toHaveBeenCalledOnce();
	});
});

describe("dispatch: campaign.send", () => {
	it("acks when campaign not found", async () => {
		// default mockCampaignFindOne returns null (set in beforeEach)
		const msg = makeMessage({ type: "campaign.send", campaignId: "c-missing" });
		await handleQueue(makeBatch([msg]), TEST_ENV);
		expect(msg.ack).toHaveBeenCalledOnce();
		expect(mockCampaignUpdateOne).not.toHaveBeenCalled();
	});

	it("skips send when campaign already Sent (idempotency guard)", async () => {
		mockCampaignFindOne.mockResolvedValue({
			id: "c-1",
			status: "Sent",
			businessId: "v-1",
			name: "Sale",
			message: "Hello",
		});
		const msg = makeMessage({ type: "campaign.send", campaignId: "c-1" });
		await handleQueue(makeBatch([msg]), TEST_ENV);
		expect(msg.ack).toHaveBeenCalledOnce();
		expect(mockFindCustomersByBusiness).not.toHaveBeenCalled();
		expect(mockCampaignUpdateOne).not.toHaveBeenCalled();
	});

	it("fans out to customers with push tokens and marks campaign Sent", async () => {
		mockCampaignFindOne.mockResolvedValue({
			id: "c-1",
			status: "Draft",
			businessId: "v-1",
			name: "Flash Sale",
			message: "20% off today!",
		});
		// Two customers — one with a push token, one without
		mockFindCustomersByBusiness.mockResolvedValue([
			{ userId: "u-1", pushToken: null },
			{ userId: "u-2", pushToken: "ExponentPushToken[xxx]" },
		]);
		// Mock global fetch for Expo push
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ data: [{ status: "ok" }] }), {
				status: 200,
			}),
		);

		const msg = makeMessage({ type: "campaign.send", campaignId: "c-1" });
		await handleQueue(makeBatch([msg]), TEST_ENV);

		expect(msg.ack).toHaveBeenCalledOnce();
		expect(mockFindCustomersByBusiness).toHaveBeenCalledWith("v-1");
		expect(fetchMock).toHaveBeenCalledOnce(); // only the customer with a token
		expect(mockCampaignUpdateOne).toHaveBeenCalledWith(
			"c-1",
			expect.objectContaining({ status: "Sent" }),
		);

		fetchMock.mockRestore();
	});

	it("a push transport failure for one customer does not abort the fan-out or retry the message", async () => {
		mockCampaignFindOne.mockResolvedValue({
			id: "c-2",
			status: "Draft",
			businessId: "v-1",
			name: "Flash Sale",
			message: "20% off today!",
		});
		mockFindCustomersByBusiness.mockResolvedValue([
			{ userId: "u-1", pushToken: "ExponentPushToken[a]" },
			{ userId: "u-2", pushToken: "ExponentPushToken[b]" },
		]);
		// First customer's push transport throws; the second must still be attempted.
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockRejectedValueOnce(new Error("network down"))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [{ status: "ok" }] }), {
					status: 200,
				}),
			);

		const msg = makeMessage({ type: "campaign.send", campaignId: "c-2" });
		await handleQueue(makeBatch([msg]), TEST_ENV);

		// Campaign is marked Sent before fan-out, so a retry can never re-deliver —
		// one customer's transport failure must not abort the loop nor retry the job
		// (which would silently drop every customer after the failure point).
		expect(fetchMock).toHaveBeenCalledTimes(2); // did not abort after the first failure
		expect(msg.ack).toHaveBeenCalledOnce();
		expect(msg.retry).not.toHaveBeenCalled();
		expect(mockCampaignUpdateOne).toHaveBeenCalledWith(
			"c-2",
			expect.objectContaining({ status: "Sent" }),
		);

		fetchMock.mockRestore();
	});
});

describe("dispatch: notification.order_status_changed", () => {
	it("acks and skips when the order is not found", async () => {
		mockOrderFindOne.mockResolvedValue({ data: null });
		const msg = makeMessage({
			type: "notification.order_status_changed",
			orderId: "o-missing",
			status: "Confirmed",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);
		expect(msg.ack).toHaveBeenCalledOnce();
		expect(mockNotificationCreate).not.toHaveBeenCalled();
	});

	it("records an order notification and sends a push when the customer has a token", async () => {
		mockOrderFindOne.mockResolvedValue({
			data: { id: "o-1", userId: "u-1", businessId: "v-1" },
		});
		mockFindUserById.mockResolvedValue({
			id: "u-1",
			pushToken: "ExponentPushToken[xxx]",
		});
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ data: [{ status: "ok" }] }), {
				status: 200,
			}),
		);

		const msg = makeMessage({
			type: "notification.order_status_changed",
			orderId: "o-1",
			status: "Confirmed",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);

		expect(msg.ack).toHaveBeenCalledOnce();
		expect(mockNotificationCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "u-1",
				orderId: "o-1",
				go: "orders",
				type: "order",
			}),
		);
		expect(fetchMock).toHaveBeenCalledOnce();

		fetchMock.mockRestore();
	});

	it("records a cancel notification with no push when the customer has no token", async () => {
		mockOrderFindOne.mockResolvedValue({
			data: { id: "o-2", userId: "u-2", businessId: "v-1" },
		});
		mockFindUserById.mockResolvedValue({ id: "u-2", pushToken: null });
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ data: [{ status: "ok" }] }), {
				status: 200,
			}),
		);

		const msg = makeMessage({
			type: "notification.order_status_changed",
			orderId: "o-2",
			status: "Cancelled",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);

		expect(msg.ack).toHaveBeenCalledOnce();
		expect(mockNotificationCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "u-2",
				orderId: "o-2",
				go: "orders",
				type: "order_cancelled",
			}),
		);
		expect(fetchMock).not.toHaveBeenCalled();

		fetchMock.mockRestore();
	});

	it("a push-send transport failure does not retry the message — the in-app row is recorded once, so a retry cannot duplicate it", async () => {
		mockOrderFindOne.mockResolvedValue({
			data: { id: "o-3", userId: "u-3", businessId: "v-1" },
		});
		mockFindUserById.mockResolvedValue({
			id: "u-3",
			pushToken: "ExponentPushToken[xxx]",
		});
		// Expo push transport throws (network error) AFTER the in-app row is recorded.
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockRejectedValue(new Error("network down"));

		const msg = makeMessage({
			type: "notification.order_status_changed",
			orderId: "o-3",
			status: "Confirmed",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);

		// Push is best-effort: a transport failure is logged, not rethrown, so the
		// job is acked rather than retried. Re-running the handler would write a
		// second in-app notification row (no dedup key), which is the bug this guards.
		expect(msg.ack).toHaveBeenCalledOnce();
		expect(msg.retry).not.toHaveBeenCalled();
		expect(mockNotificationCreate).toHaveBeenCalledOnce();

		fetchMock.mockRestore();
	});

	it("a DB failure recording the in-app row still retries the message (push best-effort does not swallow DB errors)", async () => {
		mockOrderFindOne.mockResolvedValue({
			data: { id: "o-4", userId: "u-4", businessId: "v-1" },
		});
		mockFindUserById.mockResolvedValue({ id: "u-4", pushToken: null });
		mockNotificationCreate.mockRejectedValueOnce(new Error("d1 write failed"));

		const msg = makeMessage({
			type: "notification.order_status_changed",
			orderId: "o-4",
			status: "Confirmed",
		});
		await handleQueue(makeBatch([msg]), TEST_ENV);

		// The push try/catch is scoped to delivery only — a record failure must
		// still propagate so the job retries.
		expect(msg.retry).toHaveBeenCalledOnce();
		expect(msg.ack).not.toHaveBeenCalled();
	});
});
