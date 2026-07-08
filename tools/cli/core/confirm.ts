export interface ProductionGateArgs {
	force: boolean;
	/** The confirmation string supplied (via --confirm or interactive prompt); null if none. */
	provided: string | null;
	/** The remote database name the user must type to proceed. */
	dbName: string;
}

export function checkProductionGate(args: ProductionGateArgs): {
	ok: boolean;
	reason?: string;
} {
	if (!args.force) {
		return { ok: false, reason: "Production requires --force." };
	}
	if (args.provided !== args.dbName) {
		return {
			ok: false,
			reason: `Confirmation mismatch — type the database name "${args.dbName}" to proceed.`,
		};
	}
	return { ok: true };
}
