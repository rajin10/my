import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface Props {
	children: React.ReactNode;
	fallbackTitle?: string;
}

interface State {
	error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	render() {
		if (!this.state.error) return this.props.children;
		return (
			<View className="flex-1 items-center justify-center p-8 bg-paper">
				<Text style={{ fontSize: 36, marginBottom: 12 }}>⚠️</Text>
				<Text
					className="text-ink-900 text-center font-bold"
					style={{ fontSize: 17, marginBottom: 8 }}
				>
					{this.props.fallbackTitle ?? "Something went wrong"}
				</Text>
				<Text
					className="text-ink-500 text-center"
					style={{ fontSize: 14, lineHeight: 22, marginBottom: 24 }}
				>
					{this.state.error.message}
				</Text>
				<TouchableOpacity
					onPress={() => this.setState({ error: null })}
					className="rounded-md bg-primary-600"
					style={{ paddingVertical: 12, paddingHorizontal: 24 }}
				>
					<Text className="text-white font-bold" style={{ fontSize: 15 }}>
						Try again
					</Text>
				</TouchableOpacity>
			</View>
		);
	}
}
