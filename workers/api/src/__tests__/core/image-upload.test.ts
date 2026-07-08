import { describe, expect, it } from "vitest";
import { ValidationError } from "../../core/errors";
import { validateImageUpload } from "../../core/storage/image-upload";

function fakeFile(type: string, sizeBytes = 1000, name = "upload.bin"): File {
	return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("validateImageUpload", () => {
	it("derives the extension from the validated MIME type, not the filename", () => {
		// A JPEG uploaded with a misleading/extensionless name must still map to `jpg`.
		expect(
			validateImageUpload(fakeFile("image/jpeg", 1000, "selfie")).ext,
		).toBe("jpg");
		expect(
			validateImageUpload(fakeFile("image/png", 1000, "evil.svg")).ext,
		).toBe("png");
		expect(validateImageUpload(fakeFile("image/webp", 1000, "x.exe")).ext).toBe(
			"webp",
		);
	});

	it("rejects a disallowed content type", () => {
		expect(() => validateImageUpload(fakeFile("application/pdf"))).toThrow(
			ValidationError,
		);
		expect(() => validateImageUpload(fakeFile("image/svg+xml"))).toThrow(
			ValidationError,
		);
		expect(() => validateImageUpload(fakeFile("text/html"))).toThrow(
			ValidationError,
		);
	});

	it("rejects a file larger than 5MB", () => {
		expect(() =>
			validateImageUpload(fakeFile("image/png", 5 * 1024 * 1024 + 1)),
		).toThrow(ValidationError);
	});

	it("accepts a file exactly at the 5MB cap", () => {
		expect(
			validateImageUpload(fakeFile("image/png", 5 * 1024 * 1024)).ext,
		).toBe("png");
	});
});
