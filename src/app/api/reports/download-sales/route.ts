import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { mrInventory, mrManufacturers, products, sales, user } from "@/server/db/schema";

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
	const format = searchParams.get("format") || "csv"; // csv, excel, json
	const tab = searchParams.get("tab") || "sales"; // sales or products

	if (!mrId) {
		return new NextResponse("Missing mrId", { status: 400 });
	}

	const requestingUserId = session.user.id;
	const isSelf = requestingUserId === mrId;
	const isAdmin = (session.user as any).role === "ADMIN";

	if (!isSelf && !isAdmin) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	const mrInfoArr = await db
		.select()
		.from(user)
		.where(eq(user.id, mrId))
		.limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo) {
		return new NextResponse("MR not found", { status: 404 });
	}

	const canView = tab === "sales" ? (isAdmin || mrInfo.canViewSales) : (isAdmin || mrInfo.canViewProductWise);
	if (!canView) {
		return new NextResponse("Forbidden - View disabled", { status: 403 });
	}

	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));

	const manufacturerNames = assigned.map((a) => a.manufacturer);
	const companiesToQuery = company === "All" ? manufacturerNames : [company];

	if (companiesToQuery.length === 0) {
		return new NextResponse("No data assigned", { status: 404 });
	}

	const accessibleProducts = await db
		.select()
		.from(products)
		.where(inArray(products.manufacturer, companiesToQuery));
	const productIds = accessibleProducts.map((p) => p.id);

	if (productIds.length === 0) {
		return new NextResponse("No products found", { status: 404 });
	}

	const reportData: any[] = [];
	const mrName = mrInfo.name || "Unknown MR";

	if (tab === "sales") {
		let salesCondition = and(inArray(sales.productId, productIds), eq(sales.mrId, mrId));
		if (from) {
			const fromDate = new Date(from);
			if (!isNaN(fromDate.getTime())) {
				salesCondition = and(salesCondition, gte(sales.date, fromDate));
			}
		}
		if (to) {
			const toDate = new Date(to);
			if (!isNaN(toDate.getTime())) {
				toDate.setUTCHours(23, 59, 59, 999);
				salesCondition = and(salesCondition, lte(sales.date, toDate));
			}
		}

		const accessibleSales = await db
			.select({
				productId: sales.productId,
				quantity: sales.quantity,
				freeQty: sales.freeQty,
				dealer: sales.dealer,
				amount: sales.amount,
				date: sales.date
			})
			.from(sales)
			.where(salesCondition);

		accessibleSales.forEach(s => {
			const p = accessibleProducts.find(prod => prod.id === s.productId);
			if (p) {
				reportData.push({
					"MR Name": mrName,
					Manufacturer: p.manufacturer,
					"Doctor / Party": s.dealer || "Unknown Party",
					"Product Name": p.name,
					"Date": s.date ? new Date(s.date).toLocaleDateString() : "-",
					"Sale Qty": s.quantity || 0,
					"Free Qty": s.freeQty || 0,
					Amount: s.amount ? parseFloat(s.amount.toString()) : 0,
				});
			}
		});
	} else if (tab === "products") {
		// Products
		const inventoryMap = new Map<string, number>();
		if (mrInfo.canViewStock || isAdmin) {
			const inventory = await db
				.select()
				.from(mrInventory)
				.where(and(inArray(mrInventory.productId, productIds), eq(mrInventory.mrId, mrId)));
			inventory.forEach((inv) => {
				inventoryMap.set(inv.productId, inv.stock || 0);
			});
		}

		let salesCondition = and(inArray(sales.productId, productIds), eq(sales.mrId, mrId));
		if (from) {
			const fromDate = new Date(from);
			if (!isNaN(fromDate.getTime())) {
				salesCondition = and(salesCondition, gte(sales.date, fromDate));
			}
		}
		if (to) {
			const toDate = new Date(to);
			if (!isNaN(toDate.getTime())) {
				toDate.setUTCHours(23, 59, 59, 999);
				salesCondition = and(salesCondition, lte(sales.date, toDate));
			}
		}

		const accessibleSales = (mrInfo.canViewSales || isAdmin) ? await db
			.select({
				productId: sales.productId,
				quantity: sales.quantity,
				amount: sales.amount,
			})
			.from(sales)
			.where(salesCondition) : [];

		const salesMap = new Map<string, { qty: number; amount: number }>();
		accessibleSales.forEach(s => {
			const curr = salesMap.get(s.productId) || { qty: 0, amount: 0 };
			curr.qty += s.quantity || 0;
			curr.amount += s.amount ? parseFloat(s.amount.toString()) : 0;
			salesMap.set(s.productId, curr);
		});

		accessibleProducts.forEach(p => {
			const s = salesMap.get(p.id) || { qty: 0, amount: 0 };
			reportData.push({
				"MR Name": mrName,
				Manufacturer: p.manufacturer,
				"Product Name": p.name,
				"Free Scheme": p.freeScheme || "N/A",
				"Current Stock": inventoryMap.get(p.id) || 0,
				"Total Sales Qty": s.qty,
				"Total Sales Amt": s.amount,
			});
		});
	}

	const timestamp = new Date().toISOString().split("T")[0];
	const filename = `${tab === "sales" ? "Sales" : "Products"}_Report_${company.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}`;

	if (format === "json") {
		return NextResponse.json(reportData);
	}

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
		// CSV
		if (reportData.length === 0 || !reportData[0]) {
			return new NextResponse("No data available", { status: 200 });
		}
		const headersRow = Object.keys(reportData[0]).join(",");
		const csvRows = reportData.map((row) =>
			Object.values(row)
				.map((value) => `"${String(value).replace(/"/g, '""')}"`)
				.join(","),
		);
		const csvString = [headersRow, ...csvRows].join("\n");

		return new NextResponse(csvString, {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.csv"`,
				"Content-Type": "text/csv; charset=utf-8",
			},
		});
	}
}
