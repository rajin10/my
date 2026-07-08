import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { api } from "@/lib/api";
import { tokenStore } from "@/lib/native-token-store";

export default function Index() {
	const hasToken = !!tokenStore.getAccessToken();

	const businessQuery = useQuery({
		queryKey: ["business", "owner"],
		queryFn: async () => {
			const res = await api.businesses.list({ limit: 1 });
			return res.data[0] ?? null;
		},
		enabled: hasToken,
		staleTime: 60_000,
	});

	if (!hasToken) return <Redirect href={"/(auth)/sign-in"} />;
	if (businessQuery.isLoading) return null;
	if (businessQuery.isError) return <Redirect href={"/(tabs)"} />;
	if (!businessQuery.data) return <Redirect href={"/(setup)/"} />;
	return <Redirect href={"/(tabs)"} />;
}
