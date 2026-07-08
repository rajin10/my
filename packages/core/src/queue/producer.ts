import type { JobPayload } from "./jobs";

export class QueueProducer {
	constructor(private readonly queue: Queue) {}

	async send<T extends JobPayload>(payload: T): Promise<void> {
		await this.queue.send(payload);
	}

	async sendBatch<T extends JobPayload>(payloads: T[]): Promise<void> {
		await this.queue.sendBatch(payloads.map((body) => ({ body })));
	}
}
