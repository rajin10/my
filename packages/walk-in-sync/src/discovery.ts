import {
	WALK_IN_DISCOVERY_TIMEOUT_MS,
	WALK_IN_SERVICE_DOMAIN,
	WALK_IN_SERVICE_PROTOCOL,
	WALK_IN_SERVICE_TYPE,
} from "./constants";
import type { DiscoveredHub } from "./types";

type ZeroconfService = {
	name: string;
	host?: string;
	addresses?: string[];
	port: number;
	txt?: Record<string, string>;
};

type ZeroconfInstance = {
	scan: (
		type: string,
		protocol: string,
		domain: string,
		implType?: string,
	) => void;
	stop: () => void;
	on: (event: string, callback: (service: ZeroconfService) => void) => void;
	removeListener: (
		event: string,
		callback: (service: ZeroconfService) => void,
	) => void;
	publishService: (
		type: string,
		protocol: string,
		domain: string,
		name: string,
		port: number,
		txt?: Record<string, string>,
		implType?: string,
	) => void;
	unpublishService: (name: string, implType?: string) => void;
};

function loadZeroconf(): ZeroconfInstance | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const Zeroconf = require("react-native-zeroconf")
			.default as new () => ZeroconfInstance;
		return new Zeroconf();
	} catch {
		return null;
	}
}

function pickHost(service: ZeroconfService): string | null {
	if (service.addresses?.length) {
		const v4 = service.addresses.find(
			(a) => a.includes(".") && !a.startsWith("127."),
		);
		return v4 ?? service.addresses[0] ?? null;
	}
	return service.host?.replace(/\.$/, "") ?? null;
}

export function isDiscoveryAvailable(): boolean {
	return loadZeroconf() !== null;
}

export async function discoverHub(
	branchId: string,
	timeoutMs = WALK_IN_DISCOVERY_TIMEOUT_MS,
): Promise<DiscoveredHub | null> {
	const zeroconf = loadZeroconf();
	if (!zeroconf) return null;

	return new Promise((resolve) => {
		let settled = false;

		const finish = (hub: DiscoveredHub | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try {
				zeroconf.stop();
			} catch {
				/* ignore */
			}
			zeroconf.removeListener("resolved", onResolved);
			resolve(hub);
		};

		const onResolved = (service: ZeroconfService) => {
			const txtBranch = service.txt?.branchId;
			if (txtBranch && txtBranch !== branchId) return;
			const host = pickHost(service);
			if (!host) return;
			finish({
				host,
				port: service.port,
				branchId: txtBranch ?? branchId,
				businessId: service.txt?.businessId ?? "",
				vertical: service.txt?.vertical ?? "booking",
			});
		};

		zeroconf.on("resolved", onResolved);
		zeroconf.scan(
			WALK_IN_SERVICE_TYPE,
			WALK_IN_SERVICE_PROTOCOL,
			WALK_IN_SERVICE_DOMAIN,
		);

		const timer = setTimeout(() => finish(null), timeoutMs);
	});
}

export type PublishHubOptions = {
	name: string;
	port: number;
	branchId: string;
	businessId: string;
	vertical: string;
	hubVersion?: string;
};

export function publishHub(options: PublishHubOptions): (() => void) | null {
	const zeroconf = loadZeroconf();
	if (!zeroconf) return null;

	zeroconf.publishService(
		WALK_IN_SERVICE_TYPE,
		WALK_IN_SERVICE_PROTOCOL,
		WALK_IN_SERVICE_DOMAIN,
		options.name,
		options.port,
		{
			branchId: options.branchId,
			businessId: options.businessId,
			vertical: options.vertical,
			hubVersion: options.hubVersion ?? "1",
		},
	);

	return () => {
		try {
			zeroconf.unpublishService(options.name);
		} catch {
			/* ignore */
		}
	};
}
