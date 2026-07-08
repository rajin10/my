import type { BrandPalette } from "@repo/api-client";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ColorPicker, {
	BrightnessSlider,
	HueCircular,
} from "reanimated-color-picker";
import { useApp } from "../../context";
import { useBrandPalette, useSaveBrandPalette } from "../../hooks/useOwnerData";
import {
	DEFAULT_PALETTE_SEEDS,
	PALETTE_ROLES,
	palettesEqual,
} from "../../lib/branding";
import { ThemeProvider } from "../ThemeProvider";
import { BackHeader, Button, Card } from "../ui";

const ROLE_LABELS: Record<(typeof PALETTE_ROLES)[number], string> = {
	primary: "Primary",
	accent: "Accent",
	foreground: "Foreground / text",
	surface: "Surface / background",
};

// A compact strip of themed sample components — repaints live as the owner edits,
// so they see how their booking flow will look. Wrapped in `ThemeProvider` so the
// themeable roles resolve the draft palette; status/ink roles stay Talash-static.
function PreviewStrip() {
	return (
		<Card>
			<Text className="text-ink-500" style={{ fontSize: 13, marginBottom: 10 }}>
				Live preview
			</Text>
			<View
				className="bg-surface rounded-2xl p-4 border border-line"
				style={{ gap: 12 }}
			>
				<Text className="text-primary font-bold" style={{ fontSize: 18 }}>
					Glow Spa
				</Text>
				<View className="flex-row items-center" style={{ gap: 8 }}>
					<View className="bg-accent rounded-full px-3 py-1">
						<Text className="text-ink-900" style={{ fontSize: 12 }}>
							Featured
						</Text>
					</View>
					<View className="bg-success-bg rounded-full px-3 py-1">
						<Text className="text-success-fg" style={{ fontSize: 12 }}>
							Confirmed
						</Text>
					</View>
				</View>
				<View className="bg-primary rounded-xl items-center py-3">
					<Text className="text-white font-semibold" style={{ fontSize: 15 }}>
						Book now
					</Text>
				</View>
			</View>
		</Card>
	);
}

export function BrandingScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { businessId, flash } = useApp();
	const saved = useBrandPalette();
	const save = useSaveBrandPalette(businessId);
	const [draft, setDraft] = useState<BrandPalette>(
		saved ?? DEFAULT_PALETTE_SEEDS,
	);

	const setRole = (role: (typeof PALETTE_ROLES)[number], hex: string) =>
		setDraft((d) => ({ ...d, [role]: hex }));

	const dirty = !palettesEqual(draft, saved ?? DEFAULT_PALETTE_SEEDS);

	// Surface the server's response — including the WCAG-AA contrast rejection
	// message from the save gate (#59) — so an unreadable palette fails loud.
	const persist = (palette: BrandPalette | null, okMsg: string) =>
		save.mutate(palette, {
			onSuccess: () => flash(okMsg, { tone: "success" }),
			onError: (e: Error) => flash(e.message, { tone: "danger" }),
		});

	return (
		<View className="flex-1 bg-paper">
			<BackHeader
				title="Brand & appearance"
				onBack={() => router.back()}
				topInset={insets.top}
			/>
			<ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
				<ThemeProvider palette={draft}>
					<PreviewStrip />
				</ThemeProvider>

				{PALETTE_ROLES.map((role) => (
					<Card key={role}>
						<View
							className="flex-row items-center justify-between"
							style={{ marginBottom: 12 }}
						>
							<Text
								className="text-ink-900 font-semibold"
								style={{ fontSize: 15 }}
							>
								{ROLE_LABELS[role]}
							</Text>
							<View
								className="rounded-full border border-line"
								style={{ width: 28, height: 28, backgroundColor: draft[role] }}
							/>
						</View>
						<ColorPicker
							value={draft[role]}
							onComplete={({ hex }) => setRole(role, hex)}
							style={{ alignItems: "center", gap: 16 }}
						>
							<HueCircular
								containerStyle={{ width: 180, height: 180 }}
								thumbShape="circle"
							>
								<BrightnessSlider />
							</HueCircular>
						</ColorPicker>
					</Card>
				))}

				<Button
					onPress={() => persist(draft, "Brand saved.")}
					disabled={!dirty || save.isPending}
				>
					Save brand
				</Button>
				<Button
					variant="quiet"
					onPress={() => persist(null, "Reverted to Talash default.")}
				>
					Reset to Talash default
				</Button>
			</ScrollView>
		</View>
	);
}
