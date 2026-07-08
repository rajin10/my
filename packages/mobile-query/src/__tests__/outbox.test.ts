import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	isQueueableMutation,
	queueableMutationsForApp,
} from "../outbox/allowlist";
import { flushOutbox } from "../outbox/flush";
import { queueOrRunSync } from "../outbox/queue-or-run-sync";
import { clearOutbox, enqueueOutboxEntry, loadOutbox } from "../outbox/storage";

describe("outbox allowlist", () => {
	it("allows owner booking mutations", () => {
		expect(isQueueableMutation("bookings.confirm", "owner-app")).toBe(true);
		expect(isQueueableMutation("bookings.complete", "owner-app")).toBe(true);
	});

	it("blocks owner favourites", () => {
		expect(isQueueableMutation("favourites.add", "owner-app")).toBe(false);
	});

	it("allows customer favourites and cancel", () => {
		expect(isQueueableMutation("favourites.add", "mobile-app")).toBe(true);
		expect(isQueueableMutation("bookings.cancel", "mobile-app")).toBe(true);
	});

	it("blocks customer confirm", () => {
		expect(isQueueableMutation("bookings.confirm", "mobile-app")).toBe(false);
	});

	it("returns per-app lists", () => {
		expect(queueableMutationsForApp("owner-app")).toContain("bookings.assign");
		expect(queueableMutationsForApp("mobile-app")).toContain(
			"favourites.remove",
		);
	});
});

describe("outbox storage", () => {
	beforeEach(() => {
		clearOutbox("owner-app");
		clearOutbox("mobile-app");
	});

	it("enqueues and loads entries", () => {
		enqueueOutboxEntry("owner-app", {
			id: "e1",
			mutationType: "bookings.confirm",
			payload: { id: "b1" },
		});
		expect(loadOutbox("owner-app")).toHaveLength(1);
	});

	it("clears outbox", () => {
		enqueueOutboxEntry("owner-app", {
			id: "e1",
			mutationType: "bookings.confirm",
			payload: { id: "b1" },
		});
		clearOutbox("owner-app");
		expect(loadOutbox("owner-app")).toHaveLength(0);
	});
});

describe("flushOutbox", () => {
	beforeEach(() => {
		clearOutbox("owner-app");
	});

	it("processes FIFO and removes on success", async () => {
		enqueueOutboxEntry("owner-app", {
			id: "e1",
			mutationType: "bookings.confirm",
			payload: { id: "b1" },
		});
		const order: string[] = [];
		const result = await flushOutbox("owner-app", {
			"bookings.confirm": async (payload) => {
				order.push((payload as { id: string }).id);
			},
		});
		expect(result.processed).toBe(1);
		expect(result.failed).toBe(0);
		expect(result.conflicts).toBe(0);
		expect(result.paused).toBe(false);
		expect(order).toEqual(["b1"]);
		expect(loadOutbox("owner-app")).toHaveLength(0);
	});

	it("drops entry on conflict", async () => {
		enqueueOutboxEntry("owner-app", {
			id: "e1",
			mutationType: "bookings.cancel",
			payload: { id: "b1" },
		});
		const result = await flushOutbox("owner-app", {
			"bookings.cancel": async () => ({ conflict: true }),
		});
		expect(result.conflicts).toBe(1);
		expect(loadOutbox("owner-app")).toHaveLength(0);
	});

	it("pauses after retry cap", async () => {
		enqueueOutboxEntry("owner-app", {
			id: "e1",
			mutationType: "bookings.confirm",
			payload: { id: "b1" },
			retryCount: 4,
		});
		const result = await flushOutbox("owner-app", {
			"bookings.confirm": async () => {
				throw new Error("network");
			},
		});
		expect(result.failed).toBe(1);
		expect(result.paused).toBe(false);
		const entry = loadOutbox("owner-app")[0];
		expect(entry?.status).toBe("failed");
	});

	it("pauses on transient error before retry cap", async () => {
		enqueueOutboxEntry("owner-app", {
			id: "e1",
			mutationType: "bookings.confirm",
			payload: { id: "b1" },
		});
		const result = await flushOutbox("owner-app", {
			"bookings.confirm": async () => {
				throw new Error("network");
			},
		});
		expect(result.paused).toBe(true);
		expect(loadOutbox("owner-app")[0]?.retryCount).toBe(1);
	});

	it("pauses on 401", async () => {
		enqueueOutboxEntry("owner-app", {
			id: "e1",
			mutationType: "bookings.confirm",
			payload: { id: "b1" },
		});
		const result = await flushOutbox("owner-app", {
			"bookings.confirm": async () => {
				throw { status: 401 };
			},
		});
		expect(result.paused).toBe(true);
		expect(loadOutbox("owner-app")).toHaveLength(1);
	});
});

describe("queueOrRunSync", () => {
	beforeEach(() => {
		clearOutbox("owner-app");
	});

	it("runs online handler when online", () => {
		const onOnline = vi.fn();
		queueOrRunSync({
			appId: "owner-app",
			mutationType: "bookings.confirm",
			payload: { id: "b1" },
			isOnline: true,
			onOnline,
		});
		expect(onOnline).toHaveBeenCalled();
		expect(loadOutbox("owner-app")).toHaveLength(0);
	});

	it("enqueues when offline and queueable", () => {
		const onQueued = vi.fn();
		queueOrRunSync({
			appId: "owner-app",
			mutationType: "bookings.confirm",
			payload: { id: "b1" },
			isOnline: false,
			onOnline: vi.fn(),
			onQueued,
		});
		expect(onQueued).toHaveBeenCalled();
		expect(loadOutbox("owner-app")).toHaveLength(1);
	});

	it("blocks when offline and not queueable", () => {
		const onBlocked = vi.fn();
		queueOrRunSync({
			appId: "owner-app",
			mutationType: "favourites.add",
			payload: { id: "s1" },
			isOnline: false,
			onOnline: vi.fn(),
			onBlocked,
		});
		expect(onBlocked).toHaveBeenCalled();
		expect(loadOutbox("owner-app")).toHaveLength(0);
	});
});
