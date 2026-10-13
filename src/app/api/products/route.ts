import { type NextRequest, NextResponse } from "next/server";
import { getItemCatalog } from "@/server/actions/itemCatalog";
import { getAllMarketingCompaniesWithDivisions } from "@/server/actions/mrInfo";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const filterType = searchParams.get("type");

		if (filterType === "companies") {
			const list = await getAllMarketingCompaniesWithDivisions();
			const companies = Array.from(
				new Set(
					list.map((r) => r.companyName || r.companyCode).filter(Boolean),
				),
			);
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
