# Local Dev Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `bun run dev:setup` (first-run wizard) and `bun run dev:all` (full-stack orchestrator) so a new developer reaches a working local stack with Google OAuth on all four frontends.

**Architecture:** Pure helpers in `scripts/dev/` (constants, template rendering, marker, port/health checks); thin entry scripts `scripts/dev-setup.ts` and `scripts/dev-all.ts`. Env templates are committed under `scripts/dev/templates/` — never copied from gitignored `.env.example` files. Setup marker at `.talash/dev-setup.json`.

**Tech Stack:** Bun (`Bun.spawn`, `Bun.write`, `bun:test`), TypeScript, existing root `package.json` dev scripts.

**Spec:** [2026-06-15-local-dev-workflow-design.md](../specs/2026-06-15-local-dev-workflow-design.md)

---

## File map

| File | Responsibility |
| --- | --- |
| `scripts/dev/constants.ts` | Ports, Google client ID, setup version, service definitions |
| `scripts/dev/paths.ts` | Repo root resolution, env file target paths |
| `scripts/dev/templates.ts` | Render `.dev.vars` / `.env.local` / `.env` from secrets + constants |
| `scripts/dev/secrets.ts` | Resolve secrets from `TALASH_DEV_SECRETS` or interactive prompt |
| `scripts/dev/marker.ts` | Read/write `.talash/dev-setup.json` |
| `scripts/dev/prereqs.ts` | Check bun/node/wrangler versions |
| `scripts/dev/ports.ts` | TCP port availability probe |
| `scripts/dev/health.ts` | Poll `GET /health` until 200 |
| `scripts/dev/log.ts` | Step banner + prefixed child stdout/stderr |
| `scripts/dev-setup.ts` | Wizard orchestration (7 steps) |
| `scripts/dev-all.ts` | Process orchestrator + marker gate |
| `scripts/dev/__tests__/*.test.ts` | Unit tests for pure helpers |

---

### Task 1: Constants and paths

**Files:**
- Create: `scripts/dev/constants.ts`
- Create: `scripts/dev/paths.ts`
- Test: `scripts/dev/__tests__/paths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/dev/__tests__/paths.test.ts
import { describe, expect, test } from "bun:test";
import { repoRoot, envTargets } from "../paths.ts";

describe("paths", () => {
	test("envTargets lists all five local env files", () => {
		const keys = envTargets(repoRoot()).map((t) => t.key);
		expect(keys).toEqual([
			"apiDevVars",
			"marketingEnv",
			"dashboardEnv",
			"mobileEnv",
			"ownerEnv",
		]);
	});

	test("repoRoot ends at monorepo root (has package.json workspaces)", async () => {
		const root = repoRoot();
		const pkg = await Bun.file(`${root}/package.json`).json();
		expect(pkg.workspaces).toBeDefined();
	});
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun test scripts/dev/__tests__/paths.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement constants and paths**

```ts
// scripts/dev/constants.ts
export const SETUP_VERSION = 1;

export const GOOGLE_CLIENT_ID =
	"163196138441-dvuciv0t2ddnkr61fck5r9i9v2jq0a64.apps.googleusercontent.com";

export const PORTS = {
	api: 8787,
	marketing: 3000,
	dashboard: 3001,
} as const;

export const API_HEALTH_URL = `http://localhost:${PORTS.api}/health`;

export const HEALTH_TIMEOUT_MS = 30_000;
export const HEALTH_POLL_MS = 500;

export type DevSecrets = {
	jwtSecret: string;
	googleClientSecret: string;
};

export type DevService = {
	key: string;
	label: string;
	command: string[];
	cwd?: string;
	prefix: string;
	url?: string;
	waitForHealth?: boolean;
};

