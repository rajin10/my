import type { WalkInSubmitBody } from "@repo/api-client";
import { WALK_IN_HUB_PORT } from "./constants";
import { publishHub } from "./discovery";
import { walkInSubmitSchema } from "./protocol";

export type HubRequest = {
	method: string;
	path: string;
	headers: Record<string, string>;
	body?: string;
};

export type HubHandlers = {
	getContext: () => Promise<unknown> | unknown;
	onSubmit: (submission: WalkInSubmitBody) => Promise<{ localId: string }>;
	onLookup?: (localId: string) => Promise<unknown> | unknown;
	validateSession?: (sessionToken: string | undefined) => boolean;
};

export type WalkInHubHandle = {
	port: number;
	stop: () => Promise<void>;
};

type HttpServerLike = {
	start: (
		port: number,
		handler: (request: HubRequest) => Promise<{
			statusCode: number;
			headers?: Record<string, string>;
			body?: string;
		}>,
	) => Promise<number>;
	stop: () => Promise<void>;
};

async function loadHttpServer(): Promise<new () => HttpServerLike> | null {
	try {
		const mod = await import("react-native-nitro-http-server");
		return mod.HttpServer as new () => HttpServerLike;
	} catch {
		return null;
	}
}

function jsonResponse(statusCode: number, body: unknown) {
	return {
		statusCode,
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
		},
		body: JSON.stringify(body),
	};
}

export function isHubServerAvailable(): boolean {
	return true;
}

export async function startWalkInHub(
	handlers: HubHandlers,
	options: {
		port?: number;
		publish: {
			name: string;
			branchId: string;
			businessId: string;
			vertical: string;
		};
	},
): Promise<WalkInHubHandle | null> {
	const HttpServer = await loadHttpServer();
	if (!HttpServer) return null;

	const server = new HttpServer();
	const unpublish =
		publishHub({
			name: options.publish.name,
			port: options.port ?? WALK_IN_HUB_PORT,
			branchId: options.publish.branchId,
			businessId: options.publish.businessId,
			vertical: options.publish.vertical,
		}) ?? (() => {});

	const handler = async (request: HubRequest) => {
		const session = request.headers["x-walkin-session"];

		if (request.method === "GET" && request.path === "/v1/context") {
			if (handlers.validateSession && !handlers.validateSession(session)) {
				return jsonResponse(422, {
					ok: false,
					code: "INVALID_SESSION",
					message: "Invalid or expired session",
				});
			}
			const context = await handlers.getContext();
			return jsonResponse(200, context);
		}

		if (request.method === "POST" && request.path === "/v1/submit") {
			if (handlers.validateSession && !handlers.validateSession(session)) {
				return jsonResponse(422, {
					ok: false,
					code: "INVALID_SESSION",
					message: "Invalid or expired session",
				});
			}
			try {
				const raw = request.body ? JSON.parse(request.body) : {};
				const submission = walkInSubmitSchema.parse(raw) as WalkInSubmitBody;
				const result = await handlers.onSubmit(submission);
				return jsonResponse(200, {
					localId: result.localId,
					status: "accepted",
				});
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Invalid submission";
				return jsonResponse(409, {
					ok: false,
					code: "SUBMIT_FAILED",
					message,
				});
			}
		}

		const statusMatch = /^\/v1\/status\/([^/]+)$/.exec(request.path);
		if (request.method === "GET" && statusMatch) {
			return jsonResponse(200, { status: "pending" });
		}

		const lookupMatch =
			request.method === "POST" && request.path === "/v1/lookup";
		if (lookupMatch && handlers.onLookup && request.body) {
			const { localId } = JSON.parse(request.body) as { localId: string };
			const row = await handlers.onLookup(localId);
			return jsonResponse(200, row ?? {});
		}

		return jsonResponse(404, { ok: false, message: "Not found" });
	};

	const port = await server.start(options.port ?? WALK_IN_HUB_PORT, handler);

	return {
		port,
		stop: async () => {
			unpublish();
			await server.stop();
		},
	};
}
