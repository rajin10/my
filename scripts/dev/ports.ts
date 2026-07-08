import { connect } from "node:net";

export function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ port, host: "127.0.0.1" });
		socket.once("connect", () => {
			socket.destroy();
			resolve(false);
		});
		socket.once("error", () => resolve(true));
	});
}

export async function findBlockedPorts(ports: number[]): Promise<number[]> {
	const blocked: number[] = [];
	for (const port of ports) {
		if (!(await isPortFree(port))) blocked.push(port);
	}
	return blocked;
}