export const DEV_SERVICES: DevService[] = [
	{
		key: "api",
		label: "API",
		command: ["bun", "run", "api:dev"],
		prefix: "api",
		url: `http://localhost:${PORTS.api}`,
		waitForHealth: false,
	},
	{
		key: "queue",
		label: "Queue worker",
		command: ["bun", "run", "queue:dev"],
		prefix: "queue",
	},
	{
		key: "scheduled",
		label: "Scheduled worker",
		command: ["bun", "run", "scheduled:dev"],
		prefix: "scheduled",
	},
	{
		key: "marketing",
		label: "Marketing site",
		command: ["bun", "run", "marketing-site:dev"],
		prefix: "marketing",
		url: `http://localhost:${PORTS.marketing}`,
		waitForHealth: true,
	},
	{
		key: "dashboard",
		label: "Business dashboard",
		command: ["bun", "run", "business-dashboard:dev"],
		prefix: "dashboard",
		url: `http://localhost:${PORTS.dashboard}`,
		waitForHealth: true,
	},
	{
		key: "mobile",
		label: "Mobile app",
		command: ["bun", "run", "mobile-app:dev"],
		prefix: "mobile",
		url: "Expo DevTools",
		waitForHealth: true,
	},
	{
		key: "owner",
		label: "Owner app",
		command: ["bun", "run", "owner-app:dev"],
		prefix: "owner",
		url: "Expo DevTools",
		waitForHealth: true,
	},
];
```

```ts
// scripts/dev/paths.ts
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot(): string {
	// scripts/dev/paths.ts → repo root is two levels up from scripts/dev
	return join(dirname(fileURLToPath(import.meta.url)), "../..");
}

export type EnvTarget = {
	key: string;
	relativePath: string;
};

export function envTargets(root: string): EnvTarget[] {
	return [
		{ key: "apiDevVars", relativePath: "workers/api/.dev.vars" },
		{ key: "marketingEnv", relativePath: "sites/marketing-site/.env.local" },
		{ key: "dashboardEnv", relativePath: "sites/business-dashboard/.env.local" },
		{ key: "mobileEnv", relativePath: "apps/mobile-app/.env" },
		{ key: "ownerEnv", relativePath: "apps/owner-app/.env" },
	];
}

