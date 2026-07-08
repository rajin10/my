import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://talash.app";

export default function sitemap(): MetadataRoute.Sitemap {
	const lastModified = new Date();
	const routes = [
		"",
		"/search",
		"/download",
		"/login",
		"/for-business",
		"/privacy",
		"/terms",
	];

	return routes.map((path) => ({
		url: `${siteUrl}${path}`,
		lastModified,
		changeFrequency: path === "" ? "daily" : "weekly",
		priority: path === "" ? 1 : 0.7,
	}));
}
