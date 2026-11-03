import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit-logger";
import { buildStyledExcelBuffer } from "@/lib/excel";
import { sanitizeDateRangeForRole } from "@/lib/dateUtils";
import { rateLimitReportDownload } from "@/lib/rate-limit";
import { getClientIp, getClientUserAgent } from "@/lib/security";
import { getMRInfo } from "@/server/actions/mrInfo";
import { getExpiryStockStatement } from "@/server/actions/expiryReports";
import { auth } from "@/server/auth";

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
				endpoint: "/api/reports/download-expiry",
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
	const company = searchParams.get("division") || searchParams.get("company") || "All";
	const rawAsOn = searchParams.get("asOn") || searchParams.get("to") || new Date().toISOString().slice(0, 10);
	const rawMaxDays = reqHeaders.get("x-tenant-max-data-days");
	const maxDataDays = rawMaxDays && !isNaN(Number(rawMaxDays)) ? Number(rawMaxDays) : null;
	const sanitizedExpiryDates = sanitizeDateRangeForRole({
		asOn: rawAsOn,
		role: session.user.role,
		maxDataDays,
	});
	const asOn = sanitizedExpiryDates.asOn || rawAsOn;
	const format = searchParams.get("format") || "csv"; // json, csv, excel
	const rateType = searchParams.get("rateType") || "PRate";
	const search = (searchParams.get("q") || "").toLowerCase().trim();

	if (!mrId) {
		return new NextResponse("Missing mrId", { status: 400 });
	}

	// Authorize: Admin or the MR themselves
	const requestingUserId = session.user.id;
	const isSelf = String(requestingUserId) === String(mrId);
	const isAdmin =
		(session.user as any).role === "ADMIN" ||
		(session.user as any).role === "DEVELOPER";

	if (!isSelf && !isAdmin) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo) {
		return new NextResponse("MR not found", { status: 404 });
	}

	const canViewExpiry = isAdmin || mrInfo.canViewExpiry || (mrInfo.rank !== undefined && mrInfo.rank >= 1);
	if (!canViewExpiry) {
		return new NextResponse("Forbidden: Expiry reports view disabled", { status: 403 });
	}

	// Resolve company code and division
	const assigned = mrInfo.assignments && mrInfo.assignments.length > 0 ? mrInfo.assignments : [];
	const selectedAssignments =
		company === "All"
			? assigned
			: assigned.filter(
					(a) =>
						(a.division && a.division.toLowerCase() === company.toLowerCase()) ||
						(a.manufacturer && a.manufacturer.toLowerCase() === company.toLowerCase()) ||
						(a.company && a.company.toLowerCase() === company.toLowerCase()) ||
						(a.companyCode && a.companyCode.toLowerCase() === company.toLowerCase()),
				);

	const targetCompanies = Array.from(
		new Set(selectedAssignments.map((a) => a.companyCode || a.manufacturer || a.company).filter(Boolean)),
	) as string[];

	const compCodeToQuery =
		company === "All"
			? mrInfo.companyCode || (targetCompanies.length > 0 ? targetCompanies[0] : "")
			: selectedAssignments[0]?.companyCode ||
				(mrInfo.companyCode && (mrInfo.company === company || mrInfo.division === company)
					? mrInfo.companyCode
					: company);

	const procResult = await getExpiryStockStatement({
		asOnDate: asOn,
		compCode: compCodeToQuery,
		locNo: mrInfo.locNo || "11",
		rateType: (rateType as any) || "PRate",
	});

	if (!procResult.success || !procResult.data) {
		return new NextResponse(
			`Error fetching expiry report: ${procResult.error || "Query failed"}`,
			{ status: 500 },
		);
	}

	let rawRows = procResult.data || [];

	if (company !== "All") {
		const sel = company.trim().toUpperCase();
		rawRows = rawRows.filter((r) => {
			const rowDiv = (r.Division || "").toString().trim().toUpperCase();
			const rowMkt = (r.MktBy || "").toString().trim().toUpperCase();
			return rowDiv === sel || rowDiv.includes(sel) || sel.includes(rowDiv) ||
				   rowMkt === sel || rowMkt.includes(sel) || sel.includes(rowMkt);
		});
	}

	if (search) {
		rawRows = rawRows.filter((r) => {
			return (
				(r.ItemName && r.ItemName.toLowerCase().includes(search)) ||
				(r.ItemCode && r.ItemCode.toLowerCase().includes(search)) ||
				(r.BatchNo && r.BatchNo.toLowerCase().includes(search))
			);
		});
	}

	const safeDivision = company.replace(/[^a-zA-Z0-9]/g, "_");
	const filename = `${safeDivision}_Expiry_Stock_AsOn_${asOn}`;

	// Map and sort data
	const reportData = rawRows.map((r) => {
		const qty = Number(r.Qty || 0);
		const pRate = Number(r.PRate || 0);
		const ptr = Number(r.PTR || 0);
		const mrp = Number(r.MRP || 0);
		const rate = Number(r.Rate || pRate);
		const stockValue = Number((qty * rate).toFixed(2));
		const expDtStr = r.ExpDt
			? new Date(r.ExpDt).toLocaleDateString("en-GB")
			: "N/A";

		return {
			Company: r.MktBy || mrInfo.company || "General",
			Division: r.Division || "General",
			Manufacturer: r.MktBy || mrInfo.company || "General",
			"Item Code": r.ItemCode || "",
			"Item Name": r.ItemName || "Unknown",
			Packing: r.Packing || "",
			"Batch No": r.BatchNo || "",
			"Exp. Date": expDtStr,
			Godown: String(r.Godown ?? ""),
			"Stock Qty": qty,
			PRate: pRate,
			PTR: ptr,
			MRP: mrp,
			Rate: rate,
			"Stock Value": stockValue,
		};
	});

	// Sort Company/Division -> Item Name -> Expiry Date
	reportData.sort((a, b) => {
		const compDiff = (a.Company || "").localeCompare(b.Company || "");
		if (compDiff !== 0) return compDiff;
		const nameDiff = (a["Item Name"] || "").localeCompare(b["Item Name"] || "");
		if (nameDiff !== 0) return nameDiff;
		return (a["Exp. Date"] || "").localeCompare(b["Exp. Date"] || "");
	});

	if (format === "json") {
		return NextResponse.json(reportData);
	}

	// Tabular Excel & CSV
	const companies = Array.from(new Set(reportData.map((r) => r.Company))).sort();
	const tabularData: any[] = [];
	let grandTotalQty = 0;
	let grandTotalValue = 0;

	for (const comp of companies) {
		const compRows = reportData.filter((r) => r.Company === comp);
		let compQty = 0;
		let compValue = 0;

		for (const r of compRows) {
			compQty += r["Stock Qty"];
			compValue += r["Stock Value"];
			grandTotalQty += r["Stock Qty"];
			grandTotalValue += r["Stock Value"];

			tabularData.push({
				Company: r.Company,
				Division: r.Division,
				"Item Code": r["Item Code"],
				"Item Name": r["Item Name"],
				Packing: r.Packing,
				"Batch No": r["Batch No"],
				"Exp. Date": r["Exp. Date"],
				Godown: r.Godown,
				"Stock Qty": r["Stock Qty"],
				PRate: Number(r.PRate.toFixed(2)),
				PTR: Number(r.PTR.toFixed(2)),
				MRP: Number(r.MRP.toFixed(2)),
				"Stock Value": Number(r["Stock Value"].toFixed(2)),
			});
		}

		if (companies.length > 1) {
			tabularData.push({
				Company: `Total for ${comp}`,
				Division: "",
				"Item Code": "",
				"Item Name": "",
				Packing: "",
				"Batch No": "",
				"Exp. Date": "",
				Godown: "",
				"Stock Qty": compQty,
				PRate: "" as any,
				PTR: "" as any,
				MRP: "" as any,
				"Stock Value": Number(compValue.toFixed(2)),
			});
		}
	}

	if (format === "excel") {
		const columns = [
			{ header: "Company", key: "Company", width: 20 },
			{ header: "Division", key: "Division", width: 16 },
			{ header: "Item Code", key: "Item Code", width: 14 },
			{ header: "Item Name", key: "Item Name", width: 32 },
			{ header: "Packing", key: "Packing", width: 14 },
			{ header: "Batch No", key: "Batch No", width: 14 },
			{ header: "Exp. Date", key: "Exp. Date", width: 14 },
			{ header: "Godown", key: "Godown", width: 10 },
			{ header: "Stock Qty", key: "Stock Qty", width: 12, numFmt: "#,##0" },
			{ header: "PRate", key: "PRate", width: 12, numFmt: "#,##0.00" },
			{ header: "PTR", key: "PTR", width: 12, numFmt: "#,##0.00" },
			{ header: "MRP", key: "MRP", width: 12, numFmt: "#,##0.00" },
			{ header: "Stock Value", key: "Stock Value", width: 16, numFmt: "#,##0.00" },
		];

		const excelBuf = await buildStyledExcelBuffer({
			sheetName: "Expiry Stock",
			title: "Expiry Stock Statement",
			metadata: {
				company: mrInfo.company || company,
				division: company,
				period: `As on ${new Date(asOn || Date.now()).toLocaleDateString("en-GB")}`,
				year: "2026-27",
			},
			columns,
			data: tabularData,
			totals: {
				Company: "GRAND TOTAL",
				"Stock Qty": grandTotalQty,
				"Stock Value": Number(grandTotalValue.toFixed(2)),
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

	// CSV Export
	if (tabularData.length > 0) {
		tabularData.push({
			Company: "Grand Total",
			Division: "",
			"Item Code": "",
			"Item Name": "",
			Packing: "",
			"Batch No": "",
			"Exp. Date": "",
			Godown: "",
			"Stock Qty": grandTotalQty,
			PRate: "" as any,
			PTR: "" as any,
			MRP: "" as any,
			"Stock Value": Number(grandTotalValue.toFixed(2)),
		});
	}

	const firstRow = tabularData[0];
	if (!firstRow) {
		return new NextResponse("No expiry stock data available", { status: 200 });
	}

	const headersKeys = Object.keys(firstRow);
	const csvContent = [
		headersKeys.join(","),
		...tabularData.map((row: any) =>
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
