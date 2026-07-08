import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { money, type Product } from "../../data";
import { useDeleteProductPhoto } from "../../hooks/useOwnerData";
import { api } from "../../lib/api";
import { Colors, Radius, Shadow } from "../../tokens";
import { BranchSwitcher, Card, Icon, TabHeader } from "../ui";

function IconButton({
	icon,
	onPress,
}: {
	icon: keyof typeof import("lucide-react-native");
	onPress: () => void;
}) {
	return (
		<TouchableOpacity
			onPress={onPress}
			className="items-center justify-center border border-line bg-surface"
			style={{ width: 34, height: 34, borderRadius: 17 }}
		>
			<Icon name={icon} size={15} color={Colors.ink500} />
		</TouchableOpacity>
	);
}

function StockPill({ stock }: { stock: number }) {
	const out = stock <= 0;
	const low = stock > 0 && stock <= 5;
	const bg = out ? "#FBE9E7" : low ? "#FFF4E5" : "#E8F2EE";
	const fg = out ? "#B3261E" : low ? "#9A6700" : "#0B5C4B";
	const label = out ? "Out of stock" : `${stock} in stock`;
	return (
		<View
			className="flex-row items-center self-start rounded-full"
			style={{
				backgroundColor: bg,
				paddingHorizontal: 9,
				paddingVertical: 3,
				gap: 4,
			}}
		>
			<Icon name="Package" size={13} color={fg} />
			<Text style={{ fontSize: 12, fontWeight: "600", color: fg }}>
				{label}
			</Text>
		</View>
	);
}

function ProductCard({ p }: { p: Product }) {
	const qc = useQueryClient();
	const { setSheet, removeProduct, flash } = useApp();
	const deletePhotoMut = useDeleteProductPhoto();

	async function pickAndUpload() {
		const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!perm.granted) {
			flash("Camera roll permission required", { tone: "danger" });
			return;
		}
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: true,
			aspect: [4, 3],
			quality: 0.8,
		});
		if (result.canceled || !result.assets[0]) return;
		const asset = result.assets[0];
		const formData = new FormData();
		formData.append("file", {
			uri: asset.uri,
			name: asset.fileName ?? "photo.jpg",
			type: asset.mimeType ?? "image/jpeg",
		} as unknown as Blob);
		try {
			await api.products.uploadPhoto(p.id, formData);
			await qc.invalidateQueries({ queryKey: ["business-products"] });
			flash("Photo uploaded", { tone: "success", icon: "Image" });
		} catch (e: unknown) {
			flash((e as Error).message ?? "Upload failed", { tone: "danger" });
		}
	}

	return (
		<Card onPress={() => setSheet({ type: "addProduct", product: p })} pad={0}>
			{p.photoUrl ? (
				<Image
					source={{ uri: p.photoUrl }}
					style={{
						width: "100%",
						height: 120,
						borderTopLeftRadius: Radius.lg,
						borderTopRightRadius: Radius.lg,
					}}
					contentFit="cover"
				/>
			) : (
				<TouchableOpacity
					onPress={pickAndUpload}
					className="flex-row items-center justify-center border-b border-line-soft bg-primary-50"
					style={{
						height: 56,
						borderTopLeftRadius: Radius.lg,
						borderTopRightRadius: Radius.lg,
						gap: 7,
					}}
				>
					<Icon name="ImagePlus" size={16} color={Colors.primary600} />
					<Text
						className="text-primary-600 font-semibold"
						style={{ fontSize: 13 }}
					>
						Add photo
					</Text>
				</TouchableOpacity>
			)}
			<View style={{ padding: 15 }}>
				<View
					className="flex-row items-start justify-between"
					style={{ gap: 12 }}
				>
					<View className="flex-1 min-w-0">
						{p.category ? (
							<View
								className="bg-primary-50 rounded-full self-start"
								style={{
									paddingHorizontal: 9,
									paddingVertical: 3,
									marginBottom: 6,
								}}
							>
								<Text
									className="text-primary-700 font-semibold"
									style={{ fontSize: 11.5 }}
								>
									{p.category}
								</Text>
							</View>
						) : null}
						<View className="flex-row items-center" style={{ gap: 8 }}>
							<Text
								className="text-ink-900 font-bold"
								style={{ fontSize: 15.5 }}
							>
								{p.name}
							</Text>
							{p.status === "Inactive" ? (
								<View
									className="bg-line rounded-full self-start"
									style={{ paddingHorizontal: 7, paddingVertical: 2 }}
								>
									<Text
										className="text-ink-500 font-semibold"
										style={{ fontSize: 10.5 }}
									>
										Inactive
									</Text>
								</View>
							) : null}
						</View>
						{p.desc ? (
							<Text
								className="text-ink-500"
								style={{ fontSize: 13, marginTop: 3, lineHeight: 20 }}
							>
								{p.desc}
							</Text>
						) : null}
						<View
							className="flex-row items-center"
							style={{ gap: 12, marginTop: 10 }}
						>
							<StockPill stock={p.stock} />
							<Text
								className="text-ink-900 font-bold"
								style={{ fontSize: 14.5 }}
							>
								{money(p.price)}
							</Text>
						</View>
					</View>
					<View className="flex-row items-center shrink-0" style={{ gap: 8 }}>
						{p.photoUrl ? (
							<>
								<IconButton icon="ImagePlus" onPress={pickAndUpload} />
								<IconButton
									icon="ImageOff"
									onPress={() =>
										deletePhotoMut.mutate(p.id, {
											onSuccess: () =>
												flash("Photo removed", { tone: "success" }),
											onError: (e: unknown) =>
												flash((e as Error).message ?? "Failed", {
													tone: "danger",
												}),
										})
									}
								/>
							</>
						) : null}
						<IconButton
							icon="Pencil"
							onPress={() => setSheet({ type: "addProduct", product: p })}
						/>
						<IconButton icon="Trash2" onPress={() => removeProduct(p.id)} />
					</View>
				</View>
			</View>
		</Card>
	);
}

