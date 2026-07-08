import { createMobileQueryClient } from "@repo/mobile-query";

export const OWNER_APP_ID = "owner-app" as const;

export const queryClient = createMobileQueryClient();
