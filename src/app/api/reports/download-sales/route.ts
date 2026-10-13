import { headers } from "next/headers";
import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { getClaimData } from "@/server/actions/claimData";
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
	const format = searchParams.get("format") || "csv"; // csv, excel, json
	const tab = searchParams.get("tab") || "sales"; // sales, products, party, free-schemes

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

	const canView =
		tab === "sales" || tab === "new-sales"
			? isAdmin || mrInfo.canViewSales
			: tab === "party"
				? isAdmin || mrInfo.canViewPartyWise
				: tab === "products"
					? isAdmin || mrInfo.canViewProductWise
					: tab === "free-schemes"
						? isAdmin || mrInfo.canViewFreeScheme
						: isAdmin || mrInfo.canViewSales;

	if (!canView) {
		return new NextResponse("Forbidden - View disabled", { status: 403 });
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
	const mrName = mrInfo.name || "Unknown";
	const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");
	const safeCompany = (company || "All").replace(/[^a-zA-Z0-9]/g, "_");
	const dateRangeTag = `${defaultFrom}_to_${defaultTo}`;

	// Handle Free Schemes (Claim Qty)
	if (tab === "free-schemes") {
		const claimResult = await getClaimData({
			uniqueCode: `claim-${mrId}-${Date.now()}`,
			fromDate: defaultFrom,
			toDate: defaultTo,
			compCode: compCodeToQuery,
			locNo: mrInfo.locNo || "11",
		});

		const rawRows =
			claimResult.success && claimResult.data ? claimResult.data : [];

		// Filter claim rows so only registered MR companies are exported
		const mrCompany = (mrInfo.company || "").toLowerCase().trim();
		const mrCode = (mrInfo.companyCode || "").toLowerCase().trim();
		const mrDiv = (mrInfo.division || "").toLowerCase().trim();

		const claimRows = rawRows.filter((r) => {
			const rowComp = (r.Company || "").toLowerCase().trim();
			const rowDiv = (r.Division || "").toLowerCase().trim();
			const rowCode = (r.Code || "").toLowerCase().trim();

			if (company !== "All") {
				const sel = company.toLowerCase().trim();
				return (
					rowComp.includes(sel) ||
					sel.includes(rowComp) ||
					rowDiv.includes(sel) ||
					sel.includes(rowDiv) ||
					rowCode === sel
				);
			}

			if (!mrCompany && !mrCode && !mrDiv) return true;
			return (
				(mrCompany &&
					(rowComp.includes(mrCompany) || mrCompany.includes(rowComp))) ||
				(mrCode && (rowCode === mrCode || rowComp.includes(mrCode))) ||
				(mrDiv && (rowDiv.includes(mrDiv) || mrDiv.includes(rowDiv)))
			);
		});

		const filename = `${safeMrName}_${safeCompany}_Claim_Report_${dateRangeTag}`;

		if (format === "json") {
			const jsonClaimData = claimRows.map((row) => {
				const ptr = Number(row.PTR || 0);
				const sRate = Number(row.SRate || 0);
				const pRate = Number(row.PRate || 0);
				const mrp = Number(row.MRP || 0);
				const qty = Number(row.Qty || 0);
				const free = Number(row.Free || row.FQty || 0);
				const fQty = Number(row.FQty || 0);
				const schemeStr = (row.Scheme || "").toString().trim();

				let netRate = ptr;
				if (schemeStr && schemeStr.includes("+")) {
					const parts = schemeStr.split("+");
					const a = parseFloat(parts[0] || "");
					const b = parseFloat(parts[1] || "");
					if (!isNaN(a) && !isNaN(b) && a > 0 && a + b > 0) {
						netRate = Number(((ptr * a) / (a + b)).toFixed(2));
					}
				} else if (schemeStr && schemeStr.endsWith("%")) {
					const disc = parseFloat(schemeStr);
					if (!isNaN(disc) && disc > 0) {
						netRate = Number((ptr * (1 - disc / 100)).toFixed(2));
					}
				}

				const isQtyClaim = free > 0;
				let claimVal = 0;
				if (isQtyClaim) {
					claimVal = Number((ptr * free).toFixed(2));
				} else {
					const diff = netRate - sRate;
					claimVal = diff > 0 ? Number((diff * qty).toFixed(2)) : 0;
				}

				const rawDiff = Number((netRate - sRate).toFixed(2));
				const rateDiff = rawDiff > 0 ? rawDiff : "-";

				return {
					Manufacturer:
						row.Company ||
						row.Division ||
						mrInfo.division ||
						mrInfo.company ||
						(company !== "All" ? company : "All"),
					Division:
						row.Division ||
						row.Company ||
						mrInfo.division ||
						mrInfo.company ||
						"General",
					SchemeType: isQtyClaim ? "Qty" : "Rate",
					Party: `${row.CustCode ? `[${row.CustCode}] ` : ""}${row.Customer || "Unknown Party"}${row.City ? ` , ${row.City}` : ""}`,
					Customer: row.Customer || "Unknown Party",
					Code: row.ItemCode || "-",
					"Product Name": row.ItemName || "Unknown Item",
					ItemName: row.ItemName || "Unknown Item",
					Packing: row.Packing || "-",
					"Batch No.": row.BatchNo || "-",
					"Inv. No.": row.InvNo || "-",
					"Inv. Dt.": row.InvDt
						? new Date(row.InvDt)
								.toLocaleDateString("en-GB")
								.replace(/\//g, "-")
						: "-",
					MRP: mrp,
					PRate: pRate,
					PTR: ptr,
					"Net Rate": netRate,
					"Inv. Rate": sRate,
					"Sale Qty": qty,
					"Free Qty": free,
					"Actual FQty": fQty,
					"Claim Qty": free,
					"Scheme Qty": free,
					"Rate Diff.": rateDiff,
					"Claim Value": claimVal,
					"Scheme Value": claimVal,
					"Item Scheme": schemeStr || "-",
					"Applied Scheme": schemeStr || "-",
					"MR Name": mrName,
				};
			});
			return NextResponse.json(jsonClaimData);
		}

		// Tabular data for CSV/Excel
		let totalSaleQty = 0;
		let totalFreeQty = 0;
		let totalClaimQty = 0;
		let totalClaimVal = 0;

		const tabularData = claimRows.map((r) => {
			const ptr = Number(r.PTR || 0);
			const sRate = Number(r.SRate || 0);
			const pRate = Number(r.PRate || 0);
			const mrp = Number(r.MRP || 0);
			const qty = Number(r.Qty || 0);
			const free = Number(r.Free || r.FQty || 0);
			const schemeStr = (r.Scheme || "").toString().trim();

			let netRate = ptr;
			if (schemeStr && schemeStr.includes("+")) {
				const parts = schemeStr.split("+");
				const a = parseFloat(parts[0] || "");
				const b = parseFloat(parts[1] || "");
				if (!isNaN(a) && !isNaN(b) && a > 0 && a + b > 0) {
					netRate = Number(((ptr * a) / (a + b)).toFixed(2));
				}
			} else if (schemeStr && schemeStr.endsWith("%")) {
				const disc = parseFloat(schemeStr);
				if (!isNaN(disc) && disc > 0) {
					netRate = Number((ptr * (1 - disc / 100)).toFixed(2));
				}
			}

			const isQtyClaim = free !== 0;
			const claimQty = isQtyClaim ? free : 0;
			let claimVal = 0;
			if (isQtyClaim) {
				claimVal = Number((ptr * free).toFixed(2));
			} else {
				const diff = netRate - sRate;
				claimVal = diff > 0 ? Number((diff * qty).toFixed(2)) : 0;
			}

			const rawDiff = Number((netRate - sRate).toFixed(2));
			const rateDiff = rawDiff > 0 ? rawDiff : "-";

			totalSaleQty += qty;
			totalFreeQty += free;
			totalClaimQty += claimQty;
			totalClaimVal += claimVal;

			return {
				"Inv No": r.InvNo,
				"Inv Date": r.InvDt
					? new Date(r.InvDt).toISOString().split("T")[0]
					: "-",
				Customer: r.Customer || "Unknown Party",
				"Item Name": r.ItemName,
				Packing: r.Packing || "-",
				"Batch No": r.BatchNo || "-",
				"Sale Qty": qty,
				"Free Qty": free,
				"Actual FQty": r.FQty ?? free,
				Scheme: schemeStr || "-",
				"Claim Qty": claimQty,
				MRP: Number(mrp.toFixed(2)),
				PRate: Number(pRate.toFixed(2)),
				PTR: Number(ptr.toFixed(2)),
				"Net Rate": Number(netRate.toFixed(2)),
				"Inv Rate": Number(sRate.toFixed(2)),
				"Rate Diff": rateDiff,
				"Claim Value": Number(claimVal.toFixed(2)),
			};
		});

		if (tabularData.length > 0) {
			tabularData.push({
				"Inv No": "" as any,
				"Inv Date": "",
				Customer: "TOTAL :",
				"Item Name": "",
				Packing: "",
				"Batch No": "",
				"Sale Qty": totalSaleQty,
				"Free Qty": totalFreeQty,
				"Actual FQty": "-" as any,
				Scheme: "",
				"Claim Qty": totalClaimQty,
				MRP: "" as any,
				PRate: "" as any,
				PTR: "" as any,
				"Net Rate": "" as any,
				"Inv Rate": "" as any,
				"Rate Diff": "",
				"Claim Value": Number(totalClaimVal.toFixed(2)),
			});
		}

		if (format === "excel") {
			const worksheet = xlsx.utils.json_to_sheet(tabularData);
			const workbook = xlsx.utils.book_new();
			xlsx.utils.book_append_sheet(workbook, worksheet, "Claim Report");
			const arrayBuf = xlsx.write(workbook, {
				type: "array",
				bookType: "xlsx",
			});

			return new NextResponse(new Uint8Array(arrayBuf), {
				headers: {
					"Content-Disposition": `attachment; filename="${filename}.xlsx"`,
					"Content-Type":
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				},
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

	// Normal Sales or Products Query
	const salesResult = await getItemCustomerSale({
		fromDate: defaultFrom,
		toDate: defaultTo,
		locNo: mrInfo.locNo || "11",
		compCode: compCodeToQuery,
	});

	const rows = salesResult.success && salesResult.data ? salesResult.data : [];
	const reportTypeTitle =
		tab === "products" ? "Product_Report" : "Sales_Report";
	const filename = `${safeMrName}_${safeCompany}_${reportTypeTitle}_${dateRangeTag}`;

	if (format === "json") {
		if (tab === "products") {
			// Aggregated by product for Product Wise Statement PDF
			const productMap = new Map<string, any>();
			rows.forEach((r) => {
				const key = r.ItemName || r.ItemCode || "Unknown";
				if (!productMap.has(key)) {
					productMap.set(key, {
						Manufacturer:
							mrInfo.company || mrInfo.division || company || "General",
						Division: mrInfo.division || mrInfo.company || company || "General",
						"Product Name": key,
						ItemName: key,
						Packing: r.Packing || "-",
						"Free Scheme": Number(r.FQty || 0) > 0 ? "Yes" : "No",
						"Current Stock": "-",
						"Total Sales Qty": 0,
						"Total Sales Amt": 0,
						"MR Name": mrName,
					});
				}
				const existing = productMap.get(key);
				existing["Total Sales Qty"] += Number(r.Qty || 0);
				existing["Total Sales Amt"] += Number(r.IAmt || 0);
			});

			return NextResponse.json(Array.from(productMap.values()));
		}

		// Full Sales Rows for Sales Statement PDF
		const jsonSalesData = rows.map((r) => ({
			"MR Name": mrName,
			Division: mrInfo.division || mrInfo.company || company || "General",
			Manufacturer: mrInfo.company || mrInfo.division || company || "General",
			Customer: r.Customer || "Unknown Party",
			InvNo: r.InvNo,
			"Inv No": r.InvNo,
			InvDate: r.InvDt ? new Date(r.InvDt).toISOString().split("T")[0] : "-",
			"Inv Date": r.InvDt ? new Date(r.InvDt).toISOString().split("T")[0] : "-",
			Code: r.ItemCode || "-",
			"Item Code": r.ItemCode || "-",
			ItemName: r.ItemName,
			"Item Name": r.ItemName,
			"Product Name": r.ItemName,
			Packing: r.Packing || "-",
			BatchNo: r.BatchNo || "-",
			"Batch No": r.BatchNo || "-",
			MRP: Number(r.PTR || 0),
			ExpDt: r.ExpDt ? new Date(r.ExpDt).toISOString().split("T")[0] : "-",
			Qty: Number(r.Qty || 0),
			FQty: Number(r.FQty || 0),
			"Free Qty": Number(r.FQty || 0),
			Rate: Number(r.Srate || r.PTR || 0),
			TaxableAmt: Number(r.IAmt || 0),
			GSTAmt: 0,
			Amount: Number(r.IAmt || 0),
		}));

		return NextResponse.json(jsonSalesData);
	}

	// Tabular data for CSV/Excel
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
			"Batch No": r.BatchNo || "-",
			Qty: qty,
			"Free Qty": fQty,
			Rate: Number(rate.toFixed(2)),
			Amount: Number(amt.toFixed(2)),
			Division: mrInfo.division || mrInfo.company || "-",
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
			Division: "",
		});
	}

	if (format === "excel") {
		const worksheet = xlsx.utils.json_to_sheet(tabularData);
		const workbook = xlsx.utils.book_new();
		xlsx.utils.book_append_sheet(
			workbook,
			worksheet,
			tab === "products" ? "Products" : "Sales",
		);
		const arrayBuf = xlsx.write(workbook, { type: "array", bookType: "xlsx" });

		return new NextResponse(new Uint8Array(arrayBuf), {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.xlsx"`,
				"Content-Type":
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			},
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
		...tabularData.map((row) =>
			headersKeys
				.map((key) => {
					const val = (row as any)[key];
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
