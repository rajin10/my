import { createMobileQueryClient } from "@repo/mobile-query";

export const MOBILE_APP_ID = "mobile-app" as const;

export const queryClient = createMobileQueryClient();
