import type { Subprocess } from "bun";
import {
	API_HEALTH_URL,
	DEV_SERVICES,
	type DevService,
	HEALTH_POLL_MS,
	HEALTH_TIMEOUT_MS,
} from "./dev/constants.ts";
import { waitForHealth } from "./dev/health.ts";
import { prefixLines } from "./dev/log.ts";
import { markerIsCurrent, readMarker } from "./dev/marker.ts";
import { repoRoot } from "./dev/paths.ts";

function pipeWithPrefix(child: Subprocess, prefix: string): void {
	const stream = (
		readable: ReadableStream<Uint8Array> | null,
		write: (s: string) => void,
	) => {
		if (!readable) return;
		void (async () => {
			const reader = readable.getReader();
			let buffer = "";
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += new TextDecoder().decode(value);
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) {
						if (line.length > 0) write(prefixLines(prefix, line));
					}
				}
				if (buffer.length > 0) write(prefixLines(prefix, buffer));
			} catch {
				// stream closed
			}
		})();
	};

	stream(child.stdout, (s) => process.stdout.write(`${s}\n`));
	stream(child.stderr, (s) => process.stderr.write(`${s}\n`));
}

function printStatusTable(): void {
	console.log("\nTalash dev stack");
	console.log("────────────────");
	for (const svc of DEV_SERVICES) {
		const url = svc.url ?? "—";
		console.log(`  ${svc.label.padEnd(22)} ${url}`);
	}
	console.log("\nPress Ctrl+C to stop all services.\n");
}

const root = repoRoot();
const marker = await readMarker(root);
if (!markerIsCurrent(marker)) {
	const proc = Bun.spawn(["bun", "scripts/dev-setup.ts"], {
		cwd: root,
		stdio: ["inherit", "inherit", "inherit"],
	});
	if ((await proc.exited) !== 0) process.exit(1);
}

type ChildProcess = { child: Subprocess; label: string };
const children: ChildProcess[] = [];

const abort = () => {
	for (const { child } of children) child.kill();
	process.exit(0);
};

process.on("SIGINT", abort);
process.on("SIGTERM", abort);

function spawnService(svc: DevService): void {
	const child = Bun.spawn(svc.command, {
		cwd: root,
		stdout: "pipe",
		stderr: "pipe",
	});
	pipeWithPrefix(child, svc.prefix);
	children.push({ child, label: svc.label });
	child.exited.then((code) => {
		if (code !== 0) {
			console.error(`[dev:all] ${svc.label} exited with code ${code}`);
		}
		abort();
	});
}

for (const svc of DEV_SERVICES.filter((s) => !s.waitForHealth)) {
	spawnService(svc);
}

await waitForHealth(API_HEALTH_URL, {
	timeoutMs: HEALTH_TIMEOUT_MS,
	pollMs: HEALTH_POLL_MS,
});

for (const svc of DEV_SERVICES.filter((s) => s.waitForHealth)) {
	spawnService(svc);
}

printStatusTable();

await Promise.race(children.map(({ child }) => child.exited));
abort();
