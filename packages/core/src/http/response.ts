import { type ZodTypeAny, z } from "zod";

const parseCommaSeparated = (value: unknown): string[] | undefined => {
	if (Array.isArray(value)) {
		return value
			.map((item) => String(item).trim())
			.filter((item) => item.length > 0);
	}

	if (typeof value === "string") {
		return value
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
	}

	return undefined;
};

const parseFilters = (value: unknown): Record<string, string> | undefined => {
	if (!value) {
		return undefined;
	}

	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value) as unknown;
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
				return undefined;
			}

			return Object.fromEntries(
				Object.entries(parsed as Record<string, unknown>).map(([key, item]) => [
					key,
					String(item),
				]),
			);
		} catch {
			return undefined;
		}
	}

	if (typeof value === "object" && !Array.isArray(value)) {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, item]) => [
				key,
				String(item),
			]),
		);
	}

	return undefined;
};

const parseBoolean = (value: unknown): boolean | undefined => {
	if (typeof value === "boolean") {
		return value;
	}

	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (normalized === "true") {
			return true;
		}

		if (normalized === "false") {
			return false;
		}
	}

	return undefined;
};

export interface Pagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
	mode?: "offset" | "cursor";
	nextCursor?: string | null;
	prevCursor?: string | null;
}

export const baseQueryDto = z.object({
	sort: z.string().optional(),
	sortBy: z.enum(["asc", "desc"]).default("desc").optional(),
	search: z.string().optional(),
	fields: z.preprocess(parseCommaSeparated, z.array(z.string())).optional(),
	filters: z
		.preprocess(parseFilters, z.record(z.string(), z.string()))
		.optional(),
	withDeleted: z
		.preprocess(parseBoolean, z.boolean())
		.default(false)
		.optional(),
});

export const paginatedQueryDto = baseQueryDto.extend({
	page: z.coerce.number().int().positive().default(1).optional(),
	limit: z.coerce.number().int().positive().max(100).default(10).optional(),
	/**
	 * Opaque cursor from a previous response's `nextCursor`. When present the
	 * response is cursor-paginated (no total count) and `page` is ignored.
	 */
	cursor: z.string().optional(),
});

export type BaseQueryDto = z.infer<typeof baseQueryDto>;
export type PaginatedQueryDto = z.infer<typeof paginatedQueryDto>;

export interface ApiResponse<T = unknown> {
	data: T;
	query?: BaseQueryDto;
}

export interface PaginatedResponse<T = unknown> {
	data: T[];
	query: BaseQueryDto & Pagination;
}

export interface ValidationErrorResponse {
	message: string;
	errors: z.ZodIssue[];
}

export const paginatedResponse = <T = unknown>(
	payload: PaginatedResponse<T>,
) => {
	return Response.json(payload);
};

export const apiResponse = <T = unknown>(payload: ApiResponse<T>) => {
	return Response.json(payload);
};

export const validationErrorResponse = (
	message: string,
	errors: z.ZodIssue[],
) => {
	return Response.json(
		{
			message,
			errors,
		} satisfies ValidationErrorResponse,
		{ status: 422 },
	);
};

export const safeParseOrValidationError = <TSchema extends ZodTypeAny>(
	schema: TSchema,
	input: unknown,
	message: string,
) => {
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		return {
			success: false as const,
			response: validationErrorResponse(message, parsed.error.issues),
		};
	}

	return {
		success: true as const,
		data: parsed.data,
	};
};
