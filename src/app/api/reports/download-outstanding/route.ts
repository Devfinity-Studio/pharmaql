import { and, eq, gte, lte, or } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { mrManufacturers, outstanding, user } from "@/server/db/schema";

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
	const isAdmin = (session.user as any).role === "admin";

	if (!isSelf && !isAdmin) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	// Get MR Info to check permissions
	const mrInfoArr = await db
		.select()
		.from(user)
		.where(eq(user.id, mrId))
		.limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo) {
		return new NextResponse("MR not found", { status: 404 });
	}

	const canViewSales = isAdmin || mrInfo.canViewSales;

	if (!canViewSales) {
		return new NextResponse("Forbidden - Sales view disabled", { status: 403 });
	}

	// Get MR's assigned manufacturers/divisions
	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));

	const selectedAssignments =
		division === "All"
			? assigned
			: assigned.filter((a) => (a.division || a.manufacturer) === division);

	if (selectedAssignments.length === 0) {
		return new NextResponse("No data assigned", { status: 404 });
	}

	// Build Outstanding Condition
	const outstandingConditionList = selectedAssignments.map((d) => {
		const conditions = [eq(outstanding.manufacturerCode, d.manufacturer)];
		if (d.division) {
			conditions.push(eq(outstanding.division, d.division));
		}
		return and(...conditions);
	});

	let outstandingCondition = and(
		eq(outstanding.mrId, mrId),
		or(...outstandingConditionList),
	);

	if (from) {
		const fromDate = new Date(from);
		if (!isNaN(fromDate.getTime())) {
			outstandingCondition = and(
				outstandingCondition,
				gte(outstanding.invDt, fromDate),
			);
		}
	}

	if (to) {
		const toDate = new Date(to);
		if (!isNaN(toDate.getTime())) {
			toDate.setUTCHours(23, 59, 59, 999);
			outstandingCondition = and(
				outstandingCondition,
				lte(outstanding.invDt, toDate),
			);
		}
	}

	const accessibleOutstanding = outstandingCondition
		? await db.select().from(outstanding).where(outstandingCondition)
		: [];

	// Build Output Data
	const timestampStr = new Date().toLocaleString("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const mrName = mrInfo.name || "Unknown MR";

	const reportData = accessibleOutstanding.map((out) => {
		return {
			"MR Name": mrName,
			"Doctor / Party": out.doctor || "Unknown",
			City: out.city || "Unknown",
			"Invoice No": out.invNo || "N/A",
			"Invoice Date": out.invDt
				? new Date(out.invDt).toLocaleDateString()
				: "N/A",
			Division: out.division || "N/A",
			"Company Code": out.manufacturerCode || "N/A",
			"Amount Due": out.invAmt ? parseFloat(out.invAmt) : 0,
			"Generated At": timestampStr,
		};
	});

	// Sort by Amount Descending
	reportData.sort(
		(a, b) => (b["Amount Due"] as number) - (a["Amount Due"] as number),
	);

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
