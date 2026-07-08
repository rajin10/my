import { Text } from "react-native";
import { useNetworkStatus } from "./use-network-status";

function formatRelativeTime(timestamp: number): string {
	const diffMs = Date.now() - timestamp;
	const diffMinutes = Math.floor(diffMs / 60_000);
	if (diffMinutes < 1) return "just now";
	if (diffMinutes < 60) {
		return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
	}
	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) {
		return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	}
	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

type StaleDataNoteProps = {
	dataUpdatedAt?: number;
};

/** Inline note when offline data may be stale. Hidden when online. */
export function StaleDataNote({ dataUpdatedAt }: StaleDataNoteProps) {
	const { isOnline } = useNetworkStatus();

	if (isOnline || !dataUpdatedAt) return null;

	return (
		<Text
			style={{
				fontSize: 12.5,
				color: "#8A5E0F",
				marginTop: 4,
				marginBottom: 8,
			}}
		>
			Saved · last updated {formatRelativeTime(dataUpdatedAt)}
		</Text>
	);
}
