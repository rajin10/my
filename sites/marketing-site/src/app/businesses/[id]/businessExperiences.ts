import type { BusinessVertical } from "@repo/api-client";
import type { ComponentType } from "react";
import { BookingBusinessClient } from "./BookingBusinessClient";
import { CommerceBusinessClient } from "./CommerceBusinessClient";

/**
 * Per-vertical customer experience for a business detail page (ADR-0004).
 *
 * `booking` (salon/spa) renders the existing appointment client; `commerce` (LPG)
 * renders its ordering client (placeholder until #71+). Add a vertical here — never
 * branch on `vertical` inside a client component.
 */
export const customerBusinessExperience: Record<
	BusinessVertical,
	ComponentType<{ id: string }>
> = {
	booking: BookingBusinessClient,
	commerce: CommerceBusinessClient,
};
