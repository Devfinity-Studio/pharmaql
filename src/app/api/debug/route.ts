import { NextResponse } from "next/server";
import { legacyDb } from "@/lib/legacy-db";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const [masterRows] = await legacyDb.query(
			"SELECT COUNT(*) as count FROM `pdyasvmaster`.`l_mktcompany_mr`",
		);
		const [transRows] = await legacyDb.query(
			"SELECT COUNT(*) as count FROM `pdyasvtrans`.`d_itemsummary`",
		);

		return NextResponse.json({
			status: "connected",
			pdyasvmasterMrCount: (masterRows as any)[0]?.count ?? 0,
			pdyasvtransItemSummaryCount: (transRows as any)[0]?.count ?? 0,
		});
	} catch (e: any) {
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}
