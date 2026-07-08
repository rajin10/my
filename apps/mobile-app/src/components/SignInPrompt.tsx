import { router } from "expo-router";
import { EmptyState, type IconName } from "./ui";

type Props = {
	icon: IconName;
	title: string;
	body: string;
};

export function SignInPrompt({ icon, title, body }: Props) {
	return (
		<EmptyState
			icon={icon}
			title={title}
			body={body}
			cta="Sign in"
			onCta={() => router.navigate("/(tabs)/account")}
		/>
	);
}
