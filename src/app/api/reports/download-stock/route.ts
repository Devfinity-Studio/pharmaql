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
	const isAdmin = (session.user as any).role === "ADMIN";

	if (!isSelf && !isAdmin) {
		return new NextResponse("Forbidden", { status: 403 });
	}

	const mrInfoArr = await db.select().from(user).where(eq(user.id, mrId)).limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo || (!mrInfo.canViewStock && !isAdmin)) {
		return new NextResponse("Forbidden", { status: 403 });
	}

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

	let inventoryCondition = and(inArray(mrInventory.productId, productIds), eq(mrInventory.mrId, mrId));
	if (to) {
		const toDate = new Date(to);
		if (!isNaN(toDate.getTime())) {
			toDate.setUTCHours(23, 59, 59, 999);
			inventoryCondition = and(inventoryCondition, lte(mrInventory.date, toDate));
		}
	}

	const inventory = await db
		.select()
		.from(mrInventory)
		.where(inventoryCondition);

	const nextDayInventoryMap = new Map<string, number>();
	if (to) {
		const toDate = new Date(to);
		if (!isNaN(toDate.getTime())) {
			toDate.setUTCDate(toDate.getUTCDate() + 1);
			toDate.setUTCHours(0, 0, 0, 0);
			const nextInv = await db
				.select({
					productId: mrInventory.productId,
					opening: mrInventory.opening
				})
				.from(mrInventory)
				.where(
					and(
						eq(mrInventory.mrId, mrId),
						eq(mrInventory.date, toDate)
					)
				);
			nextInv.forEach(inv => {
				nextDayInventoryMap.set(inv.productId, inv.opening || 0);
			});
		}
	}

	// Sort by date ascending
	inventory.sort((a, b) => {
		const da = a.date ? new Date(a.date).getTime() : 0;
		const dbVal = b.date ? new Date(b.date).getTime() : 0;
		return da - dbVal;
	});

	const inventoryMap = new Map<string, { opening: number; inward: number; outward: number; stock: number; ptr: number; mrp: number; prate: number; hasSeenInPeriod?: boolean }>();
	const limitFromDate = from ? new Date(from) : null;

	inventory.forEach((inv) => {
		const isBefore = limitFromDate && inv.date && new Date(inv.date) < limitFromDate;
		const existing = inventoryMap.get(inv.productId);

		if (isBefore) {
			inventoryMap.set(inv.productId, {
				opening: inv.stock || 0,
				inward: 0,
				outward: 0,
				stock: inv.stock || 0,
				ptr: Number(inv.ptr) || 0,
				mrp: Number(inv.mrp) || 0,
				prate: Number(inv.prate) || 0,
				hasSeenInPeriod: false,
			});
		} else {
			if (!existing) {
				inventoryMap.set(inv.productId, {
					opening: inv.opening || 0,
					inward: inv.inward || 0,
					outward: inv.outward || 0,
					stock: inv.stock || 0,
					ptr: Number(inv.ptr) || 0,
					mrp: Number(inv.mrp) || 0,
					prate: Number(inv.prate) || 0,
					hasSeenInPeriod: true,
				});
			} else {
				if (!existing.hasSeenInPeriod) {
					existing.opening = inv.opening || 0;
					existing.inward = inv.inward || 0;
					existing.outward = inv.outward || 0;
					existing.stock = inv.stock || 0;
					existing.hasSeenInPeriod = true;
				} else {
					existing.inward += inv.inward || 0;
					existing.outward += inv.outward || 0;
					existing.stock = inv.stock || 0;
				}
	const reportData: any[] = [];
	const limitFromDate = from ? new Date(from) : null;
	const limitToDate = to ? new Date(to) : new Date('9999-12-31T23:59:59.999Z');
	if (to) limitToDate.setUTCHours(23, 59, 59, 999);

	const { sql } = await import("drizzle-orm");
	for (const prod of accessibleProducts) {
		const res = await db.execute(sql`
			SELECT 
				SUM(opening) as opening,
				SUM(inward) as purchase,
				SUM(s_ret_inward) as s_return,
				SUM(add_stock_adj) as stk_adj_add,
				SUM(sale_qty + sale_f_qty) as sales_qty,
				SUM(outward) as p_return,
				SUM(less_stock_adj) as stk_adj_less,
				SUM(opening + curr_qty) as curr_qty,
				MAX(prate) as prate,
				MAX(ptr) as ptr,
				MAX(mrp) as mrp,
				SUM(opening) * MAX(prate) as opening_value,
				SUM(inward) * MAX(prate) as purchase_value,
				SUM(sale_qty + sale_f_qty) * MAX(prate) as sales_value,
				SUM(opening + curr_qty) * MAX(prate) as stock_value
			FROM (
				SELECT SUM(v.qty) as opening, 0 as inward, 0 as s_ret_inward, 0 as add_stock_adj, 0 as sale_qty, 0 as sale_f_qty, 0 as outward, 0 as less_stock_adj, 0 as curr_qty,
				v.batch_id,
				MAX(h.prate) as prate, MAX(h.ptr) as ptr, MAX(h.mrp) as mrp
				FROM "pg-drizzle_legacy_view_stocks" v
				LEFT JOIN "pg-drizzle_legacy_h_batch" h ON h.id = v.batch_id AND h.item_id = v.item_id
				WHERE v.item_id = ${prod.id} AND v.loc_no = ${mrInfo.locNo.toString()} AND v.t_date < ${(limitFromDate || new Date(0)).toISOString()}
				GROUP BY v.batch_id
				
				UNION ALL
				
				SELECT 0 as opening, SUM(v.inward) as inward, SUM(v.s_ret_inward) as s_ret_inward, SUM(v.add_stock_adj) as add_stock_adj, SUM(v.sale_qty) as sale_qty, SUM(v.sale_f_qty) as sale_f_qty, SUM(v.outward) as outward, SUM(v.less_stock_adj) as less_stock_adj, SUM(v.qty) as curr_qty,
				v.batch_id,
				MAX(h.prate) as prate, MAX(h.ptr) as ptr, MAX(h.mrp) as mrp
				FROM "pg-drizzle_legacy_view_stocks" v
				LEFT JOIN "pg-drizzle_legacy_h_batch" h ON h.id = v.batch_id AND h.item_id = v.item_id
				WHERE v.item_id = ${prod.id} AND v.loc_no = ${mrInfo.locNo.toString()} AND v.t_date >= ${(limitFromDate || new Date(0)).toISOString()} AND v.t_date <= ${limitToDate.toISOString()}
				GROUP BY v.batch_id
			) as a
		`);
		
		const r = res[0] as any;
		
		const opening = Number(r.opening || 0);
		const purchase = Number(r.purchase || 0);
		const salesQty = Number(r.sales_qty || 0);
		const currQty = Number(r.curr_qty || 0);

		if (r && (opening !== 0 || purchase !== 0 || currQty !== 0 || salesQty !== 0)) {
			const prate = Number(r.prate || 0);
			const ptr = Number(r.ptr || 0);
			const mrp = Number(r.mrp || 0);

			reportData.push({
				"MR Name": mrInfo.name,
				Manufacturer: p.manufacturer,
				"Item Name": p.name,
				Packing: p.freeScheme || "-",
				"Purc Days": 30,
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
				prate: prate,
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
