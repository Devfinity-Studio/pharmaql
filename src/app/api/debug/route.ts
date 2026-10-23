import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { apiGet } from "@/lib/api-client";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
	// Debug route is strictly restricted to authenticated DEVELOPER users
	const reqHeaders = await headers();
	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (!session || session.user.role !== "DEVELOPER") {
		return NextResponse.json(
			{ error: "Forbidden: Developer privileges required to access debug diagnostics." },
			{ status: 403 }
		);
	}

	try {
		const healthRes = await apiGet<{
			status: string;
			db: string;
			port: number;
		}>("/health");
		const kpiRes = await apiGet<{
			totalCustomers: number;
			totalProducts: number;
			totalMRs: number;
		}>("/api/kpi/summary");

		return NextResponse.json({
			status: healthRes.success ? "connected" : "disconnected",
			configuredApiServerUrl:
				process.env.API_SERVER_URL || "http://127.0.0.1:9443",
			hasSecretKey: Boolean(process.env.API_SECRET_KEY),
			apiServer: healthRes.data,
			healthError: healthRes.error,
			kpiSummary: kpiRes.data,
			kpiError: kpiRes.error,
		});
	} catch (e: any) {
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}
