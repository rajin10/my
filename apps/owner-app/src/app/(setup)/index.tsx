import SetupFlow from "@/components/SetupFlow";
import { useApp } from "@/context";

export default function SetupRoute() {
	const { contact, signOut, goLive } = useApp();
	return <SetupFlow contact={contact} onCancel={signOut} onComplete={goLive} />;
}
