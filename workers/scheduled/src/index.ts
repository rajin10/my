import { handleScheduled } from "./handler";

export default {
	scheduled: handleScheduled,
} satisfies ExportedHandler<CloudflareBindings>;
