import type { AnalyticsRepository } from "@repo/core/src/database/repositories/analytics.repository";
import type { AuthorizationService } from "../../core/authorization";

export class AnalyticsService {
	constructor(
		private readonly repo: AnalyticsRepository,
		private readonly authz: AuthorizationService,
	) {}

	private getRange(days: number): { startDate: string; endDate: string } {
		const end = new Date();
		const start = new Date(end.getTime() - days * 86400000);
		return {
			startDate: start.toISOString().slice(0, 10),
			endDate: end.toISOString().slice(0, 10),
		};
	}

	private async guarded<T>(
		actorId: string,
		businessId: string,
		days: number,
		fn: (range: { startDate: string; endDate: string }) => Promise<T>,
	) {
		await this.authz.assertBusinessOwner(actorId, businessId);
		return fn(this.getRange(days));
	}

	overview(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (range) =>
			this.repo.getOverview(businessId, range),
		);
	}

	revenue(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (range) =>
			this.repo.getRevenueByDate(businessId, range),
		);
	}

	topServices(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (range) =>
			this.repo.getTopServices(businessId, range),
		);
	}

	peakHours(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (range) =>
			this.repo.getPeakHours(businessId, range),
		);
	}

	reviewStats(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (range) =>
			this.repo.getReviewStats(businessId, range),
		);
	}

	couponStats(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (range) =>
			this.repo.getCouponStats(businessId, range),
		);
	}

	staffStats(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (range) =>
			this.repo.getStaffStats(businessId, range),
		);
	}

	earnings(actorId: string, businessId: string, days: number) {
		return this.guarded(actorId, businessId, days, (range) =>
			this.repo.getEarnings(businessId, range),
		);
	}
}
