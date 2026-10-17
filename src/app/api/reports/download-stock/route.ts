import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { buildStyledExcelBuffer } from "@/lib/excel";
import { getMRInfo } from "@/server/actions/mrInfo";
import {
	getStockMovement,
	type StockMovementRow,
} from "@/server/actions/stockreports";
import { auth } from "@/server/auth";
import { getClientIp, getClientUserAgent } from "@/lib/security";
import { rateLimitReportDownload } from "@/lib/rate-limit";
import { recordAuditEvent } from "@/lib/audit-logger";

export async function GET(request: Request) {
	const reqHeaders = await headers();
	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (!session || !session.user) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	const clientIp = getClientIp(reqHeaders);
	const userAgent = getClientUserAgent(reqHeaders);

	// Rate Limiting: Max 30 exports per 5 minutes per user/IP
	const rateCheck = rateLimitReportDownload(clientIp, session.user.id);
	if (!rateCheck.allowed) {
		await recordAuditEvent({
			event: "RATE_LIMIT_EXCEEDED",
			userId: session.user.id,
			userEmail: session.user.email,
			role: session.user.role,
			ip: clientIp,
			userAgent,
			details: {
				endpoint: "/api/reports/download-stock",
				reason: rateCheck.message,
			},
		});

		return new NextResponse(rateCheck.message, {
			status: 429,
			headers: { "Retry-After": String(rateCheck.resetInSeconds) },
		});
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

	const assignments = mrInfo.company
		? [
				{
					id: `legacy-${mrId}`,
					mrId,
					manufacturer: mrInfo.company,
					firmNo: null,
					division: mrInfo.division || null,
					company: mrInfo.company,
					companyCode: mrInfo.companyCode,
					createdAt: new Date(),
				},
			]
		: [];

	const selectedAssignments =
		company === "All"
			? assignments
			: assignments.filter((a) => (a.division || a.manufacturer) === company);

	// Use the Code column directly from the legacy m_mktcompany ERP table
	const targetCodes = Array.from(
		new Set(
			selectedAssignments
				.map((a: any) => a.companyCode || mrInfo.companyCode)
				.filter(Boolean),
		),
	) as string[];

	const result = await getStockMovement(
		targetCodes.length > 0 ? targetCodes : mrInfo.companyCode || undefined,
		from || undefined,
		to || undefined,
		effectiveLocNo,
	);

	const items: StockMovementRow[] =
		result.success && result.data ? result.data : [];

	// Filter rows strictly by assigned divisions/companies directly without cutting strings
	const matchingRows = items.filter((row: StockMovementRow) => {
		if (selectedAssignments.length === 0) return true;
		return selectedAssignments.some((a) => {
			const mfgName = a.manufacturer?.trim().toUpperCase();
			const divName = a.division?.trim().toUpperCase();
			const rowMake = (row.Make || "").toString().trim().toUpperCase();
			const rowDiv = (row.Division || "").toString().trim().toUpperCase();

			const matchesMfg =
				!mfgName ||
				rowMake === mfgName ||
				rowMake.includes(mfgName) ||
				mfgName.includes(rowMake) ||
				(a.company && rowMake === a.company.trim().toUpperCase());

			const matchesDiv =
				!divName ||
				divName === mfgName ||
				rowDiv === divName ||
				rowDiv.includes(divName) ||
				divName.includes(rowDiv);

			return matchesMfg && matchesDiv;
		});
	});

	// Filter items to include ONLY products with transactions or non-zero balances (matches web view)
	const activeItems = matchingRows.filter((item: StockMovementRow) => {
		const opening = Number(item.Opening || 0);
		const purchase = Number(item.Purchase || 0);
		const sRet = Number(item.SReturn || 0);
		const stkAdjAdd = Number(item.StkAdjAdd || 0);
		const salesQty = Number(item.SalesQty || 0);
		const pRet = Number(item.PReturn || 0);
		const stkAdjLess = Number(item.StkAdjLess || 0);
		const balance = Number(item.Qty || 0);
		return (
			opening !== 0 ||
			purchase !== 0 ||
			balance !== 0 ||
			salesQty !== 0 ||
			sRet !== 0 ||
			stkAdjAdd !== 0 ||
			stkAdjLess !== 0 ||
			pRet !== 0
		);
	});

	const mrName = mrInfo.name || "Unknown";
	const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");
	const safeCompany = company.replace(/[^a-zA-Z0-9]/g, "_");
	const dateRangeTag =
		from && to ? `${from}_to_${to}` : new Date().toISOString().split("T")[0];
	const filename = `${safeMrName}_${safeCompany}_Stock_Report_${dateRangeTag}`;

	const format = searchParams.get("format") || "csv";

	if (format === "json") {
		// Provide rich mapping matching StockReportItem expected by generateStockPdfReport (filtered)
		const jsonReportData = activeItems.map((item: StockMovementRow) => {
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

	const tabularData = activeItems.map((item: StockMovementRow) => {
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

	if (format === "excel") {
		const columns = [
			{ header: "Item Code", key: "Item Code", width: 12 },
			{ header: "Item Name", key: "Item Name", width: 32 },
			{ header: "Packing", key: "Packing", width: 12 },
			{ header: "Division", key: "Division", width: 18 },
			{ header: "Manufacturer", key: "Manufacturer", width: 22 },
			{ header: "Opening Qty", key: "Opening Qty", width: 14, numFmt: "#,##0" },
			{ header: "Purchase Qty", key: "Purchase Qty", width: 14, numFmt: "#,##0" },
			{ header: "Sales Qty", key: "Sales Qty", width: 14, numFmt: "#,##0" },
			{ header: "Balance Qty", key: "Balance Qty", width: 14, numFmt: "#,##0" },
			{ header: "PTR", key: "PTR", width: 12, numFmt: "#,##0.00" },
			{ header: "P Rate", key: "P Rate", width: 12, numFmt: "#,##0.00" },
			{ header: "Stock Value", key: "Stock Value", width: 16, numFmt: "#,##0.00" },
		];

		const excelBuf = await buildStyledExcelBuffer({
			sheetName: "Stock Movement",
			title: "Stock Movement Statement",
			metadata: {
				mrName,
				company: mrInfo?.company || company,
				division: mrInfo?.division || company,
				period: from && to ? `${from} to ${to}` : "Current",
				year: "2026-27",
			},
			columns,
			data: tabularData,
			totals: {
				"Item Name": "GRAND TOTAL",
				"Opening Qty": totalOpening,
				"Purchase Qty": totalPurchase,
				"Sales Qty": totalSales,
				"Balance Qty": totalBalance,
				"Stock Value": Number(totalStockVal.toFixed(2)),
			},
		});

		await recordAuditEvent({
			event: "EXPORT_DOWNLOAD",
			userId: session.user.id,
			userEmail: session.user.email,
			role: session.user.role,
			ip: clientIp,
			userAgent,
			details: {
				reportType: "Stock Movement",
				format: "xlsx",
				mrId,
				company,
				from,
				to,
			},
		});

		return new NextResponse(new Uint8Array(excelBuf), {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.xlsx"`,
				"Content-Type":
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			},
		});
	}

	// Append grand total row for CSV
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

	await recordAuditEvent({
		event: "EXPORT_DOWNLOAD",
		userId: session.user.id,
		userEmail: session.user.email,
		role: session.user.role,
		ip: clientIp,
		userAgent,
		details: {
			reportType: "Stock Movement",
			format: "csv",
			mrId,
			company,
			from,
			to,
		},
	});

	return new NextResponse(csvContent, {
		headers: {
			"Content-Disposition": `attachment; filename="${filename}.csv"`,
			"Content-Type": "text/csv; charset=utf-8",
		},
	});
}
