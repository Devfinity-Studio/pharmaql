import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { getMRInfo } from "@/server/actions/mrInfo";
import { getMRwisePeriodicalOutstanding } from "@/server/actions/overdueReports";
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
	const division = searchParams.get("division") || "All";
	const from = searchParams.get("from");
	const to = searchParams.get("to");
	const format = searchParams.get("format") || "csv"; // csv or excel

	if (!mrId) {
		return new NextResponse("Missing mrId", { status: 400 });
	}

	// Authorize: Admin or the MR themselves
	const requestingUserId = session.user.id;
	const isSelf = requestingUserId === mrId;
	const isAdmin = (session.user as any).role === "ADMIN";

	if (!isSelf && !isAdmin) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	// Get MR Info to check permissions
	const mrInfo = await getMRInfo(mrId);
	if (!mrInfo) {
		return new NextResponse("MR not found", { status: 404 });
	}

	const canViewSales = isAdmin || mrInfo.canViewSales;

	if (!canViewSales) {
		return new NextResponse("Forbidden - Sales view disabled", { status: 403 });
	}

	// Query live stored procedure rptMRwisePeriodicalOutstanding
	const compCodeToQuery =
		division === "All"
			? mrInfo.companyCode || mrInfo.company || ""
			: mrInfo.companyCode &&
					(mrInfo.company === division || mrInfo.division === division)
				? mrInfo.companyCode
				: division;

	const defaultFrom = from || "2026-04-01";
	const defaultTo = to || "2026-09-30";

	const procResult = await getMRwisePeriodicalOutstanding({
		mrId,
		compCode: compCodeToQuery,
		fromDate: defaultFrom,
		toDate: defaultTo,
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

	// Filter strictly for Amount - AdjAmt > 0 (pending balance)
	const reportData = procResult.data
		.map((row) => {
			const originalAmt = Number(row.Amount || 0);
			const adjAmt = Number(row.AdjAmt || 0);
			const balanceAmt = originalAmt - adjAmt;
			const billDateStr = row.DocDate
				? new Date(row.DocDate).toLocaleDateString("en-GB")
				: "N/A";
			return {
				"MR Name": mrName,
				"Customer / Party": row.Customer || "Unknown",
				City: row.City || "Unknown",
				"Bill No": row.DocNo || "N/A",
				"Bill Date": billDateStr,
				"Bill Amount": originalAmt,
				"Adjusted Amount": adjAmt,
				"Balance Amount": balanceAmt,
				"Purchase Days": Number(row.OverDays || 0),
				Division: row.Division || division,
				"Company Code": row.CompCode || compCodeToQuery,
				"Generated At": timestampStr,
			};
		})
		.filter((r) => r["Balance Amount"] > 0);

	// Sort by Purchase Days descending
	reportData.sort((a, b) => b["Purchase Days"] - a["Purchase Days"]);

	const timestamp = new Date().toISOString().split("T")[0];
	const filename = `Outstanding_Invoices_${division.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}`;

	if (format === "json") {
		return NextResponse.json(reportData);
	}

	if (format === "excel") {
		const worksheet = xlsx.utils.json_to_sheet(reportData);
		const workbook = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(workbook, worksheet, "Outstanding");
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
			...reportData.map((row: any) =>
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
