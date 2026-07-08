import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokenStore } from "../lib/native-token-store";

const mockGetItem = vi.mocked(SecureStore.getItem);
const mockSetItemAsync = vi.mocked(SecureStore.setItemAsync);
const mockDeleteItemAsync = vi.mocked(SecureStore.deleteItemAsync);

beforeEach(() => {
	vi.resetAllMocks();
});

describe("tokenStore.getAccessToken", () => {
	it("returns the stored access token", () => {
		mockGetItem.mockReturnValue("my-access-token");
		expect(tokenStore.getAccessToken()).toBe("my-access-token");
		expect(mockGetItem).toHaveBeenCalledWith("talash_access_token");
	});

	it("returns null when no token is stored", () => {
		mockGetItem.mockReturnValue(null);
		expect(tokenStore.getAccessToken()).toBeNull();
	});
});

describe("tokenStore.getRefreshToken", () => {
	it("reads from the refresh token key", () => {
		mockGetItem.mockReturnValue("my-refresh-token");
		expect(tokenStore.getRefreshToken()).toBe("my-refresh-token");
		expect(mockGetItem).toHaveBeenCalledWith("talash_refresh_token");
	});
});

describe("tokenStore.setTokens", () => {
	it("stores both access and refresh tokens", async () => {
		mockSetItemAsync.mockResolvedValue(undefined);
		await tokenStore.setTokens("access-abc", "refresh-xyz");
		expect(mockSetItemAsync).toHaveBeenCalledWith(
			"talash_access_token",
			"access-abc",
		);
		expect(mockSetItemAsync).toHaveBeenCalledWith(
			"talash_refresh_token",
			"refresh-xyz",
		);
	});
});

describe("tokenStore.clearTokens", () => {
	it("deletes both token keys", async () => {
		mockDeleteItemAsync.mockResolvedValue(undefined);
		await tokenStore.clearTokens();
		expect(mockDeleteItemAsync).toHaveBeenCalledWith("talash_access_token");
		expect(mockDeleteItemAsync).toHaveBeenCalledWith("talash_refresh_token");
	});
});