export function markerPath(root: string): string {
	return join(root, ".talash/dev-setup.json");
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun test scripts/dev/__tests__/paths.test.ts`
Expected: PASS

---

### Task 2: Template rendering

**Files:**
- Create: `scripts/dev/templates.ts`
- Test: `scripts/dev/__tests__/templates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/dev/__tests__/templates.test.ts
import { describe, expect, test } from "bun:test";
import { GOOGLE_CLIENT_ID, PORTS } from "../constants.ts";
import { renderAllEnvFiles } from "../templates.ts";

const secrets = {
	jwtSecret: "test-jwt-secret-min-32-chars-long!!",
	googleClientSecret: "GOCSPX-test-secret",
};

describe("renderAllEnvFiles", () => {
	test("api dev vars point at localhost origins", () => {
		const files = renderAllEnvFiles(secrets);
		expect(files.apiDevVars).toContain('JWT_SECRET="test-jwt-secret-min-32-chars-long!!"');
		expect(files.apiDevVars).toContain(GOOGLE_CLIENT_ID);
		expect(files.apiDevVars).toContain(
			`ALLOWED_ORIGINS="http://localhost:${PORTS.marketing},http://localhost:${PORTS.dashboard}"`,
		);
	});

	test("marketing site uses localhost API", () => {
		const files = renderAllEnvFiles(secrets);
		expect(files.marketingEnv).toContain("NEXT_PUBLIC_API_URL=http://localhost:8787");
		expect(files.marketingEnv).toContain(`NEXT_PUBLIC_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}`);
	});

	test("mobile apps use redirect auth provider", () => {
		const files = renderAllEnvFiles(secrets);
		expect(files.mobileEnv).toContain("EXPO_PUBLIC_AUTH_PROVIDER=redirect");
		expect(files.ownerEnv).toContain("EXPO_PUBLIC_API_URL=http://localhost:8787");
	});
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun test scripts/dev/__tests__/templates.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement template rendering**

```ts
// scripts/dev/templates.ts
import { GOOGLE_CLIENT_ID, PORTS, type DevSecrets } from "./constants.ts";

export type RenderedEnvFiles = {
	apiDevVars: string;
	marketingEnv: string;
	dashboardEnv: string;
	mobileEnv: string;
	ownerEnv: string;
};

function q(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function renderAllEnvFiles(secrets: DevSecrets): RenderedEnvFiles {
	const origins = `http://localhost:${PORTS.marketing},http://localhost:${PORTS.dashboard}`;
	const resetUris = [
		`http://localhost:${PORTS.marketing}/auth/reset-password`,
		`http://localhost:${PORTS.dashboard}/auth/reset-password`,
		"mobileapp://auth/reset-password",
		"ownerapp://auth/reset-password",
	].join(",");

	const apiDevVars = [
		"ENVIRONMENT=development",
		`JWT_SECRET=${q(secrets.jwtSecret)}`,
		`GOOGLE_CLIENT_ID=${q(GOOGLE_CLIENT_ID)}`,
		`GOOGLE_CLIENT_SECRET=${q(secrets.googleClientSecret)}`,
		`ALLOWED_ORIGINS=${q(origins)}`,
		`ALLOWED_RESET_URIS=${q(resetUris)}`,
		'PUBLIC_R2_URL="https://storage.talash.bd"',
		'EMAIL_FROM="noreply@talash.bd"',
		"",
	].join("\n");

	const marketingEnv = [
		"NEXTJS_ENV=development",
		"API_URL=http://localhost:8787",
		"NEXT_PUBLIC_API_URL=http://localhost:8787",
		`NEXT_PUBLIC_SITE_URL=http://localhost:${PORTS.marketing}`,
		`NEXT_PUBLIC_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}`,
		"",
	].join("\n");

	const dashboardEnv = [
		"NEXTJS_ENV=development",
		"API_URL=http://localhost:8787",
		"NEXT_PUBLIC_API_URL=http://localhost:8787",
		`NEXT_PUBLIC_SITE_URL=http://localhost:${PORTS.dashboard}`,
		`NEXT_PUBLIC_MARKETING_URL=http://localhost:${PORTS.marketing}`,
		`NEXT_PUBLIC_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}`,
		"",
	].join("\n");

	const mobileEnv = [
		"EXPO_PUBLIC_API_URL=http://localhost:8787",
		"EXPO_PUBLIC_AUTH_PROVIDER=redirect",
		"",
	].join("\n");

	const ownerEnv = mobileEnv;

	return { apiDevVars, marketingEnv, dashboardEnv, mobileEnv, ownerEnv };
}

/** Returns true when file content already matches local-dev expectations. */
export function isLocalDevEnv(key: string, content: string): boolean {
	if (key === "apiDevVars") {
		return (
			content.includes("ENVIRONMENT=development") &&
			content.includes("localhost:3000") &&
			!content.includes("api.talash.bd")
		);
	}
	if (key === "marketingEnv" || key === "dashboardEnv") {
		return (
			content.includes("NEXT_PUBLIC_API_URL=http://localhost:8787") &&
			!content.includes("NEXT_PUBLIC_API_URL=https://api.talash")
		);
	}
	if (key === "mobileEnv" || key === "ownerEnv") {
		return (
			content.includes("EXPO_PUBLIC_API_URL=http://localhost:8787") &&
			content.includes("EXPO_PUBLIC_AUTH_PROVIDER=redirect")
		);
	}
	return false;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun test scripts/dev/__tests__/templates.test.ts`
Expected: PASS

---

### Task 3: Setup marker read/write

**Files:**
- Create: `scripts/dev/marker.ts`
- Test: `scripts/dev/__tests__/marker.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/dev/__tests__/marker.test.ts
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readMarker, writeMarker, markerIsCurrent } from "../marker.ts";
import { SETUP_VERSION } from "../constants.ts";

describe("marker", () => {
	test("write then read round-trips", async () => {
		const dir = await mkdtemp(join(tmpdir(), "talash-marker-"));
		const root = join(dir, "repo");
		await Bun.write(join(root, ".talash/.gitkeep"), "");
		const marker = {
			version: SETUP_VERSION,
			completedAt: new Date().toISOString(),
			ports: { api: 8787, marketing: 3000, dashboard: 3001 },
			secretsSource: "test" as const,
		};
		await writeMarker(root, marker);
		const loaded = await readMarker(root);
		expect(loaded?.version).toBe(SETUP_VERSION);
		await rm(dir, { recursive: true, force: true });
	});

	test("markerIsCurrent false when missing or stale version", async () => {
		expect(markerIsCurrent(null)).toBe(false);
		expect(markerIsCurrent({ version: 0 } as never)).toBe(false);
	});
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun test scripts/dev/__tests__/marker.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement marker helpers**

```ts
// scripts/dev/marker.ts
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SETUP_VERSION } from "./constants.ts";
import { markerPath } from "./paths.ts";

export type SetupMarker = {
	version: number;
	completedAt: string;
	ports: { api: number; marketing: number; dashboard: number };
	secretsSource: "env" | "interactive" | "test";
};

export async function readMarker(root: string): Promise<SetupMarker | null> {
	const file = Bun.file(markerPath(root));
	if (!(await file.exists())) return null;
	try {
		return (await file.json()) as SetupMarker;
	} catch {
		return null;
	}
}

export async function writeMarker(root: string, marker: SetupMarker): Promise<void> {
	const path = markerPath(root);
	await mkdir(join(root, ".talash"), { recursive: true });
	await Bun.write(path, `${JSON.stringify(marker, null, 2)}\n`);
}

export function markerIsCurrent(marker: SetupMarker | null): boolean {
	return marker !== null && marker.version === SETUP_VERSION;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun test scripts/dev/__tests__/marker.test.ts`
Expected: PASS

---

### Task 4: Port availability helper

**Files:**
- Create: `scripts/dev/ports.ts`
- Test: `scripts/dev/__tests__/ports.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/dev/__tests__/ports.test.ts
import { describe, expect, test } from "bun:test";
import { createServer } from "node:net";
import { isPortFree, findBlockedPorts } from "../ports.ts";

function listen(port: number): Promise<ReturnType<typeof createServer>> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(port, "127.0.0.1", () => resolve(server));
	});
}

describe("ports", () => {
	test("isPortFree false when port is bound", async () => {
		const server = await listen(0);
		const addr = server.address();
		const port = typeof addr === "object" && addr ? addr.port : 0;
		expect(await isPortFree(port)).toBe(false);
		server.close();
	});

	test("findBlockedPorts lists occupied ports", async () => {
		const server = await listen(0);
		const addr = server.address();
		const port = typeof addr === "object" && addr ? addr.port : 0;
		const blocked = await findBlockedPorts([port, 59999]);
		expect(blocked).toEqual([port]);
		server.close();
	});
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun test scripts/dev/__tests__/ports.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement port helpers**

```ts
// scripts/dev/ports.ts
import { connect } from "node:net";

export function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ port, host: "127.0.0.1" });
		socket.once("connect", () => {
			socket.destroy();
			resolve(false);
		});
		socket.once("error", () => resolve(true));
	});
}

