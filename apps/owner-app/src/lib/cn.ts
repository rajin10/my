// `cn` now lives in @repo/ui-native (the single source). This shim keeps the
// existing `@/lib/cn` import paths working app-wide; remove it once #64 adopts
// the shared package import directly.
export { cn } from "@repo/ui-native";
