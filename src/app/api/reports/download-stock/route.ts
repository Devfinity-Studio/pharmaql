import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getMRInfo } from "@/server/actions/mrInfo";
import { getStockMovement, type StockMovementRow } from "@/server/actions/stockreports";

export async function GET(request: Request) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || !session.user) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const mrId = searchParams.get("mrId");
	const company = searchParams.get("company") || "All";
	const from = searchParams.get("from");
	const to = searchParams.get("to");

	if (!mrId) {
		return new NextResponse("Missing mrId", { status: 400 });
	}

	const requestingUserId = session.user.id;
	const isSelf = requestingUserId === mrId;
	const isAdmin = (session.user as any).role === "ADMIN" || (session.user as any).role === "DEVELOPER";

	if (!isSelf && !isAdmin) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo || (!mrInfo.canViewStock && !isAdmin)) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	const effectiveLocNo = mrInfo.locNo || "11";
	const compCode = company === "All" ? (mrInfo.companyCode || undefined) : company;

	const result = await getStockMovement(
		compCode,
		from || undefined,
		to || undefined,
		effectiveLocNo,
	);

	const items: StockMovementRow[] = result.success && result.data ? result.data : [];

	const reportData = items.map((item: StockMovementRow) => ({
		"Item Code": item.ItemId,
		"Product Name": item.ItemName,
		"Packing": item.Packing,
		"Division": item.Division,
		"Manufacturer": item.Make,
		"Opening Qty": item.Opening,
		"Purchase Qty": item.Purchase,
		"Sales Qty": item.SalesQty,
		"Balance Qty": item.Qty,
		"PTR": item.PTR,
		"P Rate": item.Prate,
	}));

	const format = searchParams.get("format") || "csv";
	const timestamp = new Date().toISOString().split("T")[0];
	const filename = `Stock_Report_${company.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}`;

	if (format === "json") {
		return NextResponse.json(reportData);
	}

	if (format === "excel") {
		const xlsx = require("xlsx");
		const worksheet = xlsx.utils.json_to_sheet(reportData);
		const workbook = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(workbook, worksheet, "Stock Report");
		const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

		return new NextResponse(buffer, {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.xlsx"`,
				"Content-Type":
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			},
		});
	} else {
		// CSV
		if (reportData.length === 0 || !reportData[0]) {
			return new NextResponse("No data available", { status: 200 });
		}
		const headersKeys = Object.keys(reportData[0]);
		const csvContent = [
			headersKeys.join(","),
			...reportData.map((row: Record<string, any>) =>
				headersKeys
					.map((key) => {
						const val = row[key];
						return typeof val === "string"
							? `"${val.replace(/"/g, '""')}"`
							: val;
					})
					.join(","),
			),
		].join("\n");

		return new NextResponse(csvContent, {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.csv"`,
				"Content-Type": "text/csv; charset=utf-8",
			},
		});
	}
}