export async function findBlockedPorts(ports: number[]): Promise<number[]> {
	const blocked: number[] = [];
	for (const port of ports) {
		if (!(await isPortFree(port))) blocked.push(port);
	}
	return blocked;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun test scripts/dev/__tests__/ports.test.ts`
Expected: PASS

---

### Task 5: Prerequisites checker

**Files:**
- Create: `scripts/dev/prereqs.ts`
- Create: `scripts/dev/log.ts`
- Test: `scripts/dev/__tests__/prereqs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/dev/__tests__/prereqs.test.ts
import { describe, expect, test } from "bun:test";
import { parseVersion, meetsMinimum } from "../prereqs.ts";

describe("prereqs", () => {
	test("meetsMinimum compares semver tuples", () => {
		expect(meetsMinimum(parseVersion("1.3.1"), parseVersion("1.3.0"))).toBe(true);
		expect(meetsMinimum(parseVersion("1.2.9"), parseVersion("1.3.0"))).toBe(false);
	});
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun test scripts/dev/__tests__/prereqs.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement prereqs + log**

```ts
// scripts/dev/log.ts
export function step(n: number, total: number, label: string): void {
	console.log(`[${n}/${total}] ${label}`);
}

export function ok(msg: string): void {
	console.log(`  ✓ ${msg}`);
}

export function fail(msg: string): never {
	console.error(`  ✗ ${msg}`);
	process.exit(1);
}

export function prefixLines(prefix: string, chunk: Uint8Array | string): string {
	const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
	return text
		.split("\n")
		.filter((line) => line.length > 0)
		.map((line) => `[${prefix}] ${line}`)
		.join("\n");
}
```

```ts
// scripts/dev/prereqs.ts
import { $ } from "bun";

export type Semver = [number, number, number];

export function parseVersion(raw: string): Semver {
	const match = raw.trim().match(/(\d+)\.(\d+)\.(\d+)/);
	if (!match) return [0, 0, 0];
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function meetsMinimum(actual: Semver, minimum: Semver): boolean {
	for (let i = 0; i < 3; i++) {
		if (actual[i] > minimum[i]) return true;
		if (actual[i] < minimum[i]) return false;
	}
	return true;
}

export async function checkPrerequisites(): Promise<void> {
	const bunVersion = parseVersion(process.versions.bun ?? "0.0.0");
	if (!meetsMinimum(bunVersion, [1, 3, 0])) {
		throw new Error(`Bun 1.3+ required (found ${process.versions.bun})`);
	}
	const nodeVersion = parseVersion(process.versions.node);
	if (!meetsMinimum(nodeVersion, [20, 0, 0])) {
		throw new Error(`Node 20+ required (found ${process.versions.node})`);
	}
	const wrangler = await $`bunx wrangler --version`.quiet().nothrow();
	if (wrangler.exitCode !== 0) {
		throw new Error("wrangler not found — run: bun add -g wrangler (or bunx wrangler)");
	}
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun test scripts/dev/__tests__/prereqs.test.ts`
Expected: PASS

---

### Task 6: Secrets resolution

**Files:**
- Create: `scripts/dev/secrets.ts`
- Test: `scripts/dev/__tests__/secrets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/dev/__tests__/secrets.test.ts
import { describe, expect, test } from "bun:test";
import { parseSecretsJson } from "../secrets.ts";

describe("secrets", () => {
	test("parseSecretsJson accepts jwtSecret + googleClientSecret", () => {
		const parsed = parseSecretsJson(
			'{"jwtSecret":"abc","googleClientSecret":"GOCSPX-x"}',
		);
		expect(parsed.jwtSecret).toBe("abc");
		expect(parsed.googleClientSecret).toBe("GOCSPX-x");
	});

	test("parseSecretsJson rejects missing keys", () => {
		expect(() => parseSecretsJson("{}")).toThrow();
	});
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun test scripts/dev/__tests__/secrets.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement secrets parser**

```ts
// scripts/dev/secrets.ts
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { DevSecrets } from "./constants.ts";

export function parseSecretsJson(raw: string): DevSecrets {
	const data = JSON.parse(raw) as Partial<DevSecrets>;
	if (!data.jwtSecret?.trim() || !data.googleClientSecret?.trim()) {
		throw new Error("TALASH_DEV_SECRETS must include jwtSecret and googleClientSecret");
	}
	return {
		jwtSecret: data.jwtSecret.trim(),
		googleClientSecret: data.googleClientSecret.trim(),
	};
}

export async function resolveSecrets(): Promise<{
	secrets: DevSecrets;
	source: "env" | "interactive";
}> {
	const fromEnv = process.env.TALASH_DEV_SECRETS;
	if (fromEnv) {
		return { secrets: parseSecretsJson(fromEnv), source: "env" };
	}

	if (!process.stdin.isTTY) {
		console.error(
			"Missing TALASH_DEV_SECRETS. Set JSON { jwtSecret, googleClientSecret } or run interactively.",
		);
		console.error("See docs/guides/google-auth.md for team vault values.");
		process.exit(1);
	}

	const rl = readline.createInterface({ input, output });
	try {
		const jwtSecret = await rl.question("JWT_SECRET: ");
		const googleClientSecret = await rl.question("GOOGLE_CLIENT_SECRET: ");
		if (!jwtSecret.trim() || !googleClientSecret.trim()) {
			throw new Error("Both secrets are required");
		}
		return {
			secrets: {
				jwtSecret: jwtSecret.trim(),
				googleClientSecret: googleClientSecret.trim(),
			},
			source: "interactive",
		};
	} finally {
		rl.close();
	}
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun test scripts/dev/__tests__/secrets.test.ts`
Expected: PASS

---

### Task 7: Env file writer

**Files:**
- Create: `scripts/dev/env-writer.ts`
- Test: `scripts/dev/__tests__/env-writer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/dev/__tests__/env-writer.test.ts
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeEnvFiles } from "../env-writer.ts";

const secrets = {
	jwtSecret: "test-jwt-secret-min-32-chars-long!!",
	googleClientSecret: "GOCSPX-test-secret",
};

describe("writeEnvFiles", () => {
	test("writes all five env files when missing", async () => {
		const dir = await mkdtemp(join(tmpdir(), "talash-env-"));
		const root = join(dir, "repo");
		for (const rel of [
			"workers/api",
			"sites/marketing-site",
			"sites/business-dashboard",
			"apps/mobile-app",
			"apps/owner-app",
		]) {
			await Bun.write(join(root, rel, ".gitkeep"), "");
		}
		const result = await writeEnvFiles(root, secrets, { force: true });
		expect(result.written).toHaveLength(5);
		const api = await Bun.file(join(root, "workers/api/.dev.vars")).text();
		expect(api).toContain("JWT_SECRET");
		await rm(dir, { recursive: true, force: true });
	});

	test("skips when localhost env already correct and force false", async () => {
		const dir = await mkdtemp(join(tmpdir(), "talash-env-skip-"));
		const root = join(dir, "repo");
		const mobileDir = join(root, "apps/mobile-app");
		await Bun.write(join(mobileDir, ".gitkeep"), "");
		await Bun.write(
			join(mobileDir, ".env"),
			"EXPO_PUBLIC_API_URL=http://localhost:8787\nEXPO_PUBLIC_AUTH_PROVIDER=redirect\n",
		);
		// Only mobile path exists — others will be written
		const result = await writeEnvFiles(root, secrets, { force: false });
		expect(result.skipped).toContain("mobileEnv");
		await rm(dir, { recursive: true, force: true });
	});
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun test scripts/dev/__tests__/env-writer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement env writer**

```ts
// scripts/dev/env-writer.ts
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DevSecrets } from "./constants.ts";
import { envTargets } from "./paths.ts";
import { isLocalDevEnv, renderAllEnvFiles } from "./templates.ts";

type WriteResult = { written: string[]; skipped: string[] };

const RENDER_KEY: Record<string, keyof ReturnType<typeof renderAllEnvFiles>> = {
	apiDevVars: "apiDevVars",
	marketingEnv: "marketingEnv",
	dashboardEnv: "dashboardEnv",
	mobileEnv: "mobileEnv",
	ownerEnv: "ownerEnv",
};

export async function writeEnvFiles(
	root: string,
	secrets: DevSecrets,
	opts: { force: boolean },
): Promise<WriteResult> {
	const rendered = renderAllEnvFiles(secrets);
	const written: string[] = [];
	const skipped: string[] = [];

	for (const target of envTargets(root)) {
		const abs = join(root, target.relativePath);
		await mkdir(dirname(abs), { recursive: true });
		const file = Bun.file(abs);
		const renderKey = RENDER_KEY[target.key];
		const content = rendered[renderKey];

		if (!opts.force && (await file.exists())) {
			const existing = await file.text();
			if (isLocalDevEnv(target.key, existing)) {
				skipped.push(target.key);
				continue;
			}
		}

		await Bun.write(abs, content);
		written.push(target.key);
	}

	return { written, skipped };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun test scripts/dev/__tests__/env-writer.test.ts`
Expected: PASS

---

### Task 8: Health poll helper

**Files:**
- Create: `scripts/dev/health.ts`
- Test: `scripts/dev/__tests__/health.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/dev/__tests__/health.test.ts
import { describe, expect, test } from "bun:test";
import { waitForHealth } from "../health.ts";

describe("waitForHealth", () => {
	test("resolves when server returns 200", async () => {
		const server = Bun.serve({
			port: 0,
			fetch(req) {
				if (new URL(req.url).pathname === "/health") {
					return Response.json({ status: "ok" });
				}
				return new Response("not found", { status: 404 });
			},
		});
		await expect(
			waitForHealth(`http://127.0.0.1:${server.port}/health`, {
				timeoutMs: 5000,
				pollMs: 100,
			}),
		).resolves.toBeUndefined();
		server.stop();
	});

	test("rejects on timeout", async () => {
		await expect(
			waitForHealth("http://127.0.0.1:59998/health", {
				timeoutMs: 300,
				pollMs: 100,
			}),
		).rejects.toThrow(/timeout/i);
	});
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun test scripts/dev/__tests__/health.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement health poll**

