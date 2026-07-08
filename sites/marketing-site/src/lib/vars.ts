const NODE_ENV = process.env.NODE_ENV || "development";
let API_URL = "https://api.mahannankhan.info";

if (process.env.API_URL) {
	API_URL = process.env.API_URL;
} else if (process.env.NEXT_PUBLIC_API_URL) {
	API_URL = process.env.NEXT_PUBLIC_API_URL;
} else if (NODE_ENV === "production") {
	API_URL = "https://api.mahannankhan.info";
} else if (NODE_ENV === "development") {
	API_URL = "http://localhost:8787";
}

export const vars = {
	API_URL: API_URL.trim().replace(/\/+$/, ""),
};
