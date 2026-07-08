# Phase 3 — Profile Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated customer upload a profile photo (avatar) that shows on the account page and in the nav, stored in R2.

**Architecture:** A nullable `photoUrl` column on `users` (migration 0011) → a self-only `POST /api/v1/users/:id/photo` that validates + stores the image in R2 (random key, deletes the previous object) and sets `photoUrl` → `photoUrl` surfaced on the DB-sourced `/me` response (kept out of the JWT) and on `User` → api-client `users.uploadPhoto` + `photoUrl` on the `User`/`AuthUser` types → avatar UI in `ProfileCard` and `Nav`.

**Tech Stack:** Drizzle/D1 + R2 (Cloudflare), Hono, Next.js 16 + React 19 + TanStack Query + zustand, Vitest.

**Spec:** [2026-06-08-account-auth-features-design.md](../specs/2026-06-08-account-auth-features-design.md) (Phase 3). Builds on Phases 0–2 (merged).

---

## Canonical verification commands (Turbo-routed Bun monorepo)
- **API single test file:** `cd workers/api && bunx vitest run <path>` · **API full:** `cd workers/api && bunx vitest run`
- **web single:** `cd sites/marketing-site && bunx vitest run <path>` · **web full:** `cd sites/marketing-site && bunx vitest run`
- **Lint (web):** `bun run --filter @repo/marketing-site lint` · **Build:** `bun run build` (from worktree root)
- `cd workers/api && bunx tsc --noEmit` has **pre-existing** drizzle-dual-version errors in test files — not a regression signal. The API gate is the vitest suite + build.

## Grilled decisions baked in (ADR-level)
- **Random key per upload + best-effort delete of the previous object** (an avatar is single-valued — avoid R2 orphans; random keys avoid stale CDN). The old key is derived from the stored URL via `new URL(oldUrl).pathname.slice(1)`.
- **Validate** content-type ∈ {`image/jpeg`,`image/png`,`image/webp`} and size ≤ 5 MB. No server-side resize.
- **`photoUrl` stays out of the JWT** — `c.var.user` (from `SessionTokens.verify`) is unchanged; the value is DB-sourced via `/me`.
- **Self-only** upload: `POST /users/:id/photo` on the existing `selfApp`, guarded `if (c.var.user.id !== id) throw ForbiddenError` (matches get/update/delete).

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/database/schema/users.schema.ts` | **Modify.** Add `photoUrl: text()`. |
| `workers/api/src/database/migrations/0011_*.sql` (+ meta) | **Create (generated).** `bun run db:generate`. |
| `workers/api/src/modules/users/users.service.ts` | **Modify.** Constructor takes `storage`; add `uploadPhoto(userId, file)`. |
| `workers/api/src/modules/users/users.schemas.ts` | **Modify.** Add `photoUrl` to `UserSchema`. |
| `workers/api/src/modules/users/users.routes.ts` | **Modify.** Add the `uploadPhotoRoute` definition (this module keeps route defs separate from handlers). |
| `workers/api/src/modules/users/index.ts` | **Modify.** Register `POST /:id/photo` handler on `selfApp`; installer passes `storage`. |
| `workers/api/src/modules/auth/auth.schemas.ts` | **Modify.** Add optional `photoUrl` to `AuthUserSchema`. |
| `workers/api/src/modules/auth/index.ts` | **Modify.** `/me` handler includes `photoUrl`. |
| `workers/api/src/__tests__/modules/users/users.service.test.ts` | **Modify.** `uploadPhoto` tests (mock repo + storage). |
| `workers/api/src/__tests__/modules/users/users.routes.test.ts` | **Modify.** `POST /:id/photo` tests (401/403/200). |
| `packages/api-client/src/types.ts` | **Modify.** `photoUrl` on `User` + `AuthUser`. |
| `packages/api-client/src/endpoints/users.ts` | **Modify.** `uploadPhoto(id, formData)`. |
| `sites/marketing-site/src/app/account/_components/ProfileCard.tsx` | **Modify.** Avatar (photo-or-initials) + upload control; refresh store on success. |
| `sites/marketing-site/src/components/Nav.tsx` | **Modify.** Show avatar when `user.photoUrl` is set. |

---

## Task 1: Add `photoUrl` column + migration (core)

**Files:**
- Modify: `packages/core/src/database/schema/users.schema.ts`
- Create (generated): `workers/api/src/database/migrations/0011_*.sql` + meta

- [ ] **Step 1: Add the column to the schema**

In `packages/core/src/database/schema/users.schema.ts`, inside the `users` table column block, add `photoUrl` after `pushToken`:
```ts
		googleId: text(),
		pushToken: text(),
		photoUrl: text(),
		...timestamps(),
