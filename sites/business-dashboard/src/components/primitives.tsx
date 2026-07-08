"use client";
import { Badge } from "@repo/ui";

// Generic primitives live in @repo/ui — re-exported here for backward compat
export {
	Avatar,
	Badge,
	Button,
	Card,
	cn,
	Empty,
	Field,
	Icon,
	inputClass,
	Modal,
	PageHeader,
	Stars,
	StatCard,
	Tabs,
} from "@repo/ui";

// ---- Dashboard-specific ----

type Status =
	| "Pending"
	| "Confirmed"
	| "Cancelled"
	| "Completed"
	| "Active"
	| "Draft"
	| "Published"
	| "Expired";

const STATUS_VARIANT: Record<
	Status,
	"pending" | "success" | "danger" | "default"
> = {
	Pending: "pending",
	Confirmed: "success",
	Cancelled: "danger",
	Completed: "success",
	Active: "success",
	Draft: "default",
	Published: "success",
	Expired: "default",
};

export function StatusPill({ status }: { status: string }) {
	const variant = STATUS_VARIANT[status as Status] ?? "default";
	return (
		<Badge variant={variant} dot>
			{status}
		</Badge>
	);
}

export function ScreenSkeleton({
	rows = 2,
	cards = 4,
}: {
	rows?: number;
	cards?: number;
}) {
	return (
		<div>
			<div className="h-8 w-48 rounded-md bg-line animate-pulse mb-1.5" />
			<div className="h-4 w-72 rounded-md bg-line animate-pulse mb-7" />
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
				{Array.from({ length: cards }).map((_, i) => (
					<div key={i} className="h-24 rounded-xl bg-line animate-pulse" />
				))}
			</div>
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="h-48 rounded-xl bg-line animate-pulse mb-4" />
			))}
		</div>
	);
}