```ts
// scripts/dev/health.ts
export async function waitForHealth(
	url: string,
	opts: { timeoutMs: number; pollMs: number },
): Promise<void> {
	const deadline = Date.now() + opts.timeoutMs;
	let lastError = "unknown";

	while (Date.now() < deadline) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
			if (res.ok) return;
			lastError = `HTTP ${res.status}`;
		} catch (e) {
			lastError = e instanceof Error ? e.message : String(e);
		}
		await Bun.sleep(opts.pollMs);
	}

	throw new Error(`Health check timeout for ${url}: ${lastError}`);
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `bun test scripts/dev/__tests__/health.test.ts`
Expected: PASS

---

### Task 9: Wizard entry script

**Files:**
- Create: `scripts/dev-setup.ts`

- [ ] **Step 1: Implement wizard orchestration**

Parse `--force` from `process.argv`. Steps:

1. `checkPrerequisites()` — catch → `fail()`
2. `await $`bun install`.cwd(root)`` — only if `node_modules` missing or `--force`
3. `resolveSecrets()`
4. `writeEnvFiles(root, secrets, { force })`
5. `await $`bun run db:fresh`.cwd(root)`` — skip if marker exists and not `--force` (optional: always seed on first run only)
6. `findBlockedPorts([8787, 3000, 3001])` — fail with `lsof` hint if blocked
7. Start API temporarily OR instruct user to run dev:all for health — **simpler:** spawn `bun run api:dev` in background, `waitForHealth`, then kill before writing marker (validates stack works). Alternative per spec: health check runs during step 7 by spawning API subprocess.

Write marker with `writeMarker`.

Print: `Setup complete. Run: bun run dev:all`

- [ ] **Step 2: Smoke test wizard (non-interactive)**

Run: `TALASH_DEV_SECRETS='{"jwtSecret":"local-dev-jwt-secret-32chars-min!!","googleClientSecret":"GOCSPX-local"}' bun scripts/dev-setup.ts --force`
Expected: exits 0, five env files written, `.talash/dev-setup.json` created.

---

### Task 10: Orchestrator entry script

**Files:**
- Create: `scripts/dev-all.ts`

- [ ] **Step 1: Implement orchestrator**

```ts
// scripts/dev-all.ts (structure)
import { repoRoot } from "./dev/paths.ts";
import { readMarker, markerIsCurrent } from "./dev/marker.ts";
import { DEV_SERVICES, API_HEALTH_URL } from "./dev/constants.ts";
import { waitForHealth } from "./dev/health.ts";
import { prefixLines } from "./dev/log.ts";

