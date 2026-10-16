import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { getItemCustomerSale } from "@/server/actions/customerItemSale";
import { getMRInfo } from "@/server/actions/mrInfo";
import { getDefaultTMinus1MonthRange } from "@/lib/dateUtils";
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

	const defaultT1 = getDefaultTMinus1MonthRange();
	const defaultFrom = from || defaultT1.from;
	const defaultTo = to || defaultT1.to;

	const salesResult = await getItemCustomerSale({
		fromDate: defaultFrom,
		toDate: defaultTo,
		locNo: mrInfo.locNo || "11",
		compCode: compCodeToQuery,
	});

	const rows = salesResult.success && salesResult.data ? salesResult.data : [];

	let totalQty = 0;
	let totalFreeQty = 0;
	let totalAmount = 0;

	const tabularData = rows.map((r) => {
		const qty = Number(r.Qty || 0);
		const fQty = Number(r.FQty || 0);
		const amt = Number(r.IAmt || 0);
		const rate = Number(r.Srate || r.PTR || 0);

		totalQty += qty;
		totalFreeQty += fQty;
		totalAmount += amt;

		return {
			"Inv No": r.InvNo,
			"Inv Date": r.InvDt ? new Date(r.InvDt).toISOString().split("T")[0] : "-",
			Customer: r.Customer || "Unknown Party",
			"Item Code": r.ItemCode || "-",
			"Item Name": r.ItemName,
			Packing: r.Packing || "-",
			"Batch No": r.BatchNo,
			Qty: qty,
			"Free Qty": fQty,
			Rate: Number(rate.toFixed(2)),
			Amount: Number(amt.toFixed(2)),
		};
	});

	if (tabularData.length > 0) {
		tabularData.push({
			"Inv No": "" as any,
			"Inv Date": "",
			Customer: "TOTAL :",
			"Item Code": "",
			"Item Name": "",
			Packing: "",
			"Batch No": "",
			Qty: totalQty,
			"Free Qty": totalFreeQty,
			Rate: "" as any,
			Amount: Number(totalAmount.toFixed(2)),
		});
	}

	const mrName = mrInfo.name || "Unknown";
	const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");
	const safeCompany = (company || "All").replace(/[^a-zA-Z0-9]/g, "_");
	const dateRangeTag =
		from && to ? `${from}_to_${to}` : new Date().toISOString().split("T")[0];
	const filename = `${safeMrName}_${safeCompany}_Report_${dateRangeTag}`;

	if (format === "excel") {
		const worksheet = xlsx.utils.json_to_sheet(tabularData);
		const workbook = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(workbook, worksheet, "Report");
		const arrayBuf = xlsx.write(workbook, { type: "array", bookType: "xlsx" });

		return new NextResponse(new Uint8Array(arrayBuf), {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.xlsx"`,
				"Content-Type":
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			},
		});
	} else {
		const firstRow = tabularData[0];
		if (!firstRow) {
			return new NextResponse("No data available", { status: 200 });
		}
		const headersKeys = Object.keys(firstRow);
		const csvContent = [
			headersKeys.join(","),
			...tabularData.map((row) =>
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
