import { SESSION_HINT_COOKIE } from "@repo/api-client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
	const hasSession = request.cookies.get(SESSION_HINT_COOKIE)?.value === "1";
	const { pathname } = request.nextUrl;

	if (!hasSession) {
		const login = new URL("/login", request.url);
		login.searchParams.set("next", pathname);
		return NextResponse.redirect(login);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/account", "/account/:path*", "/bookings/:path*"],
};
