import { ScrollView, Text, TouchableOpacity } from "react-native";
import { cn } from "../../lib/cn";
import { Colors } from "../../tokens";

export type FilterTab = string | { id: string; label: string; count?: number };

export type FilterTabsProps = {
	tabs: FilterTab[];
	active: string;
	onPick: (id: string) => void;
	className?: string;
};

export function FilterTabs({
	tabs,
	active,
	onPick,
	className,
}: FilterTabsProps) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={{ gap: 7, paddingHorizontal: 16 }}
			className={className}
		>
			{tabs.map((t) => {
				const id = typeof t === "string" ? t : t.id;
				const label = typeof t === "string" ? t : t.label;
				const count = typeof t === "string" ? undefined : t.count;
				const on = id === active;
				return (
					<TouchableOpacity
						key={id}
						onPress={() => onPick(id)}
						className={cn(
							"flex-row items-center rounded-full border",
							on
								? "bg-primary-100 border-primary-200"
								: "bg-transparent border-line",
						)}
						style={{ paddingVertical: 8, paddingHorizontal: 14, gap: 6 }}
					>
						<Text
							style={{
								fontSize: 13.5,
								fontWeight: "600",
								color: on ? Colors.primary700 : Colors.ink500,
							}}
						>
							{label}
						</Text>
						{count != null && count > 0 && (
							<Text
								style={{
									fontSize: 11.5,
									fontWeight: "700",
									color: on ? Colors.primary700 : Colors.ink400,
								}}
							>
								{count}
							</Text>
						)}
					</TouchableOpacity>
				);
			})}
		</ScrollView>
	);
}
