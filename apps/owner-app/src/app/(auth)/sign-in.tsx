import AuthScreen from "@/components/AuthScreen";
import { useApp } from "@/context";

export default function SignInRoute() {
	const { handleAuthed } = useApp();
	return <AuthScreen onAuthed={handleAuthed} />;
}
