import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const getDB = () => drizzle(env.TALASH_DB, { schema });

export type DbClient = ReturnType<typeof getDB>;

// Re-export drizzle operators so consumers share the same drizzle-orm instance
export {
	and,
	asc,
	avg,
	between,
	count,
	desc,
	eq,
	gt,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	lte,
	max,
	min,
	ne,
	not,
	notBetween,
	notInArray,
	notLike,
	or,
	sql,
	sum,
} from "drizzle-orm";
