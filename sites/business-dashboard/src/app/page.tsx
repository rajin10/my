"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { tokenStore } from "@/lib/api";

export default function Page() {
	const router = useRouter();
	useEffect(() => {
		router.replace(tokenStore.getAccessToken() ? "/overview" : "/login");
	}, [router]);
	return null;
}
