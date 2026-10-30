import {
	S3Client,
	PutObjectCommand,
	DeleteObjectCommand,
} from "@aws-sdk/client-s3";

let s3ClientInstance: S3Client | null = null;

/**
 * Returns whether Neon S3-compatible cloud storage environment variables are configured.
 */
export function isStorageConfigured(): boolean {
	return Boolean(
		process.env.AWS_ENDPOINT_URL_S3 &&
			process.env.AWS_ACCESS_KEY_ID &&
			process.env.AWS_SECRET_ACCESS_KEY,
	);
}

/**
 * Resolves the target S3 bucket name.
 */
export function getStorageBucketName(): string {
	return process.env.AWS_S3_BUCKET_NAME || "pharmaql-tenant-logos";
}

/**
 * Returns a singleton instance of the S3Client configured for Neon Storage.
 */
export function getStorageClient(): S3Client {
	if (!s3ClientInstance) {
		s3ClientInstance = new S3Client({
			endpoint: process.env.AWS_ENDPOINT_URL_S3,
			region: process.env.AWS_REGION || "ap-southeast-1",
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
			},
			forcePathStyle: true,
		});
	}
	return s3ClientInstance;
}

/**
 * Formats the public URL for an object stored in the S3 bucket.
 */
export function getPublicLogoUrl(key: string): string {
	const endpoint = (process.env.AWS_ENDPOINT_URL_S3 || "").replace(/\/+$/, "");
	const bucket = getStorageBucketName();
	const cleanKey = key.replace(/^\/+/, "");
	return `${endpoint}/${bucket}/${cleanKey}`;
}

/**
 * Uploads a tenant logo buffer to Neon S3 storage and returns its permanent public URL.
 */
export async function uploadTenantLogoFile(params: {
	slug: string;
	fileName: string;
	buffer: Buffer | Uint8Array;
	contentType?: string;
}): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
	if (!isStorageConfigured()) {
		return {
			success: false,
			error:
				"Cloud object storage is not configured. AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are required.",
		};
	}

	try {
		const client = getStorageClient();
		const bucket = getStorageBucketName();
		const ext = params.fileName.split(".").pop()?.toLowerCase() || "png";
		const safeSlug = (params.slug || "tenant").toLowerCase().replace(/[^a-z0-9-]/g, "-");
		const key = `logos/${safeSlug}-logo-${Date.now()}.${ext}`;

		const contentType =
			params.contentType ||
			(ext === "svg"
				? "image/svg+xml"
				: ext === "jpg" || ext === "jpeg"
					? "image/jpeg"
					: ext === "webp"
						? "image/webp"
						: "image/png");

		const command = new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: params.buffer,
			ContentType: contentType,
		});

		await client.send(command);

		const url = getPublicLogoUrl(key);
		return { success: true, url, key };
	} catch (err: any) {
		console.error("[StorageService] uploadTenantLogoFile error:", err);
		return {
			success: false,
			error: err.message || "Failed to upload logo to cloud object storage.",
		};
	}
}

/**
 * Deletes an object from the storage bucket given its key or full public URL.
 */
export async function deleteTenantLogoFile(keyOrUrl: string): Promise<boolean> {
	if (!isStorageConfigured() || !keyOrUrl) return false;

	try {
		const bucket = getStorageBucketName();
		let key = keyOrUrl;

		if (keyOrUrl.startsWith("http")) {
			const url = new URL(keyOrUrl);
			// pathname: /<bucket>/<key>
			const pathParts = url.pathname.replace(/^\/+/, "").split("/");
			if (pathParts[0] === bucket) {
				key = pathParts.slice(1).join("/");
			} else {
				key = pathParts.join("/");
			}
		}

		const client = getStorageClient();
		await client.send(
			new DeleteObjectCommand({
				Bucket: bucket,
				Key: key,
			}),
		);
		return true;
	} catch (err) {
		console.error("[StorageService] deleteTenantLogoFile error:", err);
		return false;
	}
}
