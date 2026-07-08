"use client";
import { useRouter } from "next/navigation";
import { BusinessGrid } from "./BusinessGrid";
import { CategoryStrip } from "./CategoryStrip";
import { Hero } from "./Hero";

interface SearchSectionProps {
	q: string;
	category: string | null;
	city: string | null;
}

/**
 * Reads the active filters from props (the server page derives them from the
 * URL) rather than `useSearchParams()`, so the Hero + grid render server-side
 * instead of being excluded by Next's client-side-rendering bailout.
 */
export function SearchSection({ q, category, city }: SearchSectionProps) {
	const router = useRouter();

	function go(params: URLSearchParams) {
		const qs = params.toString();
		router.push(qs ? `/?${qs}` : "/");
	}

	function handleSearch(query: string) {
		// Free-text search keeps the city but clears the active category.
		const params = new URLSearchParams();
		if (query) params.set("q", query);
		if (city) params.set("city", city);
		go(params);
	}

	function handleCategory(cat: string | null) {
		const params = new URLSearchParams();
		if (q) params.set("q", q);
		if (cat) params.set("category", cat);
		if (city) params.set("city", city);
		go(params);
	}

	return (
		<>
			<Hero onSearch={handleSearch} />
			<CategoryStrip active={category} onPick={handleCategory} />
			<BusinessGrid query={q} category={category} city={city} />
		</>
	);
}
