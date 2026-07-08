"use client";
import { CampaignsScreen } from "@/components/screens/CampaignsScreen";
import { useMyBusiness } from "@/hooks/useOwnerData";

export default function CampaignsPage() {
	const businessQ = useMyBusiness();
	return <CampaignsScreen businessId={businessQ.data?.id ?? null} />;
}
