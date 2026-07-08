import { useApp } from "@/context";
import { ownerCatalogExperience } from "@/lib/ownerExperiences";

/**
 * Catalog tab. The route name stays `services` for both verticals (so booking
 * navigation/deep-links are byte-unchanged), but the rendered screen is chosen
 * from the per-vertical registry (ADR-0004) — Services for booking, Products
 * for commerce. Never branch on `vertical` here; register it in the map.
 */
export default function CatalogTab() {
	const { business } = useApp();
	const Screen = ownerCatalogExperience[business.vertical].Screen;
	return <Screen />;
}
