import type { NotificationsRepository } from "@repo/core/src/database/repositories/notifications.repository";
import type {
	NotificationInsert,
	NotificationSelect,
	NotificationTypeValue,
} from "@repo/core/src/database/schema";
import { NotFoundError } from "../../core/errors";

export type NotificationDto = {
	id: string;
	type: NotificationTypeValue;
	title: string;
	body: string;
	readAt: string | null;
	businessId: string | null;
	bookingId: string | null;
	reviewId: string | null;
	orderId: string | null;
	go: "bookings" | "reviews" | "orders" | null;
	createdAt: string;
};

function toDto(row: NotificationSelect): NotificationDto {
	return {
		id: row.id,
		type: row.type as NotificationTypeValue,
		title: row.title,
		body: row.body,
		readAt: row.readAt,
		businessId: row.businessId,
		bookingId: row.bookingId,
		reviewId: row.reviewId,
		orderId: row.orderId,
		go: (row.go as NotificationDto["go"]) ?? null,
		createdAt: row.createdAt,
	};
}

export class NotificationsService {
	constructor(private readonly repo: NotificationsRepository) {}

	list(userId: string, limit = 50): Promise<NotificationDto[]> {
		return this.repo.listByUser(userId, limit).then((rows) => rows.map(toDto));
	}

	async markRead(userId: string, id: string): Promise<NotificationDto> {
		const row = await this.repo.markRead(id, userId);
		if (!row) throw new NotFoundError("Notification not found");
		return toDto(row);
	}

	markAllRead(userId: string) {
		return this.repo.markAllRead(userId);
	}

	create(data: NotificationInsert) {
		return this.repo.create(data).then(toDto);
	}
}
