import { z } from "zod";

export const walkInCustomerSchema = z.object({
	userId: z.string().optional(),
	guestName: z.string().optional(),
	guestPhone: z.string().optional(),
});

export const walkInSubmitSchema = z.object({
	localId: z.string().min(1),
	branchId: z.string().min(1),
	vertical: z.enum(["booking", "commerce"]),
	customer: walkInCustomerSchema,
	booking: z
		.object({
			serviceId: z.string().min(1),
			slot: z.string().min(1),
		})
		.optional(),
	order: z
		.object({
			items: z
				.array(
					z.object({
						productId: z.string().min(1),
						qty: z.number().int().positive(),
					}),
				)
				.min(1),
		})
		.optional(),
	total: z.number().int().nonnegative(),
	submittedAt: z.number().int(),
});

export const walkInAcceptedSchema = z.object({
	localId: z.string(),
	status: z.literal("accepted"),
});

export type WalkInSubmitPayload = z.infer<typeof walkInSubmitSchema>;
