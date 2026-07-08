import type { Metadata } from "next";
import SearchClient from "./SearchClient";

export const metadata: Metadata = {
	title: "Find a business",
	description:
		"Search and filter salons, spas, studios and clinics across Bangladesh.",
};

export default function SearchPage() {
	return <SearchClient />;
}
