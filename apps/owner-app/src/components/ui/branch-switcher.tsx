import { Icon } from "@repo/ui-native";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { cn } from "../../lib/cn";
import { Colors } from "../../tokens";

export type BranchSwitcherProps = {
	branches: string[];
	active: string;
	onPick: (branch: string) => void;
	className?: string;
};

export function BranchSwitcher({
	branches,
	active,
	onPick,
	className,
}: BranchSwitcherProps) {
	const all = ["All branches", ...branches];
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
			className={className}
		>
			{all.map((b) => {
				const on = b === active;
				return (
					<TouchableOpacity
						key={b}
						onPress={() => onPick(b)}
						className={cn(
							"shrink-0 flex-row items-center rounded-full border",
							on
								? "border-transparent bg-primary-900"
								: "border-line-strong bg-surface",
						)}
						style={{ paddingVertical: 8, paddingHorizontal: 15, gap: 6 }}
					>
						{b !== "All branches" && (
							<Icon
								name="MapPin"
								sizePx={13}
								color={on ? "#fff" : Colors.ink700}
							/>
						)}
						<Text
							style={{
								fontSize: 13.5,
								fontWeight: "600",
								color: on ? "#fff" : Colors.ink700,
							}}
						>
							{b}
						</Text>
					</TouchableOpacity>
				);
			})}
		</ScrollView>
	);
}
