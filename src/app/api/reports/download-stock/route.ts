import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
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

	if (!mrId) {
		return new NextResponse("Missing mrId", { status: 400 });
	}

	const requestingUserId = session.user.id;
	const isSelf = requestingUserId === mrId;
	const isAdmin = (session.user as any).role === "admin";

	if (!isSelf && !isAdmin) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	const mrInfoArr = await db.select().from(user).where(eq(user.id, mrId)).limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo) {
		return new NextResponse("MR not found", { status: 404 });
	}

	const canViewStock = isAdmin || mrInfo.canViewStock;
	if (!canViewStock) return new NextResponse("Forbidden", { status: 403 });

	const assigned = await db.select().from(mrManufacturers).where(eq(mrManufacturers.mrId, mrId));
	const manufacturerNames = assigned.map((a) => a.manufacturer);
	const companiesToQuery = company === "All" ? manufacturerNames : [company];

	if (companiesToQuery.length === 0) {
		return NextResponse.json([]);
	}

	const accessibleProducts = await db
		.select()
		.from(products)
		.where(inArray(products.manufacturer, companiesToQuery));
	const productIds = accessibleProducts.map((p) => p.id);

	if (productIds.length === 0) {
		return NextResponse.json([]);
	}

	const inventoryMap = new Map<string, any>();
	const inventory = await db
		.select()
		.from(mrInventory)
		.where(and(inArray(mrInventory.productId, productIds), eq(mrInventory.mrId, mrId)));
	
	inventory.forEach((inv) => {
		inventoryMap.set(inv.productId, {
			opening: inv.opening || 0,
			inward: inv.inward || 0,
			stock: inv.stock || 0,
			ptr: Number(inv.ptr) || 0,
			mrp: Number(inv.mrp) || 0,
		});
	});

	const salesMap = new Map<string, number>();
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
		})
		.from(sales)
		.where(salesCondition);

	accessibleSales.forEach(s => {
		salesMap.set(s.productId, (salesMap.get(s.productId) || 0) + (s.quantity || 0));
	});

	const reportData: any[] = [];
	accessibleProducts.forEach((p) => {
		const inv = inventoryMap.get(p.id);
		if (inv || salesMap.get(p.id)) {
			const opening = inv?.opening || 0;
			const purchase = inv?.inward || 0;
			const sRet = 0;
			const stkAdjAdd = 0;
			const totalIn = opening + purchase - sRet + stkAdjAdd;
			
			const salesQty = salesMap.get(p.id) || 0;
			const pRet = 0;
			const stkAdjLess = 0;
			
			const balanceQty = inv?.stock || (totalIn - salesQty - pRet - stkAdjLess);
			const ptr = inv?.ptr || 0;
			const stockValue = balanceQty * ptr;

			reportData.push({
				"MR Name": mrInfo.name,
				Manufacturer: p.manufacturer,
				"Item Name": p.name,
				Packing: "10TAB",
				"Purc Days": 31,
				"Opening Qty.": opening,
				"Purchase Qty": purchase,
				"S.Ret Qty.": sRet,
				"Stk Adj Add": stkAdjAdd,
				"Total In Qty": totalIn,
				"Sales Qty.": salesQty,
				"P.Ret Qty.": pRet,
				"Stk Adj Less": stkAdjLess,
				"Balance Qty.": balanceQty,
				"Stock Value": stockValue,
				ptr: ptr
			});
		}
	});

	reportData.sort((a, b) => {
		if (a.Manufacturer !== b.Manufacturer) return (a.Manufacturer || "").localeCompare(b.Manufacturer || "");
		return a["Item Name"].localeCompare(b["Item Name"]);
	});

	const format = searchParams.get("format") || "csv";
	const timestamp = new Date().toISOString().split("T")[0];
	const filename = `Stock_Report_${company.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}`;

	if (format === "json") {
		return NextResponse.json(reportData);
	}

	if (format === "excel") {
		// Next.js cannot natively bundle xlsx without it being imported, but since it's already used in the other route, it should be fine.
		const xlsx = require("xlsx");
		const worksheet = xlsx.utils.json_to_sheet(reportData);
		const workbook = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(workbook, worksheet, "Stock Report");
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
