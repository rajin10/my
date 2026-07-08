import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import {
	API_HEALTH_URL,
	HEALTH_POLL_MS,
	HEALTH_TIMEOUT_MS,
	PORTS,
	SETUP_VERSION,
} from "./dev/constants.ts";
import { writeEnvFiles } from "./dev/env-writer.ts";
import { waitForHealth } from "./dev/health.ts";
import { fail, ok, step } from "./dev/log.ts";
import { readMarker, writeMarker } from "./dev/marker.ts";
import { repoRoot } from "./dev/paths.ts";
import { findBlockedPorts } from "./dev/ports.ts";
import { checkPrerequisites } from "./dev/prereqs.ts";
import { resolveSecrets } from "./dev/secrets.ts";

const TOTAL = 7;
const force = process.argv.includes("--force");
const root = repoRoot();

console.log("Talash dev setup");
console.log("────────────────");

step(1, TOTAL, "Prerequisites");
try {
	await checkPrerequisites();
	ok(
		`bun ${process.versions.bun} ✓  node ${process.versions.node} ✓  wrangler ✓`,
	);
} catch (e) {
	fail(e instanceof Error ? e.message : String(e));
}

step(2, TOTAL, "Dependencies");
const nodeModules = join(root, "node_modules");
const existingMarker = await readMarker(root);
if (!existsSync(nodeModules) || force) {
	const result = await $`bun install`.cwd(root).nothrow();
	if (result.exitCode !== 0) fail("bun install failed");
	ok("bun install ✓");
} else {
	ok("dependencies already installed ✓");
}

step(3, TOTAL, "Secrets");
const { secrets, source } = await resolveSecrets();
ok("JWT_SECRET ✓  GOOGLE_CLIENT_SECRET ✓");

step(4, TOTAL, "Env files");
const envResult = await writeEnvFiles(root, secrets, { force });
ok(
	`${envResult.written.length} written, ${envResult.skipped.length} skipped ✓`,
);

step(5, TOTAL, "Database");
if (!existingMarker || force) {
	const result = await $`bun run db:fresh`.cwd(root).nothrow();
	if (result.exitCode !== 0) fail("db:fresh failed");
	ok("seeded ✓");
} else {
	ok("already seeded (use --force to re-run) ✓");
}

step(6, TOTAL, "Ports");
const blocked = await findBlockedPorts([
	PORTS.api,
	PORTS.marketing,
	PORTS.dashboard,
]);
if (blocked.length > 0) {
	fail(
		`Ports in use: ${blocked.join(", ")}. Stop conflicting processes or run: lsof -i :${blocked[0]}`,
	);
}
ok(`${PORTS.api} ${PORTS.marketing} ${PORTS.dashboard} free ✓`);

step(7, TOTAL, "Health check");
const apiProc = Bun.spawn(["bun", "run", "api:dev"], {
	cwd: root,
	stdout: "pipe",
	stderr: "pipe",
});
try {
	await waitForHealth(API_HEALTH_URL, {
		timeoutMs: HEALTH_TIMEOUT_MS,
		pollMs: HEALTH_POLL_MS,
	});
	ok("GET /health → 200 ✓");
} catch (e) {
	apiProc.kill();
	fail(e instanceof Error ? e.message : String(e));
}
apiProc.kill();
await apiProc.exited;

await writeMarker(root, {
	version: SETUP_VERSION,
	completedAt: new Date().toISOString(),
	ports: {
		api: PORTS.api,
		marketing: PORTS.marketing,
		dashboard: PORTS.dashboard,
	},
	secretsSource: source,
});

console.log("");
console.log("Setup complete. Run: bun run dev:all");
