import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { BusinessRouteShell } from "@/components/BusinessRouteShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useApp } from "@/context";
import { useBusinessDetail } from "@/hooks/useBusinessDetail";
import { customerBusinessExperience } from "@/lib/businessExperiences";

function resolveRouteId(id: string | string[] | undefined): string | undefined {
	if (typeof id === "string") return id;
	if (Array.isArray(id) && id[0]) return id[0];
	return undefined;
}

export default function BusinessRoute() {
	const params = useLocalSearchParams<{ id?: string | string[] }>();
	const routeId = resolveRouteId(params.id);
	const { selectedBusiness, primeBusiness } = useApp();
	const businessId = routeId ?? selectedBusiness?.id;
	const detailQuery = useBusinessDetail(businessId);

	useEffect(() => {
		if (detailQuery.data) primeBusiness(detailQuery.data);
	}, [detailQuery.data, primeBusiness]);

	if (!businessId) {
		return <BusinessRouteShell kind="missing" />;
	}

	if (detailQuery.isError && !detailQuery.data) {
		return (
			<BusinessRouteShell kind="error" onRetry={() => detailQuery.refetch()} />
		);
	}

	if (!selectedBusiness) {
		return <BusinessRouteShell kind="loading" />;
	}

	// Render the experience for this business's vertical (ADR-0004). The freshly
	// loaded detail is authoritative; fall back to the primed business, then booking.
	const vertical =
		detailQuery.data?.vertical ?? selectedBusiness.vertical ?? "booking";
	const Experience = customerBusinessExperience[vertical];

	// Single-tenant reskin (#60): the whole venue detail + booking subtree renders
	// in the venue's brand. The freshly loaded detail is authoritative; fall back
	// to the primed business. `null` ⇒ Talash defaults — the boundary never leaks
	// into the cross-venue list screens that sit outside this route.
	const palette =
		detailQuery.data?.brandPalette ?? selectedBusiness.brandPalette ?? null;
	return (
		<ThemeProvider palette={palette}>
			<Experience />
		</ThemeProvider>
	);
}
