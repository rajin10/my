"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CustomersScreen } from "@/components/screens/CustomersScreen";
import { useMyBusiness } from "@/hooks/useOwnerData";

function CustomersPageInner() {
	const businessQ = useMyBusiness();
	const searchParams = useSearchParams();
	const initialSearch = searchParams.get("search") ?? "";
	return (
		<CustomersScreen
			businessId={businessQ.data?.id ?? null}
			initialSearch={initialSearch}
		/>
	);
}

export default function CustomersPage() {
	return (
		<Suspense>
			<CustomersPageInner />
		</Suspense>
	);
}
