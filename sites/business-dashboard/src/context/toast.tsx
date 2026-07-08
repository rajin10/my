"use client";
import {
	createContext,
	type ReactNode,
	useContext,
	useRef,
	useState,
} from "react";

export type ToastState = { msg: string; icon?: string } | null;

type ToastCtx = {
	toast: ToastState;
	flash: (msg: string, icon?: string) => void;
};

const Ctx = createContext<ToastCtx>({ toast: null, flash: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<ToastState>(null);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

	function flash(msg: string, icon?: string) {
		setToast({ msg, icon });
		clearTimeout(timer.current);
		timer.current = setTimeout(() => setToast(null), 2600);
	}

	return <Ctx.Provider value={{ toast, flash }}>{children}</Ctx.Provider>;
}

export function useToast() {
	return useContext(Ctx);
}
