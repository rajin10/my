import { APP_VERSION } from "@/lib/version";

export function AppFooter() {
	return (
		<footer className="shrink-0 border-t border-line px-4 md:px-8 py-3 font-sans text-xs text-ink-400">
			v{APP_VERSION}
		</footer>
	);
}
