import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "My account",
	description: "View and manage your Talash bookings and profile.",
};

export default function AccountLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
