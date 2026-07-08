import type { BusinessVertical } from "@repo/api-client";
import type { ComponentType } from "react";
import BusinessScreen from "@/components/screens/BusinessScreen";
import CommerceBusinessScreen from "@/components/screens/CommerceBusinessScreen";

/**
 * Per-vertical customer experience for a business detail view (ADR-0004).
 *
 * The booking vertical (salon/spa) renders the existing appointment screen;
 * the commerce vertical (LPG) renders its own ordering screen. To add a vertical,
 * register its screen here — never branch on `vertical` inside a route or screen.
 */
export const customerBusinessExperience: Record<
	BusinessVertical,
	ComponentType
> = {
	booking: BusinessScreen,
	commerce: CommerceBusinessScreen,
};