const root = repoRoot();
const marker = await readMarker(root);
if (!markerIsCurrent(marker)) {
	const proc = Bun.spawn(["bun", "scripts/dev-setup.ts"], { cwd: root, stdio: ["inherit", "inherit", "inherit"] });
	if ((await proc.exited) !== 0) process.exit(1);
}

const children: subprocess[] = [];
const abort = () => {
	for (const child of children) child.kill();
	process.exit(0);
};
process.on("SIGINT", abort);
process.on("SIGTERM", abort);

// Start API + workers first
for (const svc of DEV_SERVICES.filter((s) => !s.waitForHealth)) {
	const child = Bun.spawn(svc.command, { cwd: root, stdout: "pipe", stderr: "pipe" });
	pipeWithPrefix(child, svc.prefix);
	children.push(child);
}

await waitForHealth(API_HEALTH_URL);

// Start frontends
for (const svc of DEV_SERVICES.filter((s) => s.waitForHealth)) {
	const child = Bun.spawn(svc.command, { cwd: root, stdout: "pipe", stderr: "pipe" });
	pipeWithPrefix(child, svc.prefix);
	children.push(child);
}

printStatusTable(DEV_SERVICES);
await Promise.race(children.map((c) => c.exited)); // exit when any child dies
abort();
```

Implement `pipeWithPrefix` to stream prefixed logs. On child exit, log service name + last stderr lines.

- [ ] **Step 2: Manual smoke**

Run: `bun run dev:all`
Expected: all seven services start; status table printed; Ctrl+C stops all.

---

### Task 11: Wire root scripts and gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add scripts to root package.json**

```json
"dev:setup": "bun scripts/dev-setup.ts",
"dev:all": "bun scripts/dev-all.ts"
```

- [ ] **Step 2: Add `.talash/` to `.gitignore`**

Append after `.cursor`:

```
.talash/
```

- [ ] **Step 3: Run unit tests**

Run: `bun test scripts/dev/__tests__/`
Expected: all PASS

---

### Task 12: Documentation

**Files:**
- Create: `docs/guides/local-dev.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Write `docs/guides/local-dev.md`**

