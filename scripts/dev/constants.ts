export const SETUP_VERSION = 1;

export const GOOGLE_CLIENT_ID =
	"163196138441-dvuciv0t2ddnkr61fck5r9i9v2jq0a64.apps.googleusercontent.com";

export const PORTS = {
	api: 8787,
	marketing: 3000,
	dashboard: 3001,
} as const;

export const API_HEALTH_URL = `http://localhost:${PORTS.api}/health`;

export const HEALTH_TIMEOUT_MS = 30_000;
export const HEALTH_POLL_MS = 500;

export type DevSecrets = {
	jwtSecret: string;
	googleClientSecret: string;
};

export type DevService = {
	key: string;
	label: string;
	command: string[];
	cwd?: string;
	prefix: string;
	url?: string;
	waitForHealth?: boolean;
};

export const DEV_SERVICES: DevService[] = [
	{
		key: "auth-service",
		label: "Auth service",
		command: ["bun", "run", "auth-service:dev"],
		prefix: "auth",
	},
	{
		key: "lpg-service",
		label: "LPG service",
		command: ["bun", "run", "lpg-service:dev"],
		prefix: "lpg",
	},
	{
		key: "booking-service",
		label: "Booking service",
		command: ["bun", "run", "booking-service:dev"],
		prefix: "booking",
	},
	{
		key: "api",
		label: "API",
		command: ["bun", "run", "api:dev"],
		prefix: "api",
		url: `http://localhost:${PORTS.api}`,
		waitForHealth: false,
	},
	{
		key: "queue",
		label: "Queue worker",
		command: ["bun", "run", "queue:dev"],
		prefix: "queue",
	},
	{
		key: "scheduled",
		label: "Scheduled worker",
		command: ["bun", "run", "scheduled:dev"],
		prefix: "scheduled",
	},
	{
		key: "marketing",
		label: "Marketing site",
		command: ["bun", "run", "marketing-site:dev"],
		prefix: "marketing",
		url: `http://localhost:${PORTS.marketing}`,
		waitForHealth: true,
	},
	{
		key: "dashboard",
		label: "Business dashboard",
		command: ["bun", "run", "business-dashboard:dev"],
		prefix: "dashboard",
		url: `http://localhost:${PORTS.dashboard}`,
		waitForHealth: true,
	},
	{
		key: "mobile",
		label: "Mobile app",
		command: ["bun", "run", "mobile-app:dev"],
		prefix: "mobile",
		url: "Expo DevTools",
		waitForHealth: true,
	},
	{
		key: "owner",
		label: "Owner app",
		command: ["bun", "run", "owner-app:dev"],
		prefix: "owner",
		url: "Expo DevTools",
		waitForHealth: true,
	},
];
