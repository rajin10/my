import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind/NativeWind class names with conflict resolution.
 * Uses clsx for conditional logic and twMerge to deduplicate conflicting
 * utility classes (e.g. bg-primary-600 + bg-surface → bg-surface).
 *
 * Note: keep font-size as inline style — arbitrary text-[Npx] classes work
 * fine, but using cn() for them alongside color classes (text-ink-900) is
 * safe: twMerge treats them as different groups and keeps both.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
