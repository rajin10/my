type Level = "info" | "warn" | "error";
type LogCtx = Record<string, unknown>;

function emit(
	level: Level,
	worker: string,
	message: string,
	ctx?: LogCtx,
): void {
	const entry = JSON.stringify({
		level,
		worker,
		message,
		...(ctx ?? {}),
		ts: new Date().toISOString(),
	});
	if (level === "error") console.error(entry);
	else if (level === "warn") console.warn(entry);
	else console.log(entry);
}

export const logger = {
	info(worker: string, message: string, ctx?: LogCtx): void {
		emit("info", worker, message, ctx);
	},
	warn(worker: string, message: string, ctx?: LogCtx): void {
		emit("warn", worker, message, ctx);
	},
	error(worker: string, message: string, ctx?: LogCtx): void {
		emit("error", worker, message, ctx);
	},
};
