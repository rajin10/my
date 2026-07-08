import { walkInAcceptedSchema, walkInSubmitSchema } from "./protocol";
import type { DiscoveredHub } from "./types";

function hubBaseUrl(hub: DiscoveredHub): string {
	return `http://${hub.host}:${hub.port}`;
}

function sessionHeader(sessionToken?: string): Record<string, string> {
	return sessionToken ? { "X-WalkIn-Session": sessionToken } : {};
}

export async function fetchHubContext(
	hub: DiscoveredHub,
	sessionToken?: string,
): Promise<unknown> {
	const res = await fetch(`${hubBaseUrl(hub)}/v1/context`, {
		headers: {
			Accept: "application/json",
			...sessionHeader(sessionToken),
		},
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as {
			message?: string;
		} | null;
		throw new Error(body?.message ?? `Hub context failed (${res.status})`);
	}
	return res.json();
}

export async function submitToHub(
	hub: DiscoveredHub,
	body: unknown,
	sessionToken?: string,
): Promise<{ localId: string; status: "accepted" }> {
	const parsed = walkInSubmitSchema.parse(body);
	const res = await fetch(`${hubBaseUrl(hub)}/v1/submit`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			...sessionHeader(sessionToken),
		},
		body: JSON.stringify(parsed),
	});
	if (!res.ok) {
		const errBody = (await res.json().catch(() => null)) as {
			message?: string;
		} | null;
		throw new Error(errBody?.message ?? `Hub submit failed (${res.status})`);
	}
	const data = await res.json();
	return walkInAcceptedSchema.parse(data);
}

export async function fetchHubStatus(
	hub: DiscoveredHub,
	localId: string,
	sessionToken?: string,
): Promise<{ status: string; serverId?: string }> {
	const res = await fetch(`${hubBaseUrl(hub)}/v1/status/${localId}`, {
		headers: {
			Accept: "application/json",
			...sessionHeader(sessionToken),
		},
	});
	if (!res.ok) {
		throw new Error(`Hub status failed (${res.status})`);
	}
	return res.json() as Promise<{ status: string; serverId?: string }>;
}
