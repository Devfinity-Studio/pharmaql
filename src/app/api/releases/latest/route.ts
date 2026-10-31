import { NextRequest, NextResponse } from "next/server";
import { getLatestRelease } from "@/lib/releases-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const currentVersion = searchParams.get("current_version") || "0.0.0";
		const platform = searchParams.get("platform") || "win-x64";

		const latest = await getLatestRelease(platform);

		if (!latest) {
			return NextResponse.json({
				hasUpdate: false,
				version: currentVersion,
				sha256: "",
				downloadUrl: "",
				mandatory: false,
				releaseNotes: "No releases found.",
			});
		}

		// Check if the current version differs from the latest version
		const hasUpdate = latest.version !== currentVersion;

		// Resolve absolute download URL if relative
		let downloadUrl = latest.downloadUrl;
		if (downloadUrl.startsWith("/")) {
			const origin = req.nextUrl.origin;
			downloadUrl = `${origin}${downloadUrl}`;
		}

		return NextResponse.json({
			hasUpdate,
			version: latest.version,
			sha256: latest.sha256,
			downloadUrl,
			mandatory: latest.mandatory,
			releaseNotes: latest.releaseNotes,
		});
	} catch (err: any) {
		console.error("[ReleasesAPI] Error in /api/releases/latest:", err);
		return NextResponse.json(
			{ error: "Failed to query latest release", details: err?.message },
			{ status: 500 }
		);
	}
}

