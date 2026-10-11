import { type NextRequest, NextResponse } from "next/server";
import { legacyDb } from "@/lib/legacy-db";
import { getItemCatalog } from "@/server/actions/itemCatalog";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const filterType = searchParams.get("type");

		if (filterType === "companies") {
			const [rows] = await legacyDb.query(`
				SELECT DISTINCT Code, Description 
				FROM \`pdyasvmaster\`.\`m_mktcompany\`
				WHERE IsInActive = 0
				ORDER BY Description ASC
			`);
			const list = (rows as any[]) || [];
			const companies = list
				.map((r) => r.Description || r.Code)
				.filter(Boolean);
			return NextResponse.json({ companies });
		}

		const division = searchParams.get("division") || undefined;
		const search = searchParams.get("search") || undefined;
		const products = await getItemCatalog({ division, search, limit: 500 });

		return NextResponse.json({ products });
	} catch (e: any) {
		console.error("[Products API] Error:", e);
		return NextResponse.json(
			{ error: "Failed to fetch products data" },
			{ status: 500 },
		);
	}
}
