import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { getMRInfo } from "@/server/actions/mrInfo";
import {
	getStockMovement,
	type StockMovementRow,
} from "@/server/actions/stockreports";
import { auth } from "@/server/auth";

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
	const isAdmin =
		(session.user as any).role === "ADMIN" ||
		(session.user as any).role === "DEVELOPER";

	if (!isSelf && !isAdmin) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo || (!mrInfo.canViewStock && !isAdmin)) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	const effectiveLocNo = mrInfo.locNo || "11";
	const compCode =
		company === "All" ? mrInfo.companyCode || undefined : company;

	const result = await getStockMovement(
		compCode,
		from || undefined,
		to || undefined,
		effectiveLocNo,
	);

	const items: StockMovementRow[] =
		result.success && result.data ? result.data : [];

	const mrName = mrInfo.name || "Unknown";
	const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");
	const safeCompany = company.replace(/[^a-zA-Z0-9]/g, "_");
	const dateRangeTag =
		from && to ? `${from}_to_${to}` : new Date().toISOString().split("T")[0];
	const filename = `${safeMrName}_${safeCompany}_Stock_Report_${dateRangeTag}`;

	const format = searchParams.get("format") || "csv";

	if (format === "json") {
		// Provide rich mapping matching StockReportItem expected by generateStockPdfReport
		const jsonReportData = items.map((item: StockMovementRow) => {
			const opening = Number(item.Opening || 0);
			const purchase = Number(item.Purchase || 0);
			const sRet = Number(item.SReturn || 0);
			const stkAdjAdd = Number(item.StkAdjAdd || 0);
			const salesQty = Number(item.SalesQty || 0);
			const pRet = Number(item.PReturn || 0);
			const stkAdjLess = Number(item.StkAdjLess || 0);
			const balance = Number(item.Qty || 0);
			const prate = Number(item.Prate || 0);
			const ptr = Number(item.PTR || 0);
			const stockValue = balance * prate;

			return {
				"MR Name": mrName,
				ItemId: item.ItemId,
				"Item Name": item.ItemName || "",
				"Product Name": item.ItemName || "",
				Packing: item.Packing || "-",
				Division: (item.Division || item.Make || "General").toString().trim(),
				Manufacturer: item.Make || "Unknown",
				"Opening Qty.": opening,
				"Purchase Qty": purchase,
				"S.Ret Qty.": sRet,
				"Stk Adj Add": stkAdjAdd,
				"Total In Qty": opening + purchase + sRet + stkAdjAdd,
				"Sales Qty.": salesQty,
				"P.Ret Qty.": pRet,
				"Stk Adj Less": stkAdjLess,
				"Balance Qty.": balance,
				"Stock Value": stockValue,
				prate,
				ptr,
				"Purc Days": Number(item.Days || 0),
			};
		});

		return NextResponse.json(jsonReportData);
	}

	// CSV and Excel formatted tabular data
	let totalOpening = 0;
	let totalPurchase = 0;
	let totalSales = 0;
	let totalBalance = 0;
	let totalStockVal = 0;

	const tabularData = items.map((item: StockMovementRow) => {
		const opening = Number(item.Opening || 0);
		const purchase = Number(item.Purchase || 0);
		const sales = Number(item.SalesQty || 0);
		const balance = Number(item.Qty || 0);
		const ptr = Number(item.PTR || 0);
		const prate = Number(item.Prate || 0);
		const stockVal = balance * prate;

		totalOpening += opening;
		totalPurchase += purchase;
		totalSales += sales;
		totalBalance += balance;
		totalStockVal += stockVal;

		return {
			"Item Code": item.ItemId,
			"Item Name": item.ItemName,
			Packing: item.Packing || "-",
			Division: item.Division || "-",
			Manufacturer: item.Make || "-",
			"Opening Qty": opening,
			"Purchase Qty": purchase,
			"Sales Qty": sales,
			"Balance Qty": balance,
			PTR: Number(ptr.toFixed(2)),
			"P Rate": Number(prate.toFixed(2)),
			"Stock Value": Number(stockVal.toFixed(2)),
		};
	});

	// Append grand total row for spreadsheets
	if (tabularData.length > 0) {
		tabularData.push({
			"Item Code": "" as any,
			"Item Name": "TOTAL :",
			Packing: "",
			Division: "",
			Manufacturer: "",
			"Opening Qty": totalOpening,
			"Purchase Qty": totalPurchase,
			"Sales Qty": totalSales,
			"Balance Qty": totalBalance,
			PTR: "" as any,
			"P Rate": "" as any,
			"Stock Value": Number(totalStockVal.toFixed(2)),
		});
	}

	if (format === "excel") {
		const worksheet = xlsx.utils.json_to_sheet(tabularData);
		const workbook = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(workbook, worksheet, "Stock Movement");
		const arrayBuf = xlsx.write(workbook, { type: "array", bookType: "xlsx" });

		return new NextResponse(new Uint8Array(arrayBuf), {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.xlsx"`,
				"Content-Type":
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			},
		});
	}

	// CSV
	const firstRow = tabularData[0];
	if (!firstRow) {
		return new NextResponse("No data available", { status: 200 });
	}

	const headersKeys = Object.keys(firstRow);
	const csvContent = [
		headersKeys.join(","),
		...tabularData.map((row: Record<string, any>) =>
			headersKeys
				.map((key) => {
					const val = row[key];
					return typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val;
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
