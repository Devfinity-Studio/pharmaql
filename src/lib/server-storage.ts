import fs from "fs/promises";
import os from "os";
import path from "path";

/**
 * Determine the root data directory.
 * On Vercel / AWS Lambda, the application bundle at process.cwd() is read-only (EROFS).
 * Only /tmp is writable.
 */
export function getServerDataDir(): string {
	if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
		return path.join(os.tmpdir(), "pharmaql-data");
	}
	return path.join(process.cwd(), "data");
}

/**
 * Returns the resolved path for a given filename in the active server data directory.
 */
export function getServerDataFilePath(filename: string): string {
	return path.join(getServerDataDir(), filename);
}

/**
 * Reads a JSON file with dual-location resolution:
 * 1. Checks writable directory (/tmp/pharmaql-data on Vercel, data/ locally)
 * 2. If not found, checks bundled read-only project directory (process.cwd()/data)
 * 3. If neither exists, returns the provided fallback default.
 * NEVER throws EROFS or ENOENT!
 */
export async function readServerJson<T>(filename: string, fallback: T): Promise<T> {
	const primaryPath = getServerDataFilePath(filename);
	const bundledPath = path.join(process.cwd(), "data", filename);

	// 1. Try reading from primary path
	try {
		const raw = await fs.readFile(primaryPath, "utf-8");
		return JSON.parse(raw) as T;
	} catch {
		// Not found in primary path
	}

	// 2. If primary path is not bundled path, try reading from bundled path
	if (primaryPath !== bundledPath) {
		try {
			const raw = await fs.readFile(bundledPath, "utf-8");
			const parsed = JSON.parse(raw) as T;
			// Seed to primary path for future modifications (non-blocking, ignore errors)
			writeServerJson(filename, parsed).catch(() => {});
			return parsed;
		} catch {
			// Not found in bundled path either
		}
	}

	// 3. Not found anywhere: attempt to seed fallback, but return fallback safely even if write fails
	try {
		await writeServerJson(filename, fallback);
	} catch {
		// Ignore write errors (e.g. read-only filesystem)
	}

	return fallback;
}

/**
 * Writes a JSON file atomically and safely.
 * If EROFS occurs on the primary path, automatically retries writing to os.tmpdir().
 */
export async function writeServerJson<T>(filename: string, data: T): Promise<void> {
	const targetPath = getServerDataFilePath(filename);
	const targetDir = path.dirname(targetPath);

	try {
		await fs.mkdir(targetDir, { recursive: true });
		await fs.writeFile(targetPath, JSON.stringify(data, null, 2), "utf-8");
	} catch (err: any) {
		if (err?.code === "EROFS") {
			// Read-only filesystem detected: fallback to /tmp
			try {
				const tmpPath = path.join(os.tmpdir(), "pharmaql-data", filename);
				await fs.mkdir(path.dirname(tmpPath), { recursive: true });
				await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
			} catch (tmpErr) {
				console.warn(`[ServerStorage] Write fallback error for ${filename}:`, tmpErr);
			}
			return;
		}
		console.warn(`[ServerStorage] Write error for ${filename}:`, err?.message || err);
	}
}
