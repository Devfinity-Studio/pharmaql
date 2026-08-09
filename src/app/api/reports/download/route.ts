import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
	mrInventory,
	mrManufacturers,
	products,
	sales,
	user,
} from "@/server/db/schema";

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
	const canViewStock = isAdmin || mrInfo.canViewStock;
	const canViewFreeScheme = isAdmin || mrInfo.canViewFreeScheme;

	// Get MR's assigned manufacturers
	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));
	const manufacturerNames = assigned.map((a) => a.manufacturer);
	const companiesToQuery = company === "All" ? manufacturerNames : [company];

	if (companiesToQuery.length === 0) {
		return new NextResponse("No data assigned", { status: 404 });
	}

	// Get Products
	const accessibleProducts = await db
		.select()
		.from(products)
		.where(inArray(products.manufacturer, companiesToQuery));
	const productIds = accessibleProducts.map((p) => p.id);

	if (productIds.length === 0) {
		return new NextResponse("No products found", { status: 404 });
	}

	// Fetch Stock details for MRP and PTR
	const stockMap = new Map<string, { mrp: number; ptr: number }>();
	if (canViewStock) {
		let inventoryCondition = and(
			inArray(mrInventory.productId, productIds),
			eq(mrInventory.mrId, mrId),
		);
		if (to) {
			const toDate = new Date(to);
			if (!isNaN(toDate.getTime())) {
				toDate.setUTCHours(23, 59, 59, 999);
				inventoryCondition = and(
					inventoryCondition,
					lte(mrInventory.date, toDate),
				);
			}
		}

		const inventory = await db
			.select()
			.from(mrInventory)
			.where(inventoryCondition);

		// Sort by date ascending so latest record overwrites
		inventory.sort((a, b) => {
			const da = a.date ? new Date(a.date).getTime() : 0;
			const dbVal = b.date ? new Date(b.date).getTime() : 0;
			return da - dbVal;
		});

		inventory.forEach((inv) =>
			stockMap.set(inv.productId, {
				mrp: Number(inv.mrp) || 0,
				ptr: Number(inv.ptr) || 0,
			}),
		);
	}

	// Fetch Sales with dealer (Party)
	type SaleDetail = {
		productId: string;
		quantity: number;
		freeQty: number | null;
		dealer: string | null;
	};
	const salesDetails: SaleDetail[] = [];
	if (canViewSales) {
		let salesCondition = and(
			inArray(sales.productId, productIds),
			eq(sales.mrId, mrId),
		);
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
			})
			.from(sales)
			.where(salesCondition);

		salesDetails.push(...accessibleSales);
	}

	// Build Output Data
	const timestampStr = new Date().toLocaleString("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const mrName = mrInfo.name || "Unknown MR";

	// Generate rows. We'll create a row for each sale detail.
	// If a product has no sales, we still might want it in the CSV if they want a stock report,
	// but for claims we usually only show sold items. Let's include all products, grouping sales by dealer.

	const reportData: any[] = [];

	accessibleProducts.forEach((p) => {
		const pStock = stockMap.get(p.id) || { mrp: 0, ptr: 0 };
		const pSales = salesDetails.filter((s) => s.productId === p.id);

		if (pSales.length === 0) {
			// No sales, add a generic row for stock
			reportData.push({
				"MR Name": mrName,
				Manufacturer: p.manufacturer,
				ClaimType: "Qty",
				Party: "NO SALES",
				Code: p.code || "",
				"Product Name": p.name,
				Packing: "",
				"Batch No.": "",
				"Inv. No.": "",
				"Inv. Dt.": "",
				MRP: pStock.mrp,
				PRate: pStock.ptr,
				PTR: pStock.ptr,
				"Net Rate": 0,
				"Inv. Rate": 0,
				"Sale Qty": 0,
				"Free Qty": 0,
				"Actual FQty": 0,
				"Claim Qty": 0,
				"Rate Diff.": 0,
				"Claim Value": 0,
				"Item Scheme": p.freeScheme || "",
				"Applied Scheme": "",
				"Generated At": timestampStr,
			});
		} else {
			// Group sales by dealer
			const dealerMap = new Map<string, { qty: number; free: number }>();
			pSales.forEach((s) => {
				const party = s.dealer || "UNKNOWN PARTY";
				const curr = dealerMap.get(party) || { qty: 0, free: 0 };
				curr.qty += s.quantity || 0;
				curr.free += s.freeQty || 0;
				dealerMap.set(party, curr);
			});

			dealerMap.forEach((totals, party) => {
				reportData.push({
					"MR Name": mrName,
					Manufacturer: p.manufacturer,
					ClaimType: "Qty",
					Party: party,
					Code: p.code || "",
					"Product Name": p.name,
					Packing: "",
					"Batch No.": "",
					"Inv. No.": "",
					"Inv. Dt.": "",
					MRP: pStock.mrp,
					PRate: pStock.ptr,
					PTR: pStock.ptr,
					"Net Rate": 0,
					"Inv. Rate": 0,
					"Sale Qty": totals.qty,
					"Free Qty": totals.free,
					"Actual FQty": 0,
					"Claim Qty": 0, // Logic to be provided later
					"Rate Diff.": 0,
					"Claim Value": 0, // Logic to be provided later
					"Item Scheme": p.freeScheme || "",
					"Applied Scheme": "",
					"Generated At": timestampStr,
				});
			});
		}
	});

	// Sort by Manufacturer -> Party -> Product Name
	reportData.sort((a, b) => {
		if (a.Manufacturer !== b.Manufacturer)
			return (a.Manufacturer || "").localeCompare(b.Manufacturer || "");
		if (a.Party !== b.Party)
			return (a.Party || "").localeCompare(b.Party || "");
		return a["Product Name"].localeCompare(b["Product Name"]);
	});

	const timestamp = new Date().toISOString().split("T")[0];
	const filename = `Report_${company.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}`;

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
		const headersKeys = Object.keys(reportData[0]);
		const csvContent = [
			headersKeys.join(","),
			...reportData.map((row) =>
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
