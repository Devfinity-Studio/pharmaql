import { and, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
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

	const canView =
		tab === "sales"
			? isAdmin || mrInfo.canViewSales
			: isAdmin || mrInfo.canViewProductWise;
	if (!canView) {
		return new NextResponse("Forbidden - View disabled", { status: 403 });
	}

	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));

	let validAssignments = assigned;
	if (company !== "All") {
		validAssignments = assigned.filter(
			(a) => a.division === company || a.manufacturer === company,
		);
	}

	if (validAssignments.length === 0) {
		return new NextResponse("No data assigned", { status: 404 });
	}

	const productConditionList = validAssignments.map((d) => {
		const conditions = [eq(products.manufacturer, d.manufacturer)];
		if (d.division) {
			conditions.push(eq(products.division, d.division));
		}
		return and(...conditions);
	});

	const accessibleProducts = await db
		.select()
		.from(products)
		.where(or(...productConditionList));
	const productIds = accessibleProducts.map((p) => p.id);

	if (productIds.length === 0) {
		return new NextResponse("No products found", { status: 404 });
	}

	const reportData: any[] = [];
	const mrName = mrInfo.name || "Unknown MR";

	if (tab === "sales") {
		// New Sales Report
		let dateCondition = ``;
		if (from) {
			dateCondition += ` AND h.inv_dt >= '${from}'`;
		}
		if (to) {
			dateCondition += ` AND h.inv_dt <= '${to}'`;
		}

		const legacyDataResult = await db.execute(sql.raw(`
			SELECT 
				h.inv_no as "InvNo",
				h.inv_dt as "InvDt",
				CONCAT(h.cust_id, ' ', COALESCE(c.name, 'Unknown Party'), ' , ', COALESCE(c.city, '')) as "Customer",
				l.item_id as "ItemID",
				l.batch_no as "BatchNo",
				l.mrp as "MRP",
				l.exp_dt as "ExpDt",
				l.qty as "Qty",
				l.f_qty as "FQty",
				l.rate as "Rate",
				l.taxable_amt as "TaxableAmt",
				l.vat_amt as "GSTAmt",
				l.line_amt as "Amount"
			FROM "pg-drizzle_legacy_h_sale" h
			JOIN "pg-drizzle_legacy_l_sale" l ON l.rid = h.id
			LEFT JOIN "pg-drizzle_legacy_customers" c ON c.id = h.cust_id
			WHERE l.item_id IN (${productIds.map(id => `'${id}'`).join(",")})
			${dateCondition}
		`));

		const legacyRows = legacyDataResult as any[];
		
		legacyRows.forEach((row: any) => {
			const p = accessibleProducts.find(
				(prod) => prod.id === String(row.ItemID),
			);
			if (p) {
				reportData.push({
					"MR Name": mrName,
					"Division": p.division || p.manufacturer,
					"Customer": row.Customer || "Unknown Party",
					"Inv No": row.InvNo,
					"Date": row.InvDt ? new Date(row.InvDt).toLocaleDateString() : "-",
					"Code": p.code || "-",
					"Product Name": p.name,
					"Packing": "10 Tablets",
					"Batch No": row.BatchNo,
					"MRP": Number(row.MRP).toFixed(2),
					"Exp Dt": row.ExpDt,
					"Qty": Number(row.Qty),
					"Free Qty": Number(row.FQty),
					"Rate": Number(row.Rate).toFixed(2),
					"Taxable": Number(row.TaxableAmt).toFixed(2),
					"Amount": (Number(row.TaxableAmt) + Number(row.GSTAmt)).toFixed(2),
				});
			}
		});
	} else if (tab === "free-schemes") {
		// Free Schemes Legacy Fetch
		let dateCondition = ``;
		if (from) {
			dateCondition += ` AND h.inv_dt >= '${from}'`;
		}
		if (to) {
			dateCondition += ` AND h.inv_dt <= '${to}'`;
		}

		// Pre-fetch stock to get PTR like in the web view
		const stockMap = new Map<string, { mrp: number; ptr: number }>();
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

		const legacyDataResult = await db.execute(sql.raw(`
			SELECT 
				h.inv_no as "InvNo",
				h.inv_dt as "InvDt",
				CONCAT(h.cust_id, ' ', COALESCE(c.name, 'Unknown Party'), ' , ', COALESCE(c.city, '')) as "Customer",
				l.item_id as "ItemID",
				l.batch_no as "BatchNo",
				l.mrp as "MRP",
				l.exp_dt as "ExpDt",
				l.qty as "Qty",
				l.f_qty as "FQty",
				l.rate as "Rate",
				l.taxable_amt as "TaxableAmt",
				l.vat_amt as "GSTAmt",
				l.line_amt as "Amount"
			FROM "pg-drizzle_legacy_h_sale" h
			JOIN "pg-drizzle_legacy_l_sale" l ON l.rid = h.id
			LEFT JOIN "pg-drizzle_legacy_customers" c ON c.id = h.cust_id
			WHERE l.item_id IN (${productIds.map(id => `'${id}'`).join(",")})
			${dateCondition}
		`));

		const legacyRows = legacyDataResult as any[];
		
		legacyRows.forEach((row: any) => {
			const p = accessibleProducts.find(
				(prod) => prod.id === String(row.ItemID),
			);
			if (p) {
				const pStock = stockMap.get(p.id) || { mrp: 0, ptr: 0 };
				const qty = Number(row.Qty) || 0;
				const fQty = Number(row.FQty) || 0;
				const netRate = Number(row.Rate) || 0;
				const invRate = pStock.ptr;
				const schemeQty = 0;
				const claimQty = fQty;
				const claimValue = invRate * claimQty;

				reportData.push({
					"MR Name": mrName,
					"Division": p.division || p.manufacturer,
					"SchemeType": "Qty",
					"Customer": row.Customer || "Unknown Party",
					"Code": p.code || "-",
					"Product Name": p.name,
					"Packing": "10 Tablets",
					"Batch No.": row.BatchNo || "-",
					"Inv. No.": row.InvNo || "-",
					"Inv. Dt.": row.InvDt ? new Date(row.InvDt).toLocaleDateString() : "-",
					"MRP": Number(row.MRP || pStock.mrp).toFixed(2),
					"PRate": invRate.toFixed(2),
					"PTR": invRate.toFixed(2),
					"Net Rate": netRate.toFixed(2),
					"Inv. Rate": netRate.toFixed(2),
					"Sale Qty": qty,
					"Free Qty": fQty,
					"Actual FQty": fQty,
					"Claim Qty": claimQty,
					"Rate Diff.": (invRate - netRate).toFixed(2),
					"Claim Value": claimValue.toFixed(2),
					"Item Scheme": p.freeScheme || "-",
					"Applied Scheme": "-",
				});
			}
		});
	} else if (tab === "products") {
		const inventoryMap = new Map<string, number>();
		if (mrInfo.canViewStock || isAdmin) {
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

			inventory.forEach((inv) => {
				inventoryMap.set(inv.productId, inv.stock || 0);
			});
		}

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

		const accessibleSales =
			mrInfo.canViewSales || isAdmin
				? await db
						.select({
							productId: sales.productId,
							quantity: sales.quantity,
							amount: sales.amount,
						})
						.from(sales)
						.where(salesCondition)
				: [];

		const salesMap = new Map<string, { qty: number; amount: number }>();
		accessibleSales.forEach((s) => {
			const curr = salesMap.get(s.productId) || { qty: 0, amount: 0 };
			curr.qty += s.quantity || 0;
			curr.amount += s.amount ? parseFloat(s.amount.toString()) : 0;
			salesMap.set(s.productId, curr);
		});

		accessibleProducts.forEach((p) => {
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
		let excelData = reportData;
		if (tab === "free-schemes") {
			excelData = reportData.map((row) => ({
				"Code": row["Code"],
				"Product Name": row["Product Name"],
				"Packing": row["Packing"],
				"Batch No.": row["Batch No."],
				"Inv. No.": row["Inv. No."],
				"Inv. Dt.": row["Inv. Dt."],
				"MRP": row["MRP"],
				"PRate": row["PRate"],
				"PTR": row["PTR"],
				"Net Rate": row["Net Rate"],
				"Inv. Rate": row["Inv. Rate"],
				"Sale Qty": row["Sale Qty"],
				"Free Qty": row["Free Qty"],
				"Actual FQty": row["Actual FQty"],
				"Scheme Qty": row["Scheme Qty"],
				"Rate Diff.": row["Rate Diff."],
				"Scheme Value": row["Scheme Value"],
				"Item Scheme": row["Item Scheme"],
				"Applied Scheme": row["Applied Scheme"],
			}));
		}

		const headerInfo = [[`MR: ${mrName} | Division/Company: ${company === "All" ? "All Divisions" : company} | Period: ${from || 'Start'} to ${to || 'End'}`]];
		
		const keys = excelData.length > 0 ? Object.keys(excelData[0]) : [];
		const aoa = [keys, ...excelData.map((row) => keys.map((k) => (row as any)[k]))];
		const fullAoa = [...headerInfo, [], ...aoa];
		
		const worksheet = xlsx.utils.aoa_to_sheet(fullAoa);
		
		if(!worksheet['!merges']) worksheet['!merges'] = [];
		worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }); 

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
