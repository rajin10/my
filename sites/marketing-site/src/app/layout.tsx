import { readAuthInitialState } from "@repo/api-client";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Providers } from "../components/Providers";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: {
		default: "Talash — Discover and book services near you",
		template: "%s | Talash",
	},
	description:
		"The considered way to discover and book salons, spas, studios and clinics near you — in seconds, from anywhere.",
	openGraph: {
		type: "website",
		locale: "en_BD",
		siteName: "Talash",
		images: [{ url: "/og-default.svg", width: 1200, height: 630 }],
	},
	twitter: {
		card: "summary_large_image",
	},
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const initialAuth = readAuthInitialState(await cookies());

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<link rel="icon" href="/talash-mark.svg" type="image/svg+xml" />
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin="anonymous"
				/>
			</head>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<Providers initialAuth={initialAuth}>{children}</Providers>
			</body>
		</html>
	);
}
