# Phase 1 — Profile Details + Booking Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add phone editing + "member since" to the account profile and split bookings into Upcoming/Past tabs, while extracting the profile and bookings concerns out of the 687-line `account/page.tsx` into focused `_components/`.

**Architecture:** A pure `partitionBookings` helper holds the Upcoming/Past rule (TDD'd in isolation). Two self-contained client components — `ProfileCard` and `BookingsSection` — each own their own queries/mutations/state and are rendered by a slimmed `account/page.tsx`. No backend changes: phone uses the existing `users.update`, member-since/phone come from the existing `users.get` (the full `User` record, since `auth.me()`/`AuthUser` lacks `phone`/`createdAt`).

**Tech Stack:** Next.js 16, React 19, TanStack Query 5, Vitest + Testing Library, `@repo/api-client`.

**Spec:** [2026-06-08-account-auth-features-design.md](../specs/2026-06-08-account-auth-features-design.md) (Phase 1 section). Builds on Phase 0 (zustand auth store, already merged).

---

## Canonical verification commands (Turbo-routed Bun monorepo — `cd <pkg> && bun run test` fails with exit 127)
- **Single test file:** `cd sites/marketing-site && bunx vitest run <path>`
- **Whole suite:** `bun run --filter @repo/marketing-site test` (from worktree root)
- **Lint:** `bun run --filter @repo/marketing-site lint` (from worktree root)
- **Type-check:** `cd sites/marketing-site && bunx tsc --noEmit`
- **Build:** `bun run build` (from worktree root)

## File Structure

| File | Responsibility |
|---|---|
| `sites/marketing-site/src/app/account/_components/partition-bookings.ts` | **Create.** Pure `partitionBookings(bookings, now)` → `{ upcoming, past }` (the hybrid rule + sorting). No React. |
| `sites/marketing-site/src/app/account/_components/__tests__/partition-bookings.test.ts` | **Create.** Unit tests for the rule + sorting. |
| `sites/marketing-site/src/app/account/_components/BookingsSection.tsx` | **Create.** Self-contained: bookings query, Upcoming/Past tabs, cancel, review form. |
| `sites/marketing-site/src/app/account/_components/__tests__/BookingsSection.test.tsx` | **Create.** Render test: tab toggle shows the right partition. |
| `sites/marketing-site/src/app/account/_components/ProfileCard.tsx` | **Create.** Self-contained: avatar, name edit, **phone edit (new)**, **member-since (new)**, sign out, delete. |
| `sites/marketing-site/src/app/account/_components/__tests__/ProfileCard.test.tsx` | **Create.** Render test: phone + member-since display, phone edit. |
| `sites/marketing-site/src/app/account/page.tsx` | **Rewrite (slim).** Compose `<ProfileCard />` + rewards/sessions (inline) + `<BookingsSection />` + notifications/favourites (inline). Removes the profile/bookings code now living in components. |

**Scope boundary:** Phase 1 touches only profile + bookings. Rewards, Active sessions, Notifications, and Saved venues stay inline in `page.tsx` (untouched) — they get extracted only when a later phase touches them.

---

## Task 1: `partitionBookings` pure helper

**Files:**
- Create: `sites/marketing-site/src/app/account/_components/partition-bookings.ts`
- Test: `sites/marketing-site/src/app/account/_components/__tests__/partition-bookings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sites/marketing-site/src/app/account/_components/__tests__/partition-bookings.test.ts`:

```ts
import type { Booking } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { partitionBookings } from "../partition-bookings";

const NOW = new Date("2026-06-08T12:00:00Z");

function booking(over: Partial<Booking>): Booking {
	return {
		id: "b",
		userId: "u1",
		serviceId: "s1",
		branchId: "br1",
		venueId: "v1",
		staffId: null,
		slot: "2026-06-10T10:00:00Z",
		status: "Confirmed",
		price: 100,
		discount: 0,
		couponCode: null,
		createdAt: "2026-06-01T00:00:00Z",
		updatedAt: null,
		...over,
	};
}

describe("partitionBookings", () => {
	it("puts active future bookings (Pending/Confirmed) in upcoming", () => {
		const pending = booking({ id: "p", status: "Pending", slot: "2026-06-09T10:00:00Z" });
		const confirmed = booking({ id: "c", status: "Confirmed", slot: "2026-06-11T10:00:00Z" });
		const { upcoming, past } = partitionBookings([pending, confirmed], NOW);
		expect(upcoming.map((b) => b.id)).toEqual(["p", "c"]);
		expect(past).toEqual([]);
	});

	it("puts an elapsed Confirmed booking in past (time wins over status)", () => {
		const elapsed = booking({ id: "e", status: "Confirmed", slot: "2026-06-05T10:00:00Z" });
		const { upcoming, past } = partitionBookings([elapsed], NOW);
		expect(upcoming).toEqual([]);
		expect(past.map((b) => b.id)).toEqual(["e"]);
	});

	it("puts terminal statuses (Completed/Cancelled) in past regardless of date", () => {
		const completed = booking({ id: "done", status: "Completed", slot: "2026-06-04T10:00:00Z" });
		const cancelledFuture = booking({ id: "cx", status: "Cancelled", slot: "2026-06-20T10:00:00Z" });
		const { upcoming, past } = partitionBookings([completed, cancelledFuture], NOW);
		expect(upcoming).toEqual([]);
		expect(past.map((b) => b.id).sort()).toEqual(["cx", "done"]);
	});

	it("sorts upcoming soonest-first and past most-recent-first", () => {
		const soon = booking({ id: "soon", status: "Confirmed", slot: "2026-06-09T10:00:00Z" });
		const later = booking({ id: "later", status: "Confirmed", slot: "2026-06-15T10:00:00Z" });
		const oldDone = booking({ id: "old", status: "Completed", slot: "2026-06-01T10:00:00Z" });
		const recentDone = booking({ id: "recent", status: "Completed", slot: "2026-06-06T10:00:00Z" });
		const { upcoming, past } = partitionBookings([later, soon, oldDone, recentDone], NOW);
		expect(upcoming.map((b) => b.id)).toEqual(["soon", "later"]);
		expect(past.map((b) => b.id)).toEqual(["recent", "old"]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd sites/marketing-site && bunx vitest run src/app/account/_components/__tests__/partition-bookings.test.ts`
Expected: FAIL — cannot resolve `../partition-bookings`.

- [ ] **Step 3: Implement the helper**

Create `sites/marketing-site/src/app/account/_components/partition-bookings.ts`:

```ts
import type { Booking } from "@repo/api-client";

export interface PartitionedBookings {
	upcoming: Booking[];
	past: Booking[];
}

/**
 * Split bookings into Upcoming (still attendable) and Past.
 *
 * - Upcoming = status Pending|Confirmed AND slot in the future ("will I still attend this?").
 * - Past = everything else: terminal statuses (Completed/Cancelled) OR an elapsed slot
 *   regardless of status (so a Confirmed-but-elapsed booking drops to Past).
 *
 * Upcoming is sorted soonest-first; Past most-recent-first.
 */
export function partitionBookings(
	bookings: Booking[],
	now: Date = new Date(),
): PartitionedBookings {
	const nowMs = now.getTime();
	const upcoming: Booking[] = [];
	const past: Booking[] = [];

	for (const b of bookings) {
		const isActive = b.status === "Pending" || b.status === "Confirmed";
		const isFuture = new Date(b.slot).getTime() >= nowMs;
		if (isActive && isFuture) upcoming.push(b);
		else past.push(b);
	}

	upcoming.sort(
		(a, b) => new Date(a.slot).getTime() - new Date(b.slot).getTime(),
	);
	past.sort((a, b) => new Date(b.slot).getTime() - new Date(a.slot).getTime());

	return { upcoming, past };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sites/marketing-site && bunx vitest run src/app/account/_components/__tests__/partition-bookings.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add sites/marketing-site/src/app/account/_components/partition-bookings.ts sites/marketing-site/src/app/account/_components/__tests__/partition-bookings.test.ts
git commit -m "feat(marketing-site): add partitionBookings helper (upcoming/past rule)"
```

---

## Task 2: `BookingsSection` component

**Files:**
- Create: `sites/marketing-site/src/app/account/_components/BookingsSection.tsx`
- Test: `sites/marketing-site/src/app/account/_components/__tests__/BookingsSection.test.tsx`

This component owns the bookings query + cancel + review + the new Upcoming/Past tabs. It is self-contained (uses `useAuth` + `useQueryClient` internally). The row markup (link/price/cancel/status badge/review form) is preserved from the current `page.tsx`.

- [ ] **Step 1: Write the failing test**

Create `sites/marketing-site/src/app/account/_components/__tests__/BookingsSection.test.tsx`:

```tsx
import type { Booking } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.fn();
vi.mock("@/lib/api", () => ({
	api: { bookings: { list: () => list(), cancel: vi.fn() }, reviews: { create: vi.fn() } },
}));
vi.mock("@/hooks/useAuth", () => ({
	useAuth: () => ({ user: { id: "u1", email: null, name: "Sara", role: "user" } }),
}));

import { BookingsSection } from "../BookingsSection";

function booking(over: Partial<Booking>): Booking {
	return {
		id: "b", userId: "u1", serviceId: "s1", branchId: "br1", venueId: "v1",
		staffId: null, slot: "2027-01-01T10:00:00Z", status: "Confirmed",
		price: 100, discount: 0, couponCode: null,
		createdAt: "2026-01-01T00:00:00Z", updatedAt: null, ...over,
	};
}

function renderSection() {
	const qc = new QueryClient();
	return render(
		<QueryClientProvider client={qc}>
			<BookingsSection />
		</QueryClientProvider>,
	);
}

beforeEach(() => list.mockReset());

describe("BookingsSection tabs", () => {
	it("shows upcoming (active + future) by default and past after toggling", async () => {
		list.mockResolvedValue({
			data: [
				booking({ id: "future", status: "Confirmed", slot: "2027-01-01T10:00:00Z" }),
				booking({ id: "done", status: "Completed", slot: "2020-01-01T10:00:00Z" }),
			],
		});
		renderSection();

		// Upcoming tab (default): the future booking's price row is visible, the completed one isn't.
		await waitFor(() => expect(screen.getByText("Upcoming")).toBeInTheDocument());
		await waitFor(() => expect(screen.getAllByText(/৳100/).length).toBe(1));

		// Toggle to Past → the completed booking appears.
		await userEvent.click(screen.getByText("Past"));
		await waitFor(() => expect(screen.getAllByText(/৳100/).length).toBe(1));
	});

	it("shows an empty-state message when a tab has no bookings", async () => {
		list.mockResolvedValue({ data: [] });
		renderSection();
		await waitFor(() =>
			expect(screen.getByText("You have no upcoming bookings.")).toBeInTheDocument(),
		);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd sites/marketing-site && bunx vitest run src/app/account/_components/__tests__/BookingsSection.test.tsx`
Expected: FAIL — cannot resolve `../BookingsSection`.

- [ ] **Step 3: Implement the component**

Create `sites/marketing-site/src/app/account/_components/BookingsSection.tsx`:

```tsx
"use client";
import type { Booking } from "@repo/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Star, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { partitionBookings } from "./partition-bookings";

type Tab = "upcoming" | "past";

export function BookingsSection() {
	const qc = useQueryClient();
	const { user } = useAuth();
	const [tab, setTab] = useState<Tab>("upcoming");
	const [reviewingId, setReviewingId] = useState<string | null>(null);
	const [reviewRating, setReviewRating] = useState(0);
	const [reviewText, setReviewText] = useState("");

	const { data: bookingsResult } = useQuery({
		queryKey: ["my-bookings"],
		queryFn: () => api.bookings.list(),
		enabled: !!user,
		staleTime: 60_000,
	});

	const cancelMut = useMutation({
		mutationFn: (id: string) => api.bookings.cancel(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["my-bookings"] }),
	});

	const reviewMut = useMutation({
		mutationFn: (b: Booking) =>
			api.reviews.create({
				venueId: b.venueId,
				serviceId: b.serviceId,
				bookingId: b.id,
				rating: reviewRating,
				text: reviewText,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["my-bookings"] });
			setReviewingId(null);
			setReviewRating(0);
			setReviewText("");
		},
	});

	const bookings: Booking[] = bookingsResult?.data ?? [];
	const { upcoming, past } = partitionBookings(bookings);
	const shown = tab === "upcoming" ? upcoming : past;

	return (
		<div className="bg-surface rounded-xl border border-line overflow-hidden">
			<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
				<Calendar size={18} className="text-green-700" />
				<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
					My bookings
				</h2>
				<div className="ml-auto flex items-center gap-1">
					{(["upcoming", "past"] as const).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTab(t)}
							className={[
								"font-sans text-xs font-semibold px-3 py-1 rounded-full cursor-pointer border",
								tab === t
									? "bg-green-700 text-white border-green-700"
									: "bg-surface text-ink-500 border-line hover:text-ink-900",
							].join(" ")}
						>
							{t === "upcoming" ? "Upcoming" : "Past"}
						</button>
					))}
				</div>
			</div>

			{shown.length === 0 ? (
				<div className="px-6 py-12 text-center">
					<div className="text-4xl mb-4">📅</div>
					<p className="font-sans text-ink-500 text-sm m-0 mb-4">
						{tab === "upcoming"
							? "You have no upcoming bookings."
							: "You have no past bookings."}
					</p>
					<Link
						href="/"
						className="no-underline font-sans text-sm font-semibold text-green-700"
					>
						Find a venue →
					</Link>
				</div>
			) : (
				<div>
					{shown.map((b, i) => (
						<div
							key={b.id}
							className={[
								"px-6 py-4",
								i ? "border-t border-line-soft" : "",
							].join(" ")}
						>
							<div className="flex items-center justify-between gap-4">
								<div>
									<Link
										href={`/bookings/${b.id}`}
										className="font-sans text-sm font-semibold text-ink-900 hover:text-green-700 no-underline"
									>
										{new Date(b.slot).toLocaleString("en-BD", {
											dateStyle: "medium",
											timeStyle: "short",
										})}
									</Link>
									<div className="font-sans text-xs text-ink-500 mt-0.5">
										৳{b.price}
										{b.discount > 0 && (
											<span className="ml-1 text-success-fg">
												(-৳{b.discount})
											</span>
										)}
									</div>
								</div>
								<div className="flex items-center gap-3">
									{(b.status === "Pending" || b.status === "Confirmed") && (
										<button
											type="button"
											onClick={() => cancelMut.mutate(b.id)}
											disabled={cancelMut.isPending}
											className="font-sans text-xs font-medium text-danger-fg bg-danger-bg border border-danger-fg/20 rounded-md px-2.5 py-1 cursor-pointer hover:bg-danger-fg/10 disabled:opacity-50"
										>
											Cancel
										</button>
									)}
									<span
										className={[
											"text-xs font-semibold px-2.5 py-0.5 rounded-full",
											b.status === "Confirmed"
												? "bg-success-bg text-success-fg"
												: b.status === "Cancelled"
													? "bg-danger-bg text-danger-fg"
													: b.status === "Completed"
														? "bg-green-100 text-green-800"
														: "bg-surface border border-line text-ink-500",
										].join(" ")}
									>
										{b.status}
									</span>
								</div>
							</div>

							{b.status === "Completed" && reviewingId !== b.id && (
								<button
									type="button"
									onClick={() => {
										setReviewingId(b.id);
										setReviewRating(0);
										setReviewText("");
									}}
									className="mt-2 font-sans text-xs font-medium text-green-700 bg-transparent border-none cursor-pointer p-0 flex items-center gap-1"
								>
									<Star size={12} />
									Leave a review
								</button>
							)}

							{reviewingId === b.id && (
								<div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-4">
									<div className="flex items-center justify-between mb-3">
										<span className="font-sans text-sm font-semibold text-ink-900">
											Rate your experience
										</span>
										<button
											type="button"
											onClick={() => setReviewingId(null)}
											className="text-ink-400 bg-transparent border-none cursor-pointer p-0"
										>
											<X size={16} />
										</button>
									</div>
									<div className="flex gap-1 mb-3">
										{[1, 2, 3, 4, 5].map((n) => (
											<button
												key={n}
												type="button"
												onClick={() => setReviewRating(n)}
												className="bg-transparent border-none cursor-pointer p-0"
											>
												<Star
													size={24}
													className={
														n <= reviewRating
															? "fill-yellow-400 text-yellow-400"
															: "text-ink-300"
													}
												/>
											</button>
										))}
									</div>
									<textarea
										rows={3}
										value={reviewText}
										onChange={(e) => setReviewText(e.target.value)}
										placeholder="Tell us about your visit…"
										className="w-full px-3 py-2 border border-line rounded-md font-sans text-sm text-ink-900 bg-surface resize-none outline-none focus:border-green-500"
									/>
									{reviewMut.isError && (
										<p className="font-sans text-xs text-danger-fg mt-1 m-0">
											{(reviewMut.error as Error).message}
										</p>
									)}
									<button
										type="button"
										onClick={() => reviewMut.mutate(b)}
										disabled={reviewRating === 0 || reviewMut.isPending}
										className="mt-2 w-full font-sans text-sm font-semibold text-white bg-green-700 rounded-md px-4 py-2 cursor-pointer border-none hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{reviewMut.isPending ? "Submitting…" : "Submit review"}
									</button>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sites/marketing-site && bunx vitest run src/app/account/_components/__tests__/BookingsSection.test.tsx`
Expected: PASS (2 tests). If `@testing-library/user-event` is unavailable, it is already a devDependency of this package (used elsewhere) — no install needed.

- [ ] **Step 5: Commit**

```bash
git add sites/marketing-site/src/app/account/_components/BookingsSection.tsx sites/marketing-site/src/app/account/_components/__tests__/BookingsSection.test.tsx
git commit -m "feat(marketing-site): BookingsSection with Upcoming/Past tabs"
```

---

## Task 3: `ProfileCard` component (phone + member-since)

**Files:**
- Create: `sites/marketing-site/src/app/account/_components/ProfileCard.tsx`
- Test: `sites/marketing-site/src/app/account/_components/__tests__/ProfileCard.test.tsx`

Self-contained profile card. Adds **phone editing** (inline, mirroring the name edit; saved via `users.update`, surfacing the phone-uniqueness error) and **"member since"** (from the full `User.createdAt`). The full record comes from `users.get(user.id)` because `auth.me()`/`AuthUser` only has `id/email/name/role`.

- [ ] **Step 1: Write the failing test**

Create `sites/marketing-site/src/app/account/_components/__tests__/ProfileCard.test.tsx`:

```tsx
import type { User } from "@repo/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const update = vi.fn();
vi.mock("@/lib/api", () => ({
	api: {
		users: { get: (id: string) => get(id), update: (id: string, body: unknown) => update(id, body), delete: vi.fn() },
		auth: { logout: vi.fn() },
	},
}));
vi.mock("@/hooks/useAuth", () => ({
	useAuth: () => ({
		user: { id: "u1", email: "sara@example.com", name: "Sara Khan", role: "user" },
		signOut: vi.fn(),
	}),
}));

import { ProfileCard } from "../ProfileCard";

const FULL: User = {
	id: "u1", email: "sara@example.com", phone: "01700000000", name: "Sara Khan",
	role: "user", googleId: null, createdAt: "2026-01-15T00:00:00Z", updatedAt: null,
};

function renderCard() {
	const qc = new QueryClient();
	return render(
		<QueryClientProvider client={qc}>
			<ProfileCard />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	get.mockReset();
	update.mockReset();
});

describe("ProfileCard", () => {
	it("shows the phone and member-since from the full user record", async () => {
		get.mockResolvedValue({ data: FULL });
		renderCard();
		await waitFor(() => expect(screen.getByText("01700000000")).toBeInTheDocument());
		// "member since" derives from createdAt (Jan 2026).
		await waitFor(() => expect(screen.getByText(/Member since/i)).toBeInTheDocument());
	});

	it("prompts to add a phone when none is set", async () => {
		get.mockResolvedValue({ data: { ...FULL, phone: null } });
		renderCard();
		await waitFor(() => expect(screen.getByText(/Add phone/i)).toBeInTheDocument());
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd sites/marketing-site && bunx vitest run src/app/account/_components/__tests__/ProfileCard.test.tsx`
Expected: FAIL — cannot resolve `../ProfileCard`.

- [ ] **Step 3: Implement the component**

Create `sites/marketing-site/src/app/account/_components/ProfileCard.tsx`:

```tsx
"use client";
import type { User } from "@repo/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LogOut, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export function ProfileCard() {
	const qc = useQueryClient();
	const { user, signOut } = useAuth();
	const [editingName, setEditingName] = useState(false);
	const [editName, setEditName] = useState("");
	const [editingPhone, setEditingPhone] = useState(false);
	const [editPhone, setEditPhone] = useState("");

	const userId = user?.id;

	// Full record (phone + createdAt) — auth.me()/AuthUser only has id/email/name/role.
	const { data: detail } = useQuery({
		queryKey: ["user", "me", userId],
		// biome-ignore lint/style/noNonNullAssertion: enabled only when userId is set
		queryFn: () => api.users.get(userId!),
		enabled: !!userId,
		staleTime: 60_000,
	});
	const fullUser: User | undefined = detail?.data;

	const updateNameMut = useMutation({
		// biome-ignore lint/style/noNonNullAssertion: only invoked from authenticated UI
		mutationFn: (name: string) => api.users.update(userId!, { name }),
		onSuccess: (_d, name) => {
			if (user) useAuthStore.getState().setUser({ ...user, name });
			qc.invalidateQueries({ queryKey: ["user", "me", userId] });
			setEditingName(false);
		},
	});

	const updatePhoneMut = useMutation({
		// biome-ignore lint/style/noNonNullAssertion: only invoked from authenticated UI
		mutationFn: (phone: string) => api.users.update(userId!, { phone }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["user", "me", userId] });
			setEditingPhone(false);
		},
	});

	const deleteAccountMut = useMutation({
		// biome-ignore lint/style/noNonNullAssertion: only invoked from authenticated UI
		mutationFn: () => api.users.delete(userId!),
		onSuccess: async () => {
			try {
				await api.auth.logout();
			} catch {
				/* ignore */
			}
			useAuthStore.getState().signOut();
			qc.clear();
			if (typeof window !== "undefined") window.location.href = "/";
		},
	});

	if (!user) return null;

	const memberSince = fullUser?.createdAt
		? new Date(fullUser.createdAt).toLocaleDateString("en-BD", {
				month: "long",
				year: "numeric",
			})
		: null;

	return (
		<div className="bg-surface rounded-xl border border-line p-6 md:p-8 mb-6 flex items-start justify-between gap-4">
			<div className="flex items-center gap-4">
				<div className="w-14 h-14 rounded-full bg-green-900 flex items-center justify-center shrink-0">
					<span className="font-serif text-2xl font-medium text-white">
						{user.name.charAt(0).toUpperCase()}
					</span>
				</div>
				<div>
					{editingName ? (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								if (editName.trim()) updateNameMut.mutate(editName.trim());
							}}
							className="flex items-center gap-2"
						>
							<input
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								className="font-serif text-xl border-b border-green-500 outline-none bg-transparent text-ink-900 w-48"
							/>
							<button
								type="submit"
								disabled={updateNameMut.isPending}
								className="text-green-700 bg-transparent border-none cursor-pointer p-0"
							>
								<Check size={17} />
							</button>
							<button
								type="button"
								onClick={() => setEditingName(false)}
								className="text-ink-400 bg-transparent border-none cursor-pointer p-0"
							>
								<X size={17} />
							</button>
						</form>
					) : (
						<div className="flex items-center gap-2">
							<div className="font-serif text-2xl font-medium text-ink-900">
								{user.name}
							</div>
							<button
								type="button"
								onClick={() => {
									setEditName(user.name);
									setEditingName(true);
								}}
								className="text-ink-400 hover:text-ink-700 bg-transparent border-none cursor-pointer p-0"
								aria-label="Edit name"
							>
								<Pencil size={14} />
							</button>
						</div>
					)}
					{user.email && (
						<div className="font-sans text-sm text-ink-500 mt-0.5">
							{user.email}
						</div>
					)}

					{/* Phone (new) */}
					{editingPhone ? (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								updatePhoneMut.mutate(editPhone.trim());
							}}
							className="flex items-center gap-2 mt-1"
						>
							<input
								value={editPhone}
								onChange={(e) => setEditPhone(e.target.value)}
								placeholder="01XXXXXXXXX"
								className="font-sans text-sm border-b border-green-500 outline-none bg-transparent text-ink-900 w-40"
							/>
							<button
								type="submit"
								disabled={updatePhoneMut.isPending}
								className="text-green-700 bg-transparent border-none cursor-pointer p-0"
							>
								<Check size={15} />
							</button>
							<button
								type="button"
								onClick={() => setEditingPhone(false)}
								className="text-ink-400 bg-transparent border-none cursor-pointer p-0"
							>
								<X size={15} />
							</button>
						</form>
					) : (
						<div className="flex items-center gap-2 mt-1">
							<span className="font-sans text-sm text-ink-500">
								{fullUser?.phone ?? "Add phone"}
							</span>
							<button
								type="button"
								onClick={() => {
									setEditPhone(fullUser?.phone ?? "");
									setEditingPhone(true);
								}}
								className="text-ink-400 hover:text-ink-700 bg-transparent border-none cursor-pointer p-0"
								aria-label="Edit phone"
							>
								<Pencil size={12} />
							</button>
						</div>
					)}
					{updatePhoneMut.isError && (
						<p className="font-sans text-xs text-danger-fg mt-1 m-0">
							{(updatePhoneMut.error as Error).message}
						</p>
					)}

					{/* Member since (new) */}
					{memberSince && (
						<div className="font-sans text-xs text-ink-400 mt-1.5">
							Member since {memberSince}
						</div>
					)}
				</div>
			</div>
			<div className="flex items-center gap-4">
				<button
					type="button"
					onClick={() => {
						signOut();
					}}
					className="flex items-center gap-1.5 font-sans text-sm font-medium text-ink-500 hover:text-ink-900 bg-transparent border-none cursor-pointer p-0"
				>
					<LogOut size={16} />
					Sign out
				</button>
				<button
					type="button"
					disabled={deleteAccountMut.isPending}
					onClick={() => {
						if (
							!window.confirm(
								"Permanently delete your account and all data? This cannot be undone.",
							)
						)
							return;
						deleteAccountMut.mutate();
					}}
					className="flex items-center gap-1.5 font-sans text-xs font-medium text-danger-fg hover:opacity-70 bg-transparent border-none cursor-pointer p-0 disabled:opacity-50"
				>
					<Trash2 size={13} />
					{deleteAccountMut.isPending ? "Deleting…" : "Delete account"}
				</button>
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sites/marketing-site && bunx vitest run src/app/account/_components/__tests__/ProfileCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add sites/marketing-site/src/app/account/_components/ProfileCard.tsx sites/marketing-site/src/app/account/_components/__tests__/ProfileCard.test.tsx
git commit -m "feat(marketing-site): ProfileCard with phone editing + member-since"
```

---

## Task 4: Slim `account/page.tsx` to compose the components

**Files:**
- Rewrite: `sites/marketing-site/src/app/account/page.tsx`

Replace the whole file. The profile and bookings blocks (and their state/mutations) move out to the components built in Tasks 2–3; rewards / sessions / notifications / saved venues stay inline and unchanged.

- [ ] **Step 1: Replace the entire contents of `sites/marketing-site/src/app/account/page.tsx` with**

```tsx
"use client";
import type {
	AppNotification,
	Favourite,
	RewardBalance,
	RewardTransaction,
	SessionInfo,
} from "@repo/api-client";
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Bell, Coins, Gift, Heart, Shield, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/hooks/useAuth";
import {
	useMarkAllNotificationsRead,
	useMarkNotificationRead,
	useNotifications,
} from "@/hooks/useNotifications";
import { api } from "@/lib/api";
import { BookingsSection } from "./_components/BookingsSection";
import { ProfileCard } from "./_components/ProfileCard";

export default function AccountPage() {
	const router = useRouter();
	const qc = useQueryClient();
	const { user, isLoading, status } = useAuth();

	const [redeemPoints, setRedeemPoints] = useState("");
	const [showRedeem, setShowRedeem] = useState(false);

	useEffect(() => {
		if (status === "unauthenticated") {
			router.replace(`/login?next=/account`);
		}
	}, [status, router]);

	const { data: rewardsBalance } = useQuery({
		queryKey: ["rewards", "balance"],
		queryFn: () => api.rewards.balance(),
		enabled: !!user,
		staleTime: 60_000,
	});

	const { data: rewardsHistory } = useQuery({
		queryKey: ["rewards", "history"],
		queryFn: () => api.rewards.history({ limit: 10 }),
		enabled: !!user,
		staleTime: 60_000,
	});

	const { data: sessionsData } = useQuery({
		queryKey: ["auth", "sessions"],
		queryFn: () => api.auth.listSessions(),
		enabled: !!user,
		staleTime: 60_000,
	});

	const revokeMut = useMutation({
		mutationFn: (id: string) => api.auth.revokeSession(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["auth", "sessions"] }),
	});

	const redeemMut = useMutation({
		mutationFn: (points: number) => api.rewards.redeem({ points }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["rewards", "balance"] });
			qc.invalidateQueries({ queryKey: ["rewards", "history"] });
			setShowRedeem(false);
			setRedeemPoints("");
		},
	});

	const notifsQuery = useNotifications(!!user);
	const markReadMut = useMarkNotificationRead();
	const markAllMut = useMarkAllNotificationsRead();

	const { data: favouritesData } = useQuery({
		queryKey: ["favourites"],
		queryFn: () => api.favourites.list(),
		enabled: !!user,
		staleTime: 60_000,
	});

	const balance =
		(rewardsBalance as RewardBalance | undefined)?.balance ?? null;
	const transactions: RewardTransaction[] = rewardsHistory?.data ?? [];
	const sessions: SessionInfo[] =
		(sessionsData as SessionInfo[] | undefined) ?? [];
	const notifications: AppNotification[] = notifsQuery.data ?? [];
	const unreadCount = notifications.filter((n) => !n.readAt).length;
	const favourites: Favourite[] = favouritesData ?? [];

	const venueNameResults = useQueries({
		queries: favourites.map((fav) => ({
			queryKey: ["venue", fav.venueId],
			queryFn: () => api.venues.get(fav.venueId),
			staleTime: 300_000,
		})),
	});
	const venueNames: Record<string, string> = {};
	for (let i = 0; i < favourites.length; i++) {
		const name = venueNameResults[i]?.data?.data?.name;
		if (name) venueNames[favourites[i].venueId] = name;
	}

	if (isLoading) {
		return (
			<>
				<Nav />
				<main className="max-w-[800px] mx-auto px-4 md:px-8 py-12">
					<div className="h-32 rounded-xl bg-line animate-pulse" />
				</main>
				<Footer />
			</>
		);
	}

	if (!user) {
		return (
			<>
				<Nav />
				<main className="max-w-[800px] mx-auto px-4 md:px-8 py-12 text-center">
					<p className="font-sans text-ink-500 text-sm">
						Please{" "}
						<Link href="/login" className="text-green-700">
							log in
						</Link>{" "}
						to view your account.
					</p>
				</main>
				<Footer />
			</>
		);
	}

	return (
		<>
			<Nav />
			<main className="max-w-[800px] mx-auto px-4 md:px-8 py-10 md:py-14">
				<ProfileCard />

				{/* Rewards card */}
				{balance !== null && (
					<div className="bg-surface rounded-xl border border-line overflow-hidden mb-6">
						<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
							<Gift size={18} className="text-green-700" />
							<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
								Rewards
							</h2>
							<span className="ml-auto font-sans text-sm font-semibold text-green-700">
								{balance} pts
							</span>
						</div>
						{transactions.length > 0 && (
							<div>
								{transactions.map((tx, i) => (
									<div
										key={tx.id}
										className={[
											"px-6 py-3 flex items-center justify-between gap-4",
											i ? "border-t border-line-soft" : "",
										].join(" ")}
									>
										<div className="font-sans text-sm text-ink-700">
											{tx.description}
										</div>
										<span
											className={[
												"font-sans text-sm font-semibold",
												tx.type === "credit"
													? "text-success-fg"
													: "text-danger-fg",
											].join(" ")}
										>
											{tx.type === "credit" ? "+" : "-"}
											{tx.points} pts
										</span>
									</div>
								))}
							</div>
						)}
						{balance !== null && balance > 0 && (
							<div className="px-6 py-4 border-t border-line">
								{!showRedeem ? (
									<button
										type="button"
										onClick={() => setShowRedeem(true)}
										className="flex items-center gap-1.5 font-sans text-sm font-semibold text-green-700 bg-transparent border-none cursor-pointer p-0"
									>
										<Coins size={15} />
										Redeem points
									</button>
								) : (
									<div className="flex items-center gap-2">
										<input
											type="number"
											min={1}
											max={balance}
											value={redeemPoints}
											onChange={(e) => setRedeemPoints(e.target.value)}
											placeholder={`Max ${balance}`}
											className="w-32 px-3 py-1.5 border border-line rounded-md font-sans text-sm text-ink-900 bg-surface outline-none focus:border-green-600"
										/>
										<button
											type="button"
											onClick={() => {
												const pts = Number(redeemPoints);
												if (pts > 0 && pts <= balance) redeemMut.mutate(pts);
											}}
											disabled={redeemMut.isPending || !redeemPoints}
											className="font-sans text-sm font-semibold text-white bg-green-700 rounded-md px-3 py-1.5 cursor-pointer border-none hover:bg-green-800 disabled:opacity-50"
										>
											{redeemMut.isPending ? "…" : "Redeem"}
										</button>
										<button
											type="button"
											onClick={() => {
												setShowRedeem(false);
												setRedeemPoints("");
											}}
											className="text-ink-400 bg-transparent border-none cursor-pointer p-0"
										>
											<X size={16} />
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				)}

				{/* Sessions */}
				{sessions.length > 0 && (
					<div className="bg-surface rounded-xl border border-line overflow-hidden mb-6">
						<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
							<Shield size={18} className="text-green-700" />
							<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
								Active sessions
							</h2>
						</div>
						<div>
							{sessions.map((s, i) => (
								<div
									key={s.id}
									className={[
										"px-6 py-3 flex items-center justify-between gap-4",
										i ? "border-t border-line-soft" : "",
									].join(" ")}
								>
									<div>
										<div className="font-sans text-sm text-ink-700 truncate max-w-xs">
											{s.deviceName ?? s.deviceId ?? "Unknown device"}
										</div>
										<div className="font-sans text-xs text-ink-400 mt-0.5">
											Last used{" "}
											{new Date(s.lastUsedAt).toLocaleDateString("en-BD", {
												dateStyle: "medium",
											})}
										</div>
									</div>
									<button
										type="button"
										onClick={() => revokeMut.mutate(s.id)}
										disabled={revokeMut.isPending}
										className="font-sans text-xs font-medium text-danger-fg bg-danger-bg border border-danger-fg/20 rounded-md px-2.5 py-1 cursor-pointer hover:bg-danger-fg/10 disabled:opacity-50"
									>
										Revoke
									</button>
								</div>
							))}
						</div>
					</div>
				)}

				<BookingsSection />

				{/* Notifications */}
				{notifications.length > 0 && (
					<div className="bg-surface rounded-xl border border-line overflow-hidden mt-6">
						<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
							<Bell size={18} className="text-green-700" />
							<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
								Notifications
								{unreadCount > 0 && (
									<span className="ml-2 font-sans text-xs font-bold text-green-700">
										({unreadCount} new)
									</span>
								)}
							</h2>
							{unreadCount > 0 && (
								<button
									type="button"
									onClick={() => markAllMut.mutate()}
									className="ml-auto font-sans text-xs font-medium text-ink-500 hover:text-ink-900 bg-transparent border-none cursor-pointer p-0"
								>
									Mark all read
								</button>
							)}
						</div>
						<div>
							{notifications.slice(0, 10).map((n, i) => (
								<button
									key={n.id}
									type="button"
									onClick={() => {
										if (!n.readAt) markReadMut.mutate(n.id);
									}}
									className={[
										"w-full text-left px-6 py-3 flex flex-col gap-0.5 border-none cursor-pointer",
										i ? "border-t border-line-soft" : "",
										n.readAt ? "bg-transparent" : "bg-green-50",
									].join(" ")}
								>
									<div className="font-sans text-sm font-semibold text-ink-900">
										{n.title}
									</div>
									<div className="font-sans text-xs text-ink-500 line-clamp-2">
										{n.body}
									</div>
									<div className="font-sans text-xs text-ink-400 mt-0.5">
										{new Date(n.createdAt).toLocaleDateString("en-BD", {
											day: "numeric",
											month: "short",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</div>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Saved venues */}
				{favourites.length > 0 && (
					<div className="bg-surface rounded-xl border border-line overflow-hidden mt-6">
						<div className="flex items-center gap-2.5 px-6 py-4 border-b border-line">
							<Heart size={18} className="text-green-700" />
							<h2 className="m-0 font-serif font-medium text-xl text-ink-900">
								Saved venues
							</h2>
						</div>
						<div className="px-6 py-4 flex flex-wrap gap-3">
							{favourites.map((fav) => (
								<Link
									key={fav.id}
									href={`/venues/${fav.venueId}`}
									className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-line bg-paper text-sm font-medium text-ink-800 no-underline hover:border-green-500 transition-colors"
								>
									<Heart size={13} className="text-green-600 fill-green-600" />
									{venueNames[fav.venueId] ?? "View venue"}
								</Link>
							))}
						</div>
					</div>
				)}
			</main>
			<Footer />
		</>
	);
}
```

- [ ] **Step 2: Type-check**

Run: `cd sites/marketing-site && bunx tsc --noEmit`
Expected: no errors. (If anything is reported as unused — e.g. an icon import — remove it. The import list above is already pruned to exactly what the slimmed page uses.)

- [ ] **Step 3: Full suite**

Run: `bun run --filter @repo/marketing-site test`
Expected: PASS — all suites green (Phase 0's 5 suites + the 3 new Phase 1 suites).

- [ ] **Step 4: Commit**

```bash
git add sites/marketing-site/src/app/account/page.tsx
git commit -m "refactor(marketing-site): account page composes ProfileCard + BookingsSection"
```

---

## Task 5: Verification + docs

**Files:**
- Modify: `sites/marketing-site/AGENTS.md`

- [ ] **Step 1: Document the account page structure**

In `sites/marketing-site/AGENTS.md`, under the `## Layout` section, the `account/` line currently reads:
```
  account/                # Profile, sessions, notifications, bookings list
```
Replace it with:
```
  account/                # Profile, sessions, notifications, bookings (composes _components/)
  account/_components/    # ProfileCard (name/phone/member-since), BookingsSection (upcoming/past), partition-bookings
```

- [ ] **Step 2: Lint**

Run: `bun run --filter @repo/marketing-site lint`
Expected: PASS. Fix only issues introduced by Phase 1 files (e.g. import ordering, formatting). Leave pre-existing `info`-level items in untouched files.

- [ ] **Step 3: Full test suite**

Run: `bun run --filter @repo/marketing-site test`
Expected: PASS — 8 test files (5 Phase 0 + partition-bookings + BookingsSection + ProfileCard).

- [ ] **Step 4: Build**

Run: `bun run build`
Expected: PASS — the monorepo build completes with no type errors.

- [ ] **Step 5: Manual smoke test**

Run: `bun run marketing-site:dev` → open `http://localhost:3000/account` (sign in first).

Verify:
1. **Profile** shows name (editable), email, **phone** (editable; "Add phone" when empty), and **"Member since {Month YYYY}"**.
2. **Editing phone** saves and persists across reload; entering a phone already used by another account surfaces the API error inline (not a silent failure).
3. **Bookings** shows an **Upcoming / Past** toggle. Upcoming lists Pending/Confirmed future bookings (soonest-first); Past lists completed/cancelled/elapsed (most-recent-first) and is where the "Leave a review" CTA appears on Completed bookings.
4. Cancel (on an upcoming booking) and review submission still work.
5. Rewards, Active sessions, Notifications, Saved venues render unchanged.

- [ ] **Step 6: Commit**

```bash
git add sites/marketing-site/AGENTS.md
git commit -m "docs(marketing-site): document account/_components structure"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** phone editing + member-since (Task 3), Upcoming/Past hybrid partition + sort + client-side (Tasks 1–2), phone-uniqueness error surfaced (Task 3 `updatePhoneMut.isError`), component extraction under `_components/` (Tasks 2–4). No backend/docs-API changes (Phase 1 is frontend-only); AGENTS layout note updated (Task 5).
- **Type consistency:** `partitionBookings(bookings: Booking[], now?: Date): { upcoming: Booking[]; past: Booking[] }` used identically in Tasks 1–2. `api.users.get(id) → { data: User }`, `api.users.update(id, { name } | { phone })`, `useAuthStore.getState().setUser(AuthUser)` consistent with Phase 0.
- **No regression:** the slimmed `page.tsx` keeps the `isLoading` / `!user` guards and the `status` redirect from Phase 0; rewards/sessions/notifications/favourites JSX is byte-identical to the pre-extraction version.
- **Not in this phase:** reviews-I-wrote (Phase 2), profile photo (Phase 3). Do not add them.
```
