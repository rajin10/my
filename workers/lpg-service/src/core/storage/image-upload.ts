import { ValidationError } from "../errors";

/**
 * Single source of truth for image-upload validation, shared by every photo
 * upload path (user avatar, business / product / service photos).
 *
 * The stored-object extension is derived from the *validated* MIME type — never
 * from the user-supplied filename, which may be extensionless, carry junk, or be
 * a content-type-confusion vector (e.g. an SVG/HTML payload named `.png`). The
 * size cap bounds R2 writes so an authenticated caller cannot store arbitrarily
 * large objects.
 */
const IMAGE_TYPE_EXTENSIONS: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Validate an uploaded image against the MIME allowlist and the size cap.
 * Returns the extension to use for the stored object key.
 * Throws {@link ValidationError} (422) on a disallowed type or oversize file.
 */
export function validateImageUpload(file: File): { ext: string } {
	const ext = IMAGE_TYPE_EXTENSIONS[file.type];
	if (!ext)
		throw new ValidationError("Only JPEG, PNG, or WebP images are allowed");
	if (file.size > MAX_IMAGE_BYTES)
		throw new ValidationError("Image must be 5MB or smaller");
	return { ext };
}
