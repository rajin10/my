import { commerceSearch, type CommerceSearchParams } from "./commerce-strategy";

export type SearchParams = CommerceSearchParams;

export class SearchService {
	async search(params: SearchParams = {}) {
		return commerceSearch(undefined, params);
	}
}
