import { handleQueue } from "./handler";

export default {
	// biome-ignore lint/suspicious/noExplicitAny: queue message type narrowed at runtime
	queue: handleQueue as any,
} satisfies ExportedHandler<CloudflareBindings>;
