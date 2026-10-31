import { NextRequest, NextResponse } from "next/server";
import { recordInstanceHeartbeat } from "@/lib/releases-store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		if (!body || !body.instanceId || !body.version) {
			return NextResponse.json(
				{ error: "Missing required fields: instanceId, version" },
				{ status: 400 }
			);
		}

		await recordInstanceHeartbeat({
			instanceId: String(body.instanceId),
			version: String(body.version),
			platform: body.platform ? String(body.platform) : "win-x64",
			machineFingerprint: body.machineFingerprint ? String(body.machineFingerprint) : undefined,
			isVaultProtected: Boolean(body.isVaultProtected),
			status: body.status || "ONLINE",
			metadata: body.metadata || {},
			tenantSlug: body.tenantSlug ? String(body.tenantSlug) : undefined,
			tenantName: body.tenantName ? String(body.tenantName) : undefined,
		});

		return NextResponse.json({
			success: true,
			receivedAt: new Date().toISOString(),
		});
	} catch (err: any) {
		console.error("[ReleasesAPI] Telemetry error:", err);
		return NextResponse.json(
			{ error: "Failed to record telemetry", details: err?.message },
			{ status: 500 }
		);
	}
}