Cover: quick start (`dev:setup` → `dev:all`), `TALASH_DEV_SECRETS` JSON shape, `--force`, port table, troubleshooting (port in use, missing secrets, production URL detection), relationship to manual env docs.

- [ ] **Step 2: Update `docs/getting-started.md`**

Replace manual env copy section lead with:

```sh
bun run dev:setup   # first time
bun run dev:all     # every day
```

Keep manual env section as fallback link to `local-dev.md`.

- [ ] **Step 3: Link from `docs/README.md` and add one bullet to `AGENTS.md` Dev commands**

---

### Task 13: Final verification

- [ ] **Step 1: Lint**

Run: `bun run lint`
Expected: PASS (fix any Biome issues in new scripts)

- [ ] **Step 2: Run all script unit tests**

Run: `bun test scripts/dev/__tests__/`
Expected: PASS

- [ ] **Step 3: Manual auth smoke (document in PR)**

1. `bun run dev:all`
2. Open http://localhost:3000 — Google sign-in completes
3. Open http://localhost:3001 — Google sign-in completes
4. Expo Go — both apps sign in via redirect flow

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| `dev:setup` wizard 7 steps | Task 9 |
| `dev:all` orchestrator | Task 10 |
| Hybrid secrets model | Task 6 |
| Five env files from templates | Task 2, 7 |
| Setup marker `.talash/dev-setup.json` | Task 3, 11 |
| API health gate before frontends | Task 8, 10 |
| Port check + error messages | Task 4, 9 |
| Idempotent setup + `--force` | Task 7, 9 |
| Ctrl+C kills children | Task 10 |
| Docs updates | Task 12 |