export default function ProductsScreen() {
	const insets = useSafeAreaInsets();
	const { products, branch, setBranch, business, setSheet } = useApp();

	const inBranch = (p: Product) =>
		branch === "All branches" || p.branch === branch;
	const scoped = products.filter(inBranch);
	const groups = business.branches
		.filter((br) => branch === "All branches" || br === branch)
		.map((br) => ({
			branch: br,
			items: scoped.filter((p) => p.branch === br),
		}));

	return (
		<View className="flex-1 bg-paper">
			<TabHeader
				title="Products"
				action="Add product"
				actionIcon="Plus"
				onAction={() => setSheet({ type: "addProduct" })}
				topInset={insets.top}
			/>
			<View className="pt-2">
				<BranchSwitcher
					branches={business.branches}
					active={branch}
					onPick={setBranch}
				/>
			</View>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 18,
					paddingBottom: 32,
					gap: 22,
				}}
			>
				{groups.map((g) => (
					<View key={g.branch}>
						<View
							className="flex-row items-center"
							style={{ gap: 6, marginBottom: 11 }}
						>
							<Icon name="MapPin" size={15} color={Colors.primary600} />
							<Text className="text-ink-700 font-bold" style={{ fontSize: 13 }}>
								{g.branch}
							</Text>
							<Text className="text-ink-400" style={{ fontSize: 12.5 }}>
								· {g.items.length}
							</Text>
						</View>
						{g.items.length === 0 ? (
							<View
								className="bg-surface border border-line rounded-lg"
								style={{ padding: 18, ...Shadow.sm }}
							>
								<Text
									className="text-ink-500 text-center"
									style={{ fontSize: 13.5 }}
								>
									No products at this branch yet.
								</Text>
							</View>
						) : (
							<View style={{ gap: 11 }}>
								{g.items.map((p) => (
									<ProductCard key={p.id} p={p} />
								))}
							</View>
						)}
					</View>
				))}
			</ScrollView>
		</View>
	);
}
