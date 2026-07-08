import { ValidationError } from "../errors";

const IMAGE_TYPE_EXTENSIONS: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImageUpload(file: File): { ext: string } {
	const ext = IMAGE_TYPE_EXTENSIONS[file.type];
	if (!ext)
		throw new ValidationError("Only JPEG, PNG, or WebP images are allowed");
	if (file.size > MAX_IMAGE_BYTES)
		throw new ValidationError("Image must be 5MB or smaller");
	return { ext };
}
