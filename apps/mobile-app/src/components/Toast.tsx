import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Radius, Shadow } from "../tokens";

export type ToastData = {
	message: string;
	tone?: "success" | "danger" | "info";
};

export interface ToastHandle {
	show: (data: ToastData) => void;
}

// Module-level singleton so any component can call toast.show(...)
let _handle: ToastHandle | null = null;

export const toast = {
	show: (data: ToastData) => _handle?.show(data),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [current, setCurrent] = useState<ToastData | null>(null);
	const opacity = useRef(new Animated.Value(0)).current;
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const insets = useSafeAreaInsets();

	const show = useCallback(
		(data: ToastData) => {
			if (timer.current) clearTimeout(timer.current);
			setCurrent(data);
			Animated.spring(opacity, {
				toValue: 1,
				useNativeDriver: true,
				speed: 20,
			}).start();
			timer.current = setTimeout(() => {
				Animated.timing(opacity, {
					toValue: 0,
					duration: 300,
					useNativeDriver: true,
				}).start(() => setCurrent(null));
			}, 2800);
		},
		[opacity],
	);

	useEffect(() => {
		_handle = { show };
		return () => {
			_handle = null;
		};
	}, [show]);

	const bg =
		current?.tone === "danger"
			? Colors.dangerFg
			: current?.tone === "success"
				? Colors.successFg
				: Colors.primary900;

	return (
		<>
			{children}
			{current && (
				<Animated.View
					style={[
						{
							position: "absolute",
							bottom: insets.bottom + 80,
							left: 16,
							right: 16,
							borderRadius: Radius.md,
							backgroundColor: bg,
							paddingVertical: 14,
							paddingHorizontal: 18,
							opacity,
						},
						Shadow.md,
					]}
					pointerEvents="none"
				>
					<Text
						style={{
							color: "#fff",
							fontSize: 14.5,
							fontWeight: "600",
							textAlign: "center",
						}}
					>
						{current.message}
					</Text>
				</Animated.View>
			)}
		</>
	);
}
