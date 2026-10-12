import { NextResponse } from "next/server";
import { apiGet } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const healthRes = await apiGet<{ status: string; db: string; port: number }>("/health");
		const kpiRes = await apiGet<{ totalCustomers: number; totalProducts: number; totalMRs: number }>("/api/kpi/summary");

		return NextResponse.json({
			status: healthRes.success ? "connected" : "disconnected",
			configuredApiServerUrl: process.env.API_SERVER_URL || "http://127.0.0.1:9443",
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
