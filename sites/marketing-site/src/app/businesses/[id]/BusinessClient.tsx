"use client";
import { useQuery } from "@tanstack/react-query";
import { BrandThemeBoundary } from "@/components/BrandThemeBoundary";
import { api } from "@/lib/api";
import { businessQuery } from "@/lib/queries";
import { customerBusinessExperience } from "./businessExperiences";

/**
 * Business detail route entry. Resolves the business's `vertical` and delegates to
 * the matching per-vertical experience (ADR-0004) via the registry — booking renders
 * the appointment client, commerce the ordering client. Defaults to booking until the
 * fetch resolves, so the common case shows the booking experience's own skeleton.
 *
 * Single-tenant context, so the experience renders inside the venue's brand
 * boundary (#65): `bg-primary`/`bg-accent`/`bg-surface` repaint in the venue's
 * palette; `null` → Talash defaults. Static roles stay Talash.
 */
export function BusinessClient({ id }: { id: string }) {
	const { data } = useQuery(businessQuery(api, id));
	const vertical = data?.data?.vertical ?? "booking";
	const Experience = customerBusinessExperience[vertical];
	return (
		<BrandThemeBoundary palette={data?.data?.brandPalette ?? null}>
			<Experience id={id} />
		</BrandThemeBoundary>
	);
}
