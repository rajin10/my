const R = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

export const log = {
	info: (msg: string) => console.log(`${CYAN}ℹ${R} ${msg}`),
	success: (msg: string) => console.log(`${GREEN}✓${R} ${msg}`),
	warn: (msg: string) => console.log(`${YELLOW}⚠${R} ${msg}`),
	error: (msg: string) => console.error(`${RED}✗${R} ${msg}`),
	dim: (msg: string) => console.log(`${DIM}${msg}${R}`),
	step: (msg: string) => console.log(`  ${DIM}→${R} ${msg}`),

	table(rows: Array<[string, string | number]>, header?: [string, string]) {
		const col0 = Math.max(
			header ? header[0].length : 0,
			...rows.map(([k]) => k.length),
		);
		const col1 = Math.max(
			header ? header[1].length : 0,
			...rows.map(([, v]) => String(v).length),
		);

		const line = `  ${"─".repeat(col0 + col1 + 5)}`;
		console.log();
		if (header) {
			console.log(
				`  ${BOLD}${header[0].padEnd(col0)}${R}  ${BOLD}${header[1].padStart(col1)}${R}`,
			);
			console.log(line);
		}
		for (const [k, v] of rows) {
			const val = String(v);
			console.log(
				`  ${CYAN}${k.padEnd(col0)}${R}  ${GREEN}${val.padStart(col1)}${R}`,
			);
		}
		console.log();
	},
};
