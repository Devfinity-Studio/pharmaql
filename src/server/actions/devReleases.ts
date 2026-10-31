"use server";

import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { recordAuditEvent } from "@/lib/audit-logger";
import {
	getAllReleases,
	getAllInstances,
	publishRelease,
	type ApiServerRelease,
	type ApiServerInstance,
} from "@/lib/releases-store";

async function verifyDeveloperSession() {
	const reqHeaders = await headers();
	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (!session || (session.user.role !== "DEVELOPER" && session.user.role !== "ADMIN")) {
		throw new Error("Unauthorized: Developer privileges required.");
	}

	return session;
}

export async function getFleetAndReleasesAction(): Promise<{
	success: boolean;
	data?: {
		releases: ApiServerRelease[];
		instances: ApiServerInstance[];
	};
	error?: string;
}> {
	try {
		await verifyDeveloperSession();
		const [releases, instances] = await Promise.all([
			getAllReleases(),
			getAllInstances(),
		]);

		return {
			success: true,
			data: { releases, instances },
		};
	} catch (err: any) {
		return { success: false, error: err?.message || "Failed to fetch fleet data." };
	}
}

export async function publishReleaseAction(formData: {
	version: string;
	platform?: string;
	sha256: string;
	downloadUrl?: string;
	mandatory?: boolean;
	releaseNotes?: string;
	isActive?: boolean;
}): Promise<{
	success: boolean;
	release?: ApiServerRelease;
	error?: string;
}> {
	try {
		const session = await verifyDeveloperSession();

		if (!formData.version || !formData.sha256) {
			return { success: false, error: "Version and SHA-256 checksum are required." };
		}

		const release = await publishRelease({
			version: formData.version.trim(),
			platform: formData.platform?.trim() || "win-x64",
			sha256: formData.sha256.trim(),
			downloadUrl: formData.downloadUrl?.trim() || `/api/releases/download?version=${formData.version.trim()}`,
			mandatory: Boolean(formData.mandatory),
			releaseNotes: formData.releaseNotes?.trim() || "",
			isActive: formData.isActive !== undefined ? Boolean(formData.isActive) : true,
		});

		await recordAuditEvent({
			event: "SECURITY_WARNING",
			userEmail: session.user.email || undefined,
			role: session.user.role,
			ip: "127.0.0.1",
			details: {
				action: "RELEASE_PUBLISHED",
				version: release.version,
				platform: release.platform,
				sha256: release.sha256,
			},
		});

		return { success: true, release };
	} catch (err: any) {
		return { success: false, error: err?.message || "Failed to publish release." };
	}
}
