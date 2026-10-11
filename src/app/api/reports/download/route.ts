import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { getItemCustomerSale } from "@/server/actions/customerItemSale";
import { getMRInfo } from "@/server/actions/mrInfo";
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
	const format = searchParams.get("format") || "csv";

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
	if (!mrInfo) {
		return new NextResponse("MR not found", { status: 404 });
	}

	const compCodeToQuery =
		company === "All"
			? mrInfo.companyCode || ""
			: mrInfo.companyCode &&
					(mrInfo.company === company || mrInfo.division === company)
				? mrInfo.companyCode
				: company;

	const defaultFrom = from || "2026-04-01";
	const defaultTo = to || "2026-09-30";

	const salesResult = await getItemCustomerSale({
		fromDate: defaultFrom,
		toDate: defaultTo,
		locNo: mrInfo.locNo || "11",
		compCode: compCodeToQuery,
	});

	const rows = salesResult.success && salesResult.data ? salesResult.data : [];

	const reportData = rows.map((r) => ({
		"Inv No": r.InvNo,
		"Inv Date": r.InvDt ? new Date(r.InvDt).toISOString().split("T")[0] : "-",
		Customer: r.Customer || "Unknown Party",
		"Item Code": r.ItemCode || "-",
		"Item Name": r.ItemName,
		Packing: r.Packing || "-",
		"Batch No": r.BatchNo,
		Qty: Number(r.Qty),
		"Free Qty": Number(r.FQty),
		Rate: Number(r.Srate || r.PTR || 0).toFixed(2),
		Amount: Number(r.IAmt || 0).toFixed(2),
	}));

	const timestamp = new Date().toISOString().split("T")[0];
	const filename = `Report_${(company || "All").replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}`;

	if (format === "excel") {
		const worksheet = xlsx.utils.json_to_sheet(reportData);
		const workbook = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(workbook, worksheet, "Report");
		const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

		return new NextResponse(buffer, {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.xlsx"`,
				"Content-Type":
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			},
		});
	} else {
		if (reportData.length === 0 || !reportData[0]) {
			return new NextResponse("No data available", { status: 200 });
		}
		const headersKeys = Object.keys(reportData[0]);
		const csvContent = [
			headersKeys.join(","),
			...reportData.map((row) =>
				headersKeys
					.map((key) => {
						const val = (row as any)[key];
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
