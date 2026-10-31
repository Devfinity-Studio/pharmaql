import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { recordAuditEvent } from "@/lib/audit-logger";
import { getDefaultTMinus1MonthRange } from "@/lib/dateUtils";
import { buildStyledExcelBuffer } from "@/lib/excel";
import { rateLimitReportDownload } from "@/lib/rate-limit";
import { getClientIp, getClientUserAgent } from "@/lib/security";
import { getMRInfo } from "@/server/actions/mrInfo";
import { getMRwisePeriodicalOutstanding } from "@/server/actions/overdueReports";
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
				endpoint: "/api/reports/download-outstanding",
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
	const division =
		searchParams.get("division") || searchParams.get("company") || "All";
	const from = searchParams.get("from");
	const to = searchParams.get("to");
	const format = searchParams.get("format") || "csv"; // csv or excel

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

	// Get MR Info to check permissions
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo) {
		return new NextResponse("MR not found", { status: 404 });
	}

	const canViewOverdue = isSelf || isAdmin || mrInfo.canViewSales;

	if (!canViewOverdue) {
		return new NextResponse("Forbidden - View disabled", { status: 403 });
	}

	// Query live stored procedure rptMRwisePeriodicalOutstanding
	const compCodeToQuery = (() => {
		if (division === "All") {
			const allCodes = Array.from(
				new Set(
					(mrInfo.assignments || []).map((a) => a.companyCode).filter(Boolean),
				),
			);
			return allCodes.length > 0
				? allCodes.join(",")
				: mrInfo.companyCode || mrInfo.company || "";
		}
		const matchingAssignment = (mrInfo.assignments || []).find(
			(a) =>
				a.division === division ||
				a.manufacturer === division ||
				a.company === division,
		);
		if (matchingAssignment?.companyCode) return matchingAssignment.companyCode;
		return mrInfo.companyCode || division;
	})();

	const defaultT1 = getDefaultTMinus1MonthRange();
	const defaultFrom = from || defaultT1.from;
	const defaultTo = to || defaultT1.to;

	const targetMrId =
		division === "All" && mrInfo.allIds && mrInfo.allIds.length > 0
			? mrInfo.allIds.join(", ")
			: mrInfo.assignments?.find(
					(a) => a.division === division || a.manufacturer === division,
				)?.id || mrId;

	const procResult = await getMRwisePeriodicalOutstanding({
		mrId: targetMrId,
		compCode: compCodeToQuery,
		fromDate: defaultFrom,
		toDate: defaultTo,
		recDate: defaultTo,
		locNo: mrInfo.locNo || "11",
	});

	if (!procResult.success || !procResult.data) {
		return new NextResponse(
			`Error fetching outstanding report: ${procResult.error || "Query failed"}`,
			{ status: 500 },
		);
	}

	const timestampStr = new Date().toLocaleString("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const mrName = mrInfo.name || "Unknown MR";
	const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");
	const safeDivision = division.replace(/[^a-zA-Z0-9]/g, "_");
	const dateRangeTag =
		from && to ? `${from}_to_${to}` : new Date().toISOString().split("T")[0];
	const filename = `${safeMrName}_${safeDivision}_Outstanding_${dateRangeTag}`;

	let rawOutRows = procResult.data || [];
	if (division !== "All") {
		const sel = division.trim().toUpperCase();
		rawOutRows = rawOutRows.filter((r) => {
			const rowDiv = (r.Division || "").toString().trim().toUpperCase();
			const rowComp = (r.CompCode || "").toString().trim().toUpperCase();
			if (rowDiv) {
				return rowDiv === sel || rowDiv.includes(sel) || sel.includes(rowDiv);
			}
			return rowComp === sel || rowComp.includes(sel) || sel.includes(rowComp);
		});
	}

	// Filter strictly for Amount - AdjAmt > 0 (pending balance)
	const reportData = rawOutRows
		.map((row) => {
			const originalAmt = Number(row.Amount || 0);
			const adjAmt = Number(row.AdjAmt || 0);
			const balanceAmt = originalAmt - adjAmt;
			const billDateStr = row.DocDate
				? new Date(row.DocDate).toLocaleDateString("en-GB")
				: "N/A";
			const dueDateStr = row.DueDate ? String(row.DueDate).split("T")[0] : billDateStr;
			const recDateStr = row.RecDate
				? new Date(row.RecDate).toLocaleDateString("en-GB")
				: "";
			const rawDueDays = Number(row.OverDays || 0);

			return {
				"MR Name": row.MRName || mrName,
				"Doc Type": row.DocType || "SALE",
				"City": row.City || "Unknown",
				"Area": row.Area || "General",
				"Customer Code": row.CustCode || "",
				"Customer / Party": row.Customer || "Unknown",
				"Doctor / Party": row.Customer || "Unknown",
				"Address": row.Address1 || "",
				"Bill No": row.DocNo || "N/A",
				"Invoice No": row.DocNo || "N/A",
				"Bill Date": billDateStr,
				"Invoice Date": billDateStr,
				"Due Date": dueDateStr,
				"Due Days": rawDueDays,
				"Invoice Amount": originalAmt,
				"Received Amount": adjAmt,
				"Received Date": recDateStr,
				"Pending Amount": balanceAmt,
				"Balance Amount": balanceAmt,
				"Amount Due": balanceAmt,
				"Purchase Days": rawDueDays,
				"Overdue Days": rawDueDays,
				Division: row.Division || division,
				"Company Code": row.CompCode || compCodeToQuery,
				Company: row.CompCode || compCodeToQuery || row.Division || division,
				Manufacturer: row.CompCode || row.Division || division,
				"Generated At": timestampStr,
			};
		})
		.filter((r) => r["Pending Amount"] > 0);

	// Sort by Purchase Days descending
	reportData.sort((a, b) => b["Purchase Days"] - a["Purchase Days"]);

	if (format === "json") {
		return NextResponse.json(reportData);
	}

	// Tabular spreadsheet data
	let totalOriginalAmt = 0;
	let totalAdjAmt = 0;
	let totalBalanceAmt = 0;

	const tabularData = reportData.map((r) => {
		totalOriginalAmt += r["Invoice Amount"];
		totalAdjAmt += r["Received Amount"];
		totalBalanceAmt += r["Pending Amount"];

		return {
			"MR Name": r["MR Name"],
			City: r.City,
			Area: r.Area,
			"Customer / Party": r["Customer / Party"],
			"Doc Type": r["Doc Type"],
			"Invoice No": r["Invoice No"],
			"Invoice Date": r["Invoice Date"],
			"Due Date": r["Due Date"],
			"Due Days": r["Due Days"],
			"Invoice Amount": Number(r["Invoice Amount"].toFixed(2)),
			"Received Amount": Number(r["Received Amount"].toFixed(2)),
			"Received Date": r["Received Date"],
			"Pending Amount": Number(r["Pending Amount"].toFixed(2)),
		};
	});

	if (format === "excel") {
		const columns = [
			{ header: "Customer / Party", key: "Customer / Party", width: 32 },
			{ header: "City", key: "City", width: 18 },
			{ header: "Bill No", key: "Bill No", width: 14 },
			{ header: "Bill Date", key: "Bill Date", width: 14 },
			{
				header: "Bill Amount",
				key: "Bill Amount",
				width: 16,
				numFmt: "#,##0.00",
			},
			{
				header: "Adjusted Amount",
				key: "Adjusted Amount",
				width: 16,
				numFmt: "#,##0.00",
			},
			{
				header: "Balance Amount",
				key: "Balance Amount",
				width: 16,
				numFmt: "#,##0.00",
			},
			{
				header: "Overdue Days",
				key: "Overdue Days",
				width: 14,
				numFmt: "#,##0",
			},
			{ header: "Division", key: "Division", width: 18 },
		];

		const excelBuf = await buildStyledExcelBuffer({
			sheetName: "Outstanding",
			title: "Overdue & Periodical Outstanding Statement",
			metadata: {
				mrName,
				company: mrInfo.company || division,
				division: mrInfo.division || division,
				period: from && to ? `${from} to ${to}` : "Current",
				year: "2026-27",
			},
			columns,
			data: tabularData,
			totals: {
				"Customer / Party": "GRAND TOTAL",
				"Bill Amount": Number(totalOriginalAmt.toFixed(2)),
				"Adjusted Amount": Number(totalAdjAmt.toFixed(2)),
				"Balance Amount": Number(totalBalanceAmt.toFixed(2)),
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
			"MR Name": "Grand Total",
			City: "",
			Area: "",
			"Customer / Party": "",
			"Doc Type": "",
			"Invoice No": "",
			"Invoice Date": "",
			"Due Date": "",
			"Due Days": "" as any,
			"Invoice Amount": Number(totalOriginalAmt.toFixed(2)),
			"Received Amount": Number(totalAdjAmt.toFixed(2)),
			"Received Date": "",
			"Pending Amount": Number(totalBalanceAmt.toFixed(2)),
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
