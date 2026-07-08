import {
	type BookingSearchParams,
	bookingSearch,
	type RerankAI,
} from "./booking-strategy";

export type SearchParams = BookingSearchParams;

export class SearchService {
	async search(params: SearchParams, ai?: RerankAI) {
		return bookingSearch(params, ai);
	}
}