```
(Bare `text()` matches the table's existing camelCase column style — `googleId`, `pushToken`.)

- [ ] **Step 2: Generate the migration**

Run (from worktree root): `bun run db:generate`
Expected: a new `workers/api/src/database/migrations/0011_*.sql` containing `ALTER TABLE \`users\` ADD \`photoUrl\` text;` (or the drizzle-equivalent), plus an updated `meta/_journal.json` (idx 11) and a `0011_snapshot.json`.

If `bun run db:generate` errors or prompts interactively, STOP and report BLOCKED with the output — do NOT hand-write the snapshot (it's large and error-prone).

- [ ] **Step 3: Verify the migration applies cleanly**

The API test DB replays every migration `.sql`. Run: `cd workers/api && bunx vitest run`
Expected: all green — if the new migration SQL were malformed, every test would fail at DB setup. (This is the migration's real gate.)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/database/schema/users.schema.ts workers/api/src/database/migrations/
git commit -m "feat(core): add users.photoUrl column (migration 0011)"
```

---

## Task 2: Upload endpoint (api)

**Files:**
- Modify: `workers/api/src/modules/users/users.service.ts`
- Modify: `workers/api/src/modules/users/users.schemas.ts`
- Modify: `workers/api/src/modules/users/index.ts`
- Modify: `workers/api/src/modules/auth/auth.schemas.ts`
- Modify: `workers/api/src/modules/auth/index.ts`
- Test: `workers/api/src/__tests__/modules/users/users.service.test.ts`
- Test: `workers/api/src/__tests__/modules/users/users.routes.test.ts`

- [ ] **Step 1: Write the failing service tests**

In `workers/api/src/__tests__/modules/users/users.service.test.ts`:
1. Add `ValidationError` to the errors import: `import { ConflictError, NotFoundError, ValidationError } from "../../../core/errors";` (read the current import line and extend it).
2. Add a storage mock + update `makeService` to pass it. Replace the existing `makeService`:
```ts
const mockStorage = {
	upload: vi.fn(),
	delete: vi.fn(),
	url: vi.fn(),
};

function makeService() {
	return new UsersService(mockRepo as never, mockStorage as never);
}
```
3. Add this describe block:
```ts
function fakeFile(type: string, sizeBytes = 1000): File {
	return new File([new Uint8Array(sizeBytes)], "avatar.png", { type });
}

describe("UsersService.uploadPhoto", () => {
	it("rejects a non-image content type", async () => {
		const svc = makeService();
		await expect(svc.uploadPhoto("u1", fakeFile("application/pdf"))).rejects.toThrow(ValidationError);
		expect(mockStorage.upload).not.toHaveBeenCalled();
	});

	it("rejects a file larger than 5MB", async () => {
		const svc = makeService();
		await expect(svc.uploadPhoto("u1", fakeFile("image/png", 6 * 1024 * 1024))).rejects.toThrow(ValidationError);
	});

	it("uploads, sets photoUrl, and deletes the previous object", async () => {
		mockRepo.findOne.mockResolvedValue({ data: { id: "u1", photoUrl: "https://storage.test/users/u1/old.png" } });
		mockStorage.upload.mockResolvedValue("https://storage.test/users/u1/new.png");
		mockRepo.updateOne.mockResolvedValue({ data: { id: "u1", photoUrl: "https://storage.test/users/u1/new.png" } });
		const svc = makeService();

		const result = await svc.uploadPhoto("u1", fakeFile("image/png"));

		expect(result).toEqual({ url: "https://storage.test/users/u1/new.png" });
		expect(mockStorage.upload).toHaveBeenCalledTimes(1);
		expect(mockRepo.updateOne).toHaveBeenCalledWith("u1", { photoUrl: "https://storage.test/users/u1/new.png" }, {});
		expect(mockStorage.delete).toHaveBeenCalledWith("users/u1/old.png");
	});

	it("does not delete when there was no previous photo", async () => {
		mockRepo.findOne.mockResolvedValue({ data: { id: "u1", photoUrl: null } });
		mockStorage.upload.mockResolvedValue("https://storage.test/users/u1/new.png");
		mockRepo.updateOne.mockResolvedValue({ data: { id: "u1", photoUrl: "https://storage.test/users/u1/new.png" } });
		const svc = makeService();
		await svc.uploadPhoto("u1", fakeFile("image/png"));
		expect(mockStorage.delete).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd workers/api && bunx vitest run src/__tests__/modules/users/users.service.test.ts`
Expected: FAIL — `uploadPhoto` not a function (and the constructor now takes a 2nd arg).

- [ ] **Step 3: Implement the service**

In `workers/api/src/modules/users/users.service.ts`:
1. Update imports — add `ValidationError` and the storage type:
```ts
import type { R2Storage } from "../../core/storage/r2";
import { ConflictError, NotFoundError, ValidationError } from "../../core/errors";
```
2. Update the constructor to accept storage:
```ts
	constructor(
		private readonly repo: UsersRepository,
		private readonly storage: R2Storage,
	) {}
```
3. Add the method (e.g. after `update`):
```ts
	private static readonly ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
	private static readonly MAX_PHOTO_BYTES = 5 * 1024 * 1024;

	async uploadPhoto(userId: string, file: File): Promise<{ url: string }> {
		if (!UsersService.ALLOWED_IMAGE_TYPES.includes(file.type))
			throw new ValidationError("Only JPEG, PNG, or WebP images are allowed");
		if (file.size > UsersService.MAX_PHOTO_BYTES)
			throw new ValidationError("Image must be 5MB or smaller");

		const current = await this.repo.findOne(userId, {});
		if (!current.data) throw new NotFoundError("User not found");
		const oldUrl = (current.data as { photoUrl?: string | null }).photoUrl ?? null;

		const ext = file.name.split(".").pop() ?? "jpg";
		const key = `users/${userId}/${crypto.randomUUID()}.${ext}`;
		const url = await this.storage.upload(key, await file.arrayBuffer(), file.type);

		await this.repo.updateOne(userId, { photoUrl: url } as Partial<UserInsert>, {});

		if (oldUrl) {
			try {
				await this.storage.delete(new URL(oldUrl).pathname.slice(1));
			} catch {
				/* best-effort: a failed delete leaves one orphan, not a correctness bug */
			}
		}
		return { url };
	}
```

- [ ] **Step 4: Run the service test, verify PASS**

Run: `cd workers/api && bunx vitest run src/__tests__/modules/users/users.service.test.ts`
Expected: PASS (existing + 4 new). The other existing tests construct the service via `makeService` (now 2-arg) — they still pass because they don't touch storage.

- [ ] **Step 5: Add `photoUrl` to the schema + define & register the upload route**

(a) In `workers/api/src/modules/users/users.schemas.ts`, add `photoUrl: z.string().nullable()` to `UserSchema` (next to `phone`).

(b) In `workers/api/src/modules/users/users.routes.ts` (this is where route objects live — it already imports `createRoute`, `z`, and `UserIdParamSchema`/`ErrorSchema` from `./users.schemas`, and uses `const tag = ["Users"]`), add and export a new route:
```ts
export const uploadPhotoRoute = createRoute({
	method: "post",
	path: "/:id/photo",
	tags: tag,
	summary: "Upload the authenticated user's profile photo",
	security: [{ bearerAuth: [] }],
	request: { params: UserIdParamSchema },
	responses: {
		200: { content: { "application/json": { schema: z.object({ url: z.string() }) } }, description: "Uploaded" },
		400: { content: { "application/json": { schema: ErrorSchema } }, description: "No file" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
	},
});
```

(c) In `workers/api/src/modules/users/index.ts`:
- Add `uploadPhotoRoute` to the existing `import { … } from "./users.routes";` block. (`ForbiddenError` is already imported.)
- Register the handler by chaining it onto the existing `selfApp` chain (after the `deleteUserRoute` handler):
```ts
	.openapi(uploadPhotoRoute, async (c) => {
		const { id } = c.req.valid("param");
		if (c.var.user.id !== id)
			throw new ForbiddenError("You can only update your own account");
		const body = await c.req.parseBody();
		const file = body.file;
		if (!(file instanceof File))
			return c.json({ ok: false as const, code: "BAD_REQUEST", message: "No file uploaded" }, 400);
		const result = await c.var.usersService.uploadPhoto(id, file);
		return c.json(result, 200);
	})
```
- Update the installer to pass storage:
```ts
export const installUsersService: ServiceInstaller = (c, { db, storage }) =>
	c.set("usersService", new UsersService(new UsersRepository(db), storage));
```

- [ ] **Step 6: Surface `photoUrl` on `/me`**

In `workers/api/src/modules/auth/auth.schemas.ts`, add to `AuthUserSchema`:
```ts
		photoUrl: z.string().nullable().optional(),
```
(Optional so the login/refresh responses — which build `user` from the session-token pair without a photo — still validate; `/me` provides the real value.)

In `workers/api/src/modules/auth/index.ts`, update the `/me` handler's response object:
```ts
		return c.json(
			{ id: user.id, email: user.email, name: user.name, role: user.role, photoUrl: user.photoUrl ?? null },
			200,
		);
```

- [ ] **Step 7: Write + run the failing route test, then confirm it passes**

In `workers/api/src/__tests__/modules/users/users.routes.test.ts` (read it first to match the harness — it uses `createTestApp`, `createTestToken`, `authHeader`, `TEST_ENV`, and a `mockUsersService`):
1. Add `uploadPhoto: vi.fn(),` to the `mockUsersService`.
2. Add:
```ts
describe("POST /api/v1/users/:id/photo", () => {
	function form() {
		const fd = new FormData();
		fd.append("file", new File([new Uint8Array(10)], "a.png", { type: "image/png" }));
		return fd;
	}

	it("returns 401 without auth", async () => {
		const res = await app.request("/api/v1/users/user-1/photo", { method: "POST", body: form() }, TEST_ENV);
		expect(res.status).toBe(401);
	});

	it("returns 403 uploading to another user's id", async () => {
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/users/user-2/photo",
			{ method: "POST", headers: { ...authHeader(token) }, body: form() },
			TEST_ENV,
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 and the url for a valid self upload", async () => {
		mockUsersService.uploadPhoto.mockResolvedValue({ url: "https://storage.test/users/user-1/x.png" });
		const token = await createTestToken({ userId: "user-1" });
		const res = await app.request(
			"/api/v1/users/user-1/photo",
			{ method: "POST", headers: { ...authHeader(token) }, body: form() },
			TEST_ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { url: string };
		expect(body.url).toContain("user-1");
		expect(mockUsersService.uploadPhoto).toHaveBeenCalledWith("user-1", expect.any(File));
	});
});
```
Run `cd workers/api && bunx vitest run src/__tests__/modules/users/` — verify the new route tests FAIL before Step 5's route exists, then PASS after. (If you implement Step 5 before running, they should pass directly.)

- [ ] **Step 8: Full API suite (no regressions)**

Run: `cd workers/api && bunx vitest run`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add workers/api/src/modules/users/ workers/api/src/modules/auth/ workers/api/src/__tests__/modules/users/
git commit -m "feat(api): POST /users/:id/photo (self-only avatar upload) + photoUrl on /me"
```

---

## Task 3: api-client types + `uploadPhoto`

**Files:**
- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/endpoints/users.ts`

- [ ] **Step 1: Add `photoUrl` to the types**

In `packages/api-client/src/types.ts`:
- Add `photoUrl: string | null;` to the `User` interface (after `phone`).
- Add `photoUrl?: string | null;` to the `AuthUser` interface (optional — `/me` provides it, login/refresh may omit).

- [ ] **Step 2: Add the endpoint method**

In `packages/api-client/src/endpoints/users.ts`, add to the returned object (mirroring the venues pattern — the `client.post` already detects `FormData`):
```ts
		uploadPhoto: (id: string, formData: FormData) =>
			client.post<{ url: string }>(`/api/v1/users/${id}/photo`, formData),
```

- [ ] **Step 3: Type-check**

Run: `cd sites/marketing-site && bunx tsc --noEmit` (it imports these types; this is the real check). Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/types.ts packages/api-client/src/endpoints/users.ts
git commit -m "feat(api-client): users.uploadPhoto + photoUrl on User/AuthUser"
```

---

## Task 4: Avatar UI (marketing-site)

**Files:**
- Modify: `sites/marketing-site/src/app/account/_components/ProfileCard.tsx`
- Modify: `sites/marketing-site/src/components/Nav.tsx`
- Test: `sites/marketing-site/src/app/account/_components/__tests__/ProfileCard.test.tsx`

- [ ] **Step 1: Extend the ProfileCard test**

In `sites/marketing-site/src/app/account/_components/__tests__/ProfileCard.test.tsx`, add `uploadPhoto: vi.fn()` to the mocked `api.users`, and add a test that when the full user has a `photoUrl`, an `<img>` with that src renders:
```ts
	it("renders the avatar image when photoUrl is set", async () => {
		get.mockResolvedValue({ data: { ...FULL, photoUrl: "https://storage.test/users/u1/a.png" } });
		renderCard();
		await waitFor(() =>
			expect(screen.getByRole("img", { name: /sara khan/i })).toHaveAttribute(
				"src",
				"https://storage.test/users/u1/a.png",
			),
		);
	});
```
(Update the `vi.mock("@/lib/api", …)` users object to include `uploadPhoto: (id: string, fd: unknown) => uploadPhoto(id, fd)` with a `const uploadPhoto = vi.fn()` at top, matching the existing `get`/`update` mock style.)

- [ ] **Step 2: Run, verify FAIL**

Run: `cd sites/marketing-site && bunx vitest run src/app/account/_components/__tests__/ProfileCard.test.tsx`
Expected: the new test FAILS (no `<img>` yet — the avatar is initials-only).

- [ ] **Step 3: Implement the avatar in ProfileCard**

In `ProfileCard.tsx`:
1. Add a `useQueryClient` import and `const qc = useQueryClient();` (it already uses `useQueryClient` — confirm). Add an upload mutation:
```tsx
	const uploadPhotoMut = useMutation({
		mutationFn: (file: File) => {
			const fd = new FormData();
			fd.append("file", file);
			// biome-ignore lint/style/noNonNullAssertion: only invoked from authenticated UI
			return api.users.uploadPhoto(userId!, fd);
		},
		onSuccess: (res) => {
			if (user) useAuthStore.getState().setUser({ ...user, photoUrl: res.url });
			qc.invalidateQueries({ queryKey: ["user", "me", userId] });
		},
	});
```
2. Replace the avatar circle (the `<div className="w-14 h-14 rounded-full bg-green-900 …">` with the initial) with a photo-or-initials version wrapped in a label that opens a file picker:
```tsx
				<label className="relative w-14 h-14 rounded-full overflow-hidden bg-green-900 flex items-center justify-center shrink-0 cursor-pointer group">
					{fullUser?.photoUrl ? (
						// plain <img>: remote R2 URL (next/image is not used for remote URLs here)
						<img
							src={fullUser.photoUrl}
							alt={user.name}
							className="w-full h-full object-cover"
						/>
					) : (
						<span className="font-serif text-2xl font-medium text-white">
							{user.name.charAt(0).toUpperCase()}
						</span>
					)}
					<span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
						<Camera size={16} className="text-white" />
					</span>
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp"
						className="hidden"
						disabled={uploadPhotoMut.isPending}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) uploadPhotoMut.mutate(file);
							e.target.value = "";
						}}
					/>
				</label>
```
3. Add `Camera` to the `lucide-react` import. If `uploadPhotoMut.isError`, render the message under the name block like the phone error:
```tsx
					{uploadPhotoMut.isError && (
						<p className="font-sans text-xs text-danger-fg mt-1 m-0">
							{(uploadPhotoMut.error as Error).message}
						</p>
					)}
```

- [ ] **Step 4: Run the ProfileCard test, verify PASS**

Run: `cd sites/marketing-site && bunx vitest run src/app/account/_components/__tests__/ProfileCard.test.tsx`
Expected: PASS (existing + the avatar test).

- [ ] **Step 5: Show the avatar in the Nav**

In `sites/marketing-site/src/components/Nav.tsx`, the desktop profile `Link href="/account"` currently shows `<User size={16} />` + first name. Replace the `<User size={16} />` icon with a conditional avatar:
```tsx
								{user.photoUrl ? (
									<img
										src={user.photoUrl}
										alt=""
										className="w-6 h-6 rounded-full object-cover"
									/>
								) : (
									<User size={16} />
								)}
```
Keep the `User` import (still used as the fallback + in the mobile menu). Apply the same conditional in the mobile menu's account link if it shows the `User` icon.

- [ ] **Step 6: Type-check + full web suite**

Run: `cd sites/marketing-site && bunx tsc --noEmit` (clean) and `cd sites/marketing-site && bunx vitest run` (all green — the Nav auth test still passes; `user.photoUrl` is undefined in those mocks so it falls back to the `User` icon).

- [ ] **Step 7: Commit**

```bash
git add sites/marketing-site/src/app/account/_components/ProfileCard.tsx sites/marketing-site/src/components/Nav.tsx sites/marketing-site/src/app/account/_components/__tests__/ProfileCard.test.tsx
git commit -m "feat(marketing-site): profile photo upload + avatar in ProfileCard and Nav"
```

---

## Task 5: Verification + docs

**Files:**
- Modify: `docs/guides/api-endpoints.md`, `docs/feature-map.md`, `workers/api/CLAUDE.md`, `packages/core/CLAUDE.md`

- [ ] **Step 1: Docs**

- `docs/guides/api-endpoints.md`: add `POST /api/v1/users/:id/photo` to the Users group — "Upload the authenticated user's profile photo (self-only; JPEG/PNG/WebP ≤ 5MB; stored in R2)." Match existing formatting.
- `docs/feature-map.md`: add a "Profile photo" row linking `POST /users/:id/photo` ↔ `ProfileCard`/`Nav` avatar.
- `workers/api/CLAUDE.md`: under the users/"Delete account" area, add: "`POST /api/v1/users/:id/photo` (authenticated, self-only) validates content-type (jpeg/png/webp) + size (≤5MB), stores the image in R2 under `users/<id>/<uuid>.<ext>`, sets `users.photoUrl`, and best-effort-deletes the previous object. `photoUrl` is surfaced on the DB-sourced `/me` response (kept out of the JWT)."
- `packages/core/CLAUDE.md`: note the `users.photoUrl` column (nullable) if the file enumerates user columns; otherwise skip.

- [ ] **Step 2: Lint (web)**

Run: `bun run --filter @repo/marketing-site lint`
Expected: 0 errors. Note: the new `<img>` tags will produce `noImgElement` **info** warnings (consistent with the codebase's "no next/image for remote URLs" rule) — those are acceptable infos, not errors. Fix any actual errors with `bunx biome check --write <file>`.

- [ ] **Step 3: Full suites + build**

Run: `cd workers/api && bunx vitest run` (green), `cd sites/marketing-site && bunx vitest run` (green), `bun run build` (passes).

- [ ] **Step 4: Manual smoke test**

API (`bun run api:dev`) + web (`bun run marketing-site:dev`), sign in, open `/account`:
1. Hover the avatar → camera overlay; pick a JPEG/PNG/WebP → it uploads and the avatar updates immediately (and the Nav avatar updates too, via the store).
2. Reload → the avatar persists (served from `/me`).
3. Pick a non-image or a >5MB file → an inline error appears (not a silent failure / not "Internal server error").

- [ ] **Step 5: Commit**

```bash
git add docs/guides/api-endpoints.md docs/feature-map.md workers/api/CLAUDE.md packages/core/CLAUDE.md
git commit -m "docs: document profile photo upload (Phase 3)"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** `photoUrl` migration (Task 1); self-only upload with type/size validation + random-key + delete-old (Task 2); `photoUrl` out of the JWT, DB-sourced on `/me` (Task 2); api-client `uploadPhoto` + types (Task 3); avatar in ProfileCard (with picker) + Nav, immediate update via store (Task 4); docs (Task 5).
- **Type consistency:** `uploadPhoto(userId: string, file: File): Promise<{ url: string }>` (service); route returns `{ url }`; api-client `uploadPhoto(id, formData): { url }`; `User.photoUrl: string | null`; `AuthUser.photoUrl?: string | null`; `MyReview` unaffected. `setUser({ ...user, photoUrl })` — `AuthUser` now allows `photoUrl`.
- **The worker's internal `AuthUser`** (`workers/api/src/types.ts`, from `SessionTokens.verify`) is intentionally NOT changed — `photoUrl` lives only on the response schema + DB. Do not add it to the JWT payload.
- **Migration risk:** if `bun run db:generate` can't run, report BLOCKED rather than hand-authoring the snapshot.
- **Not in this phase:** coupons wallet (deferred — its own brainstorm).
```
