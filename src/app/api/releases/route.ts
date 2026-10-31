import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getAllReleases, getAllInstances, publishRelease } from "@/lib/releases-store";

export const dynamic = "force-dynamic";

async function isAuthorized(req: NextRequest): Promise<boolean> {
	// 1. Check API Key header
	const apiKey = req.headers.get("x-api-key");
	const validKey = process.env.API_SERVER_KEY || process.env.API_SECRET_KEY;
	if (validKey && apiKey && apiKey === validKey) {
		return true;
	}

	// 2. Check DEVELOPER / ADMIN session
	try {
		const reqHeaders = await headers();
		const session = await auth.api.getSession({
			headers: reqHeaders,
		});
		if (session?.user?.role === "DEVELOPER" || session?.user?.role === "ADMIN") {
			return true;
		}
	} catch {
		// Session lookup failure
	}

	return false;
}

export async function GET(req: NextRequest) {
	try {
		const authorized = await isAuthorized(req);
		if (!authorized) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const [releases, instances] = await Promise.all([
			getAllReleases(),
			getAllInstances(),
		]);

		return NextResponse.json({
			success: true,
			releases,
			instances,
		});
	} catch (err: any) {
		console.error("[ReleasesAPI] Error fetching releases & instances:", err);
		return NextResponse.json(
			{ error: "Failed to fetch fleet data", details: err?.message },
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const authorized = await isAuthorized(req);
		if (!authorized) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await req.json();
		if (!body.version || !body.sha256) {
			return NextResponse.json(
				{ error: "Missing required fields: version, sha256" },
				{ status: 400 }
			);
		}

		const release = await publishRelease({
			version: String(body.version).trim(),
			platform: body.platform ? String(body.platform).trim() : "win-x64",
			sha256: String(body.sha256).trim(),
			downloadUrl: body.downloadUrl ? String(body.downloadUrl).trim() : `/api/releases/download?version=${body.version}`,
			mandatory: Boolean(body.mandatory),
			releaseNotes: body.releaseNotes ? String(body.releaseNotes).trim() : "",
			isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
		});

		return NextResponse.json({
			success: true,
			release,
		});
	} catch (err: any) {
		console.error("[ReleasesAPI] Error publishing release:", err);
		return NextResponse.json(
			{ error: "Failed to publish release", details: err?.message },
			{ status: 500 }
		);
	}
}

