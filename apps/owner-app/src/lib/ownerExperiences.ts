import type { BusinessVertical } from "@repo/api-client";
import type { ComponentType } from "react";
import ProductsScreen from "../components/screens/ProductsScreen";
import ServicesScreen from "../components/screens/ServicesScreen";
import type { IconName } from "../components/ui";

/**
 * Per-vertical catalog experience an owner manages (ADR-0004).
 *
 * The owner-app manages a single business, so its `vertical` selects which
 * catalog the third tab renders: `booking` owners manage Services, `commerce`
 * owners manage Products. The tab's `name` (route) stays `services` for both so
 * booking deep-links/navigation are byte-unchanged — only the label, icon, and
 * rendered screen switch. To add a vertical, register it here — never branch on
 * `vertical` inside a screen or the tab layout.
 */
export interface OwnerCatalogExperience {
	tab: { label: string; icon: IconName };
	Screen: ComponentType;
}

export const ownerCatalogExperience: Record<
	BusinessVertical,
	OwnerCatalogExperience
> = {
	booking: {
		tab: { label: "Services", icon: "Sparkles" },
		Screen: ServicesScreen,
	},
	commerce: {
		tab: { label: "Products", icon: "Package" },
		Screen: ProductsScreen,
	},
};
