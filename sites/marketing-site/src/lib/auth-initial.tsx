"use client";

import type { AuthInitialState } from "@repo/api-client";
import { createContext, useContext } from "react";

const defaultState: AuthInitialState = { hasSession: false, user: null };

const AuthInitialContext = createContext<AuthInitialState>(defaultState);

export function AuthInitialProvider({
	value,
	children,
}: {
	value: AuthInitialState;
	children: React.ReactNode;
}) {
	return (
		<AuthInitialContext.Provider value={value}>
			{children}
		</AuthInitialContext.Provider>
	);
}

export function useAuthInitial(): AuthInitialState {
	return useContext(AuthInitialContext);
}
