import * as Localization from "expo-localization";

export type Locale = "en" | "bn";

const en = {
	"search.placeholder": "Search services, businesses, places",
	"search.noResults": "No results",
	"search.nearYou": "Near you",
	"search.editorsPicks": "Editor's picks",
	"bookings.title": "My bookings",
	"bookings.upcoming": "Upcoming",
	"bookings.past": "Past",
	"bookings.cancel": "Cancel booking",
	"bookings.cancelConfirm": "Cancel booking?",
	"bookings.empty.upcoming": "No upcoming bookings",
	"bookings.empty.past": "Nothing here yet",
	"account.title": "Account",
	"account.signIn": "Sign in to Talash",
	"account.signOut": "Sign out",
	"account.editProfile": "Edit profile",
	"account.notifications": "Notifications",
	"account.payments": "Payment methods",
	"rewards.title": "Rewards",
	"rewards.balance": "Your balance",
	"rewards.history": "History",
	"booking.confirmTitle": "Confirm your booking",
	"booking.closedDay":
		"This branch is closed on the selected day. Pick another date or branch.",
	"booking.noSlots": "No slots available for this date.",
	"booking.confirm": "Confirm booking",
	"booking.confirming": "Confirming…",
	"common.leaveReview": "Leave a review",
	"common.findService": "Find a service",
	"common.getStarted": "Get started",
	"common.continue": "Continue",
	"common.skip": "Skip",
	"common.save": "Save changes",
	"common.cancel": "Cancel",
	"common.confirm": "Confirm",
	"common.retry": "Try again",
} as const;

const bn: Record<keyof typeof en, string> = {
	"search.placeholder": "সেবা, ভেন্যু বা এলাকা খুঁজুন",
	"search.noResults": "কোনো ফলাফল নেই",
	"search.nearYou": "আপনার কাছে",
	"search.editorsPicks": "সম্পাদকের পছন্দ",
	"bookings.title": "আমার বুকিং",
	"bookings.upcoming": "আসন্ন",
	"bookings.past": "অতীত",
	"bookings.cancel": "বুকিং বাতিল",
	"bookings.cancelConfirm": "বুকিং বাতিল করবেন?",
	"bookings.empty.upcoming": "কোনো আসন্ন বুকিং নেই",
	"bookings.empty.past": "এখনও কিছু নেই",
	"account.title": "অ্যাকাউন্ট",
	"account.signIn": "Talash-এ সাইন ইন করুন",
	"account.signOut": "সাইন আউট",
	"account.editProfile": "প্রোফাইল সম্পাদনা",
	"account.notifications": "নোটিফিকেশন",
	"account.payments": "পেমেন্ট পদ্ধতি",
	"rewards.title": "রিওয়ার্ড",
	"rewards.balance": "আপনার ব্যালেন্স",
	"rewards.history": "ইতিহাস",
	"booking.confirmTitle": "বুকিং নিশ্চিত করুন",
	"booking.closedDay": "নির্বাচিত দিনে এই শাখা বন্ধ। অন্য তারিখ বা শাখা বেছে নিন।",
	"booking.noSlots": "এই তারিখে কোনো স্লট নেই।",
	"booking.confirm": "বুকিং নিশ্চিত করুন",
	"booking.confirming": "নিশ্চিত হচ্ছে…",
	"common.leaveReview": "রিভিউ দিন",
	"common.findService": "সেবা খুঁজুন",
	"common.getStarted": "শুরু করুন",
	"common.continue": "চালিয়ে যান",
	"common.skip": "এড়িয়ে যান",
	"common.save": "পরিবর্তন সংরক্ষণ",
	"common.cancel": "বাতিল",
	"common.confirm": "নিশ্চিত",
	"common.retry": "আবার চেষ্টা করুন",
};

export type MessageKey = keyof typeof en;

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, bn };

let activeLocale: Locale = resolveDeviceLocale();

function resolveDeviceLocale(): Locale {
	const tag = Localization.getLocales()[0]?.languageCode ?? "en";
	return tag === "bn" ? "bn" : "en";
}

export function getLocale(): Locale {
	return activeLocale;
}

export function setLocale(locale: Locale): void {
	activeLocale = locale;
}

export function refreshLocaleFromDevice(): void {
	activeLocale = resolveDeviceLocale();
}

export function t(key: MessageKey): string {
	return catalogs[activeLocale][key] ?? catalogs.en[key];
}
