export type Locale = "en" | "bn";

const en = {
	"nav.forBusiness": "For business",
	"nav.getApp": "Get the app",
	"footer.download": "Download the app",
} as const;

const bn: Record<keyof typeof en, string> = {
	"nav.forBusiness": "ব্যবসার জন্য",
	"nav.getApp": "অ্যাপ ডাউনলোড",
	"footer.download": "অ্যাপ ডাউনলোড করুন",
};

export type MessageKey = keyof typeof en;

function resolveLocale(): Locale {
	if (typeof navigator === "undefined") return "en";
	const lang = navigator.language.toLowerCase();
	return lang.startsWith("bn") ? "bn" : "en";
}

export function t(key: MessageKey): string {
	const locale = resolveLocale();
	return locale === "bn" ? bn[key] : en[key];
}
