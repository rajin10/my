import { Icon } from "./icon";

export function Empty({ icon, text }: { icon: string; text: string }) {
	return (
		<div className="flex flex-col items-center gap-3 py-12 text-ink-400">
			<Icon name={icon} size={30} className="text-ink-300" />
			<span className="text-sm">{text}</span>
		</div>
	);
}
