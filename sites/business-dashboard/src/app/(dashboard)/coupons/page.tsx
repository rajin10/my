"use client";
import { useQueryClient } from "@tanstack/react-query";
import type { Coupon } from "@/components/data";
import { CouponsScreen } from "@/components/screens/CouponsScreen";
import { useToast } from "@/context/toast";
import { useCoupons, useCreateCoupon, useMyBusiness } from "@/hooks/useOwnerData";
import { adaptCoupon } from "@/lib/adapters";
import { api } from "@/lib/api";

export default function CouponsPage() {
	const { flash } = useToast();
	const qc = useQueryClient();

	const businessQuery = useMyBusiness();
	const businessId = businessQuery.data?.id ?? null;
	const couponsQuery = useCoupons(businessId);
	const coupons = (couponsQuery.data?.data ?? []).map(adaptCoupon);

	const createCouponMut = useCreateCoupon();

	function handleCreateCoupon(c: Coupon) {
		if (!businessId) return;
		const fallback = new Date();
		fallback.setFullYear(fallback.getFullYear() + 1);
		const expiresAt = c.expires
			? new Date(c.expires).toISOString()
			: fallback.toISOString();
		createCouponMut.mutate(
			{
				businessId,
				code: c.code,
				type: c.type,
				value: c.value,
				maxUses: c.max,
				expiresAt,
			},
			{
				onSuccess: () => flash("Coupon created", "Ticket"),
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	function deactivateCoupon(id: string) {
		api.coupons
			.delete(id)
			.then(() => {
				qc.invalidateQueries({ queryKey: ["coupons"] });
				flash("Coupon deactivated", "Ticket");
			})
			.catch((e: Error) => flash(e.message));
	}

	return (
		<CouponsScreen
			coupons={coupons}
			onCreate={handleCreateCoupon}
			onDeactivate={deactivateCoupon}
		/>
	);
}
