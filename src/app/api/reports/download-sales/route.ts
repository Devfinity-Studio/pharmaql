import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit-logger";
import { getDefaultTMinus1MonthRange } from "@/lib/dateUtils";
import { buildStyledExcelBuffer, type ExcelColumnDef } from "@/lib/excel";
import { rateLimitReportDownload } from "@/lib/rate-limit";
import { getClientIp, getClientUserAgent } from "@/lib/security";
import { getClaimData } from "@/server/actions/claimData";
import { getItemCustomerSale } from "@/server/actions/customerItemSale";
import { getItemDivisionMap } from "@/server/actions/itemCatalog";
import { getMRInfo } from "@/server/actions/mrInfo";
import { getPartyCustomerItemSale } from "@/server/actions/partyItemSale";
import { getStockAndSales } from "@/server/actions/stockAndSales";
import { auth } from "@/server/auth";

export async function GET(request: Request) {
	const reqHeaders = await headers();
	const session = await auth.api.getSession({
		headers: reqHeaders,
	});

	if (!session || !session.user) {
		return new NextResponse("Unauthorized", { status: 401 });
	}

	const clientIp = getClientIp(reqHeaders);
	const userAgent = getClientUserAgent(reqHeaders);

	// Rate Limiting: Max 30 exports per 5 minutes per user/IP
	const rateCheck = rateLimitReportDownload(clientIp, session.user.id);
	if (!rateCheck.allowed) {
		await recordAuditEvent({
			event: "RATE_LIMIT_EXCEEDED",
			userId: session.user.id,
			userEmail: session.user.email,
			role: session.user.role,
			ip: clientIp,
			userAgent,
			details: {
				endpoint: "/api/reports/download-sales",
				reason: rateCheck.message,
			},
		});

		return new NextResponse(rateCheck.message, {
			status: 429,
			headers: { "Retry-After": String(rateCheck.resetInSeconds) },
		});
	}

	const { searchParams } = new URL(request.url);
	const mrId = searchParams.get("mrId");
	const company = searchParams.get("company") || "All";
	const from = searchParams.get("from");
	const to = searchParams.get("to");
	const format = searchParams.get("format") || "csv"; // csv, excel, json
	const tab = searchParams.get("tab") || "sales"; // sales, new-sales, products, party, free-schemes

	if (!mrId) {
		return new NextResponse("Missing mrId", { status: 400 });
	}

	const requestingUserId = session.user.id;
	const isSelf = String(requestingUserId) === String(mrId);
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
						: tab === "stock-and-sales"
							? isAdmin || mrInfo.canViewStockAndSales || mrInfo.canViewStock
							: isAdmin || mrInfo.canViewSales;

	if (!canView) {
		return new NextResponse("Forbidden - View disabled", { status: 403 });
	}

	const compCodeToQuery = (() => {
		if (company === "All") {
			const allCodes = Array.from(
				new Set(
					(mrInfo.assignments || []).map((a) => a.companyCode).filter(Boolean),
				),
			);
			return allCodes.length > 0
				? allCodes.join(",")
				: mrInfo.companyCode || "";
		}
		const matchingAssignment = (mrInfo.assignments || []).find(
			(a) =>
				a.division === company ||
				a.manufacturer === company ||
				a.company === company,
		);
		if (matchingAssignment?.companyCode) return matchingAssignment.companyCode;
		return mrInfo.companyCode || company;
	})();

	const defaultT1 = getDefaultTMinus1MonthRange();
	const defaultFrom = from || defaultT1.from;
	const defaultTo = to || defaultT1.to;
	const mrName = mrInfo.name || "Unknown";
	const safeMrName = mrName.replace(/[^a-zA-Z0-9]/g, "_");
	const safeCompany = (company || "All").replace(/[^a-zA-Z0-9]/g, "_");
	const dateRangeTag = `${defaultFrom}_to_${defaultTo}`;

	// ==========================================
	// 1. Handle Party Wise Sales
	// ==========================================
	if (tab === "party") {
		const partyResult = await getPartyCustomerItemSale({
			fromDate: defaultFrom,
			toDate: defaultTo,
			compCode: compCodeToQuery,
			locNo: mrInfo.locNo || "11",
		});

		let partyRows =
			partyResult.success && partyResult.data ? partyResult.data : [];

		if (company !== "All") {
			const sel = company.trim().toUpperCase();
			partyRows = partyRows.filter((r) => {
				const rowDiv = (r.Division || "").toString().trim().toUpperCase();
				if (rowDiv) {
					return rowDiv === sel || rowDiv.includes(sel) || sel.includes(rowDiv);
				}
				const rowComp = (r.MktBy || "").toString().trim().toUpperCase();
				return (
					rowComp === sel || rowComp.includes(sel) || sel.includes(rowComp)
				);
			});
		}

		const filename = `${safeMrName}_${safeCompany}_Party_Report_${dateRangeTag}`;

		if (format === "json") {
			const jsonPartyData = partyRows.map((r) => ({
				"MR Name": mrName,
				Division:
					(r.Division ? r.Division.toString().trim() : null) ||
					(company !== "All"
						? company
						: mrInfo.division || mrInfo.company || "General"),
				Manufacturer: mrInfo.company || mrInfo.division || company || "General",
				CustID: r.CustID,
				CustCode: r.CustCode || "",
				Customer: r.Customer || "Unknown Party",
				Address: r.Address || "",
				Area: r.Area || "",
				City: r.City || "",
				InvNo: r.InvNo,
				"Inv No": r.InvNo,
				InvDt: r.InvDt ? new Date(r.InvDt).toISOString().split("T")[0] : "-",
				"Inv Date": r.InvDt
					? new Date(r.InvDt).toISOString().split("T")[0]
					: "-",
				ItemCode: r.ItemCode || "-",
				"Item Code": r.ItemCode || "-",
				ItemName: r.ItemName || "-",
				"Item Name": r.ItemName || "-",
				Packing: r.Packing || "-",
				BatchNo: r.BatchNo || "-",
				"Batch No": r.BatchNo || "-",
				ExpDt: r.ExpDt ? new Date(r.ExpDt).toISOString().split("T")[0] : "-",
				Qty: Number(r.Qty || 0),
				FQty: Number(r.FQty || 0),
				"Free Qty": Number(r.FQty || 0),
				Rate: Number(r.Srate || 0),
				Amount: Number(r.Amt || 0),
				Series: r.Series || "",
				Remarks: r.Remarks || "",
			}));
			return NextResponse.json(jsonPartyData);
		}

		let totalQty = 0;
		let totalFree = 0;
		let totalAmt = 0;

		const excelRows = partyRows.map((r, idx) => {
			const qty = Number(r.Qty || 0);
			const free = Number(r.FQty || 0);
			const amt = Number(r.Amt || 0);
			const rate = Number(r.Srate || 0);

			totalQty += qty;
			totalFree += free;
			totalAmt += amt;

			return {
				sno: idx + 1,
				customer: `${r.Customer}${r.CustCode ? ` [${r.CustCode}]` : ""}`,
				city: r.City || "",
				invNo: r.InvNo,
				invDt: r.InvDt ? new Date(r.InvDt).toLocaleDateString("en-GB") : "-",
				itemCode: r.ItemCode || "-",
				itemName: r.ItemName,
				packing: r.Packing || "-",
				batchNo: r.BatchNo || "-",
				expDt: r.ExpDt ? new Date(r.ExpDt).toLocaleDateString("en-GB") : "-",
				qty,
				free,
				rate,
				amt,
				series: r.Series || "",
				remarks: r.Remarks || "",
			};
		});

		if (format === "excel") {
			const columns: ExcelColumnDef[] = [
				{
					header: "SNo.",
					key: "sno",
					width: 8,
					alignment: { horizontal: "center" },
				},
				{ header: "Party / Customer", key: "customer", width: 28 },
				{ header: "City", key: "city", width: 14 },
				{ header: "Inv No", key: "invNo", width: 12 },
				{ header: "Inv Date", key: "invDt", width: 12 },
				{ header: "Item Code", key: "itemCode", width: 12 },
				{ header: "Item Name", key: "itemName", width: 26 },
				{ header: "Packing", key: "packing", width: 10 },
				{ header: "Batch No", key: "batchNo", width: 12 },
				{ header: "Exp Date", key: "expDt", width: 12 },
				{
					header: "Qty",
					key: "qty",
					width: 10,
					numFmt: "#,##0",
					alignment: { horizontal: "right" },
				},
				{
					header: "Free",
					key: "free",
					width: 10,
					numFmt: "#,##0",
					alignment: { horizontal: "right" },
				},
				{
					header: "Rate (₹)",
					key: "rate",
					width: 12,
					numFmt: "#,##0.00",
					alignment: { horizontal: "right" },
				},
				{
					header: "Amount (₹)",
					key: "amt",
					width: 14,
					numFmt: "#,##0.00",
					alignment: { horizontal: "right" },
				},
				{ header: "Series", key: "series", width: 10 },
				{ header: "Remarks", key: "remarks", width: 16 },
			];

			const buffer = await buildStyledExcelBuffer({
				sheetName: "Partywise Sales",
				title: "Partywise / Itemwise Sales Statement",
				metadata: {
					mrName,
					company:
						mrInfo.company || (company !== "All" ? company : "All Companies"),
					division:
						company !== "All"
							? company
							: mrInfo.division || mrInfo.company || "All Divisions",
					period: `${defaultFrom} to ${defaultTo}`,
					year: "2026-27",
				},
				columns,
				data: excelRows,
				totals: {
					sno: "",
					customer: "GRAND TOTAL :",
					qty: totalQty,
					free: totalFree,
					amt: Number(totalAmt.toFixed(2)),
				},
			});

			return new NextResponse(new Uint8Array(buffer), {
				headers: {
					"Content-Disposition": `attachment; filename="${filename}.xlsx"`,
					"Content-Type":
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				},
			});
		}

		// CSV for party
		if (excelRows.length === 0) {
			return new NextResponse("No data available", { status: 200 });
		}
		const csvHeaders = [
			"SNo",
			"Customer",
			"City",
			"Inv No",
			"Inv Date",
			"Item Code",
			"Item Name",
			"Packing",
			"Batch No",
			"Exp Date",
			"Qty",
			"Free",
			"Rate",
			"Amount",
			"Series",
			"Remarks",
		];
		const csvRows = excelRows.map((r) =>
			[
				r.sno,
				`"${r.customer.replace(/"/g, '""')}"`,
				`"${r.city.replace(/"/g, '""')}"`,
				r.invNo,
				r.invDt,
				r.itemCode,
				`"${r.itemName.replace(/"/g, '""')}"`,
				r.packing,
				r.batchNo,
				r.expDt,
				r.qty,
				r.free,
				r.rate.toFixed(2),
				r.amt.toFixed(2),
				r.series,
				`"${r.remarks.replace(/"/g, '""')}"`,
			].join(","),
		);
		csvRows.push(
			`,"GRAND TOTAL :",,,,,,,,,${totalQty},${totalFree},,${totalAmt.toFixed(2)},,`,
		);

		return new NextResponse([csvHeaders.join(","), ...csvRows].join("\n"), {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.csv"`,
				"Content-Type": "text/csv; charset=utf-8",
			},
		});
	}

	// ==========================================
	// 1.5. Handle Stock & Sales Statement Report
	// ==========================================
	if (tab === "stock-and-sales") {
		const matchingAssignment = (mrInfo.assignments || []).find(
			(a: any) =>
				a.division === company ||
				a.manufacturer === company ||
				a.company === company,
		);
		const divIdNum = (matchingAssignment as any)?.divisionId
			? Number((matchingAssignment as any).divisionId)
			: undefined;
		const validDivId =
			divIdNum && !isNaN(divIdNum) && divIdNum > 0 ? divIdNum : undefined;

		const stockAndSalesRes = await getStockAndSales({
			fromDate: defaultFrom,
			toDate: defaultTo,
			compCode: compCodeToQuery,
			locNo: mrInfo.locNo || "11",
			divId: validDivId,
		});

		const rawRows =
			stockAndSalesRes.success && stockAndSalesRes.data
				? stockAndSalesRes.data
				: [];

		// Filter rows to match selected division/company cleanly
		const filteredRows = rawRows.filter((row: any) => {
			const rowMktBy = (
				row.MktBy ||
				row.CompanyCode ||
				row.CompanyName ||
				row.Make ||
				""
			)
				.toString()
				.trim()
				.toUpperCase();
			const rowDiv = (row.Division || "").toString().trim().toUpperCase();

			if (company !== "All") {
				const sel = company.trim().toUpperCase();
				if (rowDiv && (rowDiv === sel || rowDiv.includes(sel) || sel.includes(rowDiv))) {
					return true;
				}
				if (rowMktBy && (rowMktBy === sel || rowMktBy.includes(sel) || sel.includes(rowMktBy))) {
					return true;
				}
				return (mrInfo.assignments || []).some((a: any) => {
					const cCode = (a.companyCode || "").toString().trim().toUpperCase();
					const mfg = (a.manufacturer || a.company || "").toString().trim().toUpperCase();
					const div = (a.division || "").toString().trim().toUpperCase();
					return (
						(cCode && rowMktBy === cCode) ||
						(mfg && rowMktBy === mfg) ||
						(div && rowDiv === div)
					);
				});
			}
			return true;
		});

		const filename = `${safeMrName}_${safeCompany}_Stock_and_Sales_${dateRangeTag}`;

		let totalOpening = 0;
		let totalPur = 0;
		let totalSale = 0;
		let totalFree = 0;
		let totalSRet = 0;
		let totalClosing = 0;
		let totalSaleVal = 0;
		let totalClosingVal = 0;

		const excelRows = filteredRows.map((r: any) => {
			const opQty = Number(r.OpenQty ?? r.OpQty ?? r.OpeningQty ?? r.Opening ?? 0);
			const purQty = Number(
				r.PQty ?? r.PurQty ?? r.PurchaseQty ?? r.Purchase ?? r.RecQty ?? 0,
			);
			const saleQty = Number(r.SQty ?? r.SaleQty ?? r.SalesQty ?? r.Sales ?? 0);
			const freeQty = Number(r.SFQty ?? r.FreeQty ?? r.Free ?? r.FQty ?? 0);
			const sRetQty = Number(r.SRetQty ?? r.SReturn ?? r.SalesReturn ?? 0);
			const closingQty = Number(
				r.CurrStck ??
					r.BalQty ??
					r.ClosingQty ??
					r.Balance ??
					r.Closing ??
					opQty + purQty + sRetQty - saleQty,
			);
			const ptr = Number(r.PTR ?? r.Ptr ?? 0);
			const rate = Number(r.Rate ?? r.PRate ?? r.Srate ?? ptr);
			const saleVal = Number(
				r.SaleVal ?? r.SalesValue ?? saleQty * (ptr || rate),
			);
			const closingVal = Number(
				r.BalVal ?? r.ClosingValue ?? closingQty * (rate || ptr),
			);

			totalOpening += opQty;
			totalPur += purQty;
			totalSale += saleQty;
			totalFree += freeQty;
			totalSRet += sRetQty;
			totalClosing += closingQty;
			totalSaleVal += saleVal;
			totalClosingVal += closingVal;

			return {
				itemCode: (r.ItemCode || "").toString().trim() || "-",
				itemName: (
					r.ItemName ||
					r.Iname ||
					r.ProductName ||
					"Unknown Item"
				).toString().trim(),
				packing: (r.Pack || r.Packing || "-").toString().trim(),
				division: (
					r.Division ||
					r.MktBy ||
					(company !== "All" ? company : "General")
				).toString().trim(),
				batchNo: (r.BatchNo || r.Batch || "-").toString().trim(),
				openingQty: opQty,
				purQty,
				saleQty,
				freeQty,
				sRetQty,
				closingQty,
				ptr,
				rate,
				saleVal,
				closingVal,
			};
		});

		// JSON format for PDF generation & print previews
		if (format === "json") {
			const jsonReportData = excelRows.map((r: any) => ({
				"MR Name": mrName,
				ItemId: r.itemCode,
				"Item Code": r.itemCode,
				"Item Name": r.itemName,
				"Product Name": r.itemName,
				Packing: r.packing,
				Division: r.division,
				Manufacturer: mrInfo.company || r.division || "General",
				"Opening Qty.": r.openingQty,
				"Purchase Qty": r.purQty,
				"Sales Qty.": r.saleQty,
				"Free Qty": r.freeQty,
				"S.Ret Qty.": r.sRetQty,
				"Balance Qty.": r.closingQty,
				"Closing Qty": r.closingQty,
				ptr: r.ptr,
				prate: r.rate ?? r.ptr,
				"Sales Value": r.saleVal,
				"Stock Value": r.closingVal,
				"Closing Value": r.closingVal,
			}));

			return NextResponse.json(jsonReportData);
		}

		if (format === "excel") {
			const columns: ExcelColumnDef[] = [
				{ header: "Item Code", key: "itemCode", width: 14 },
				{ header: "Product Name", key: "itemName", width: 30 },
				{ header: "Packing", key: "packing", width: 12 },
				{ header: "Division", key: "division", width: 16 },
				{ header: "Batch No", key: "batchNo", width: 14 },
				{
					header: "Opening Qty",
					key: "openingQty",
					width: 12,
					numFmt: "#,##0",
					alignment: { horizontal: "right" },
				},
				{
					header: "Inward / Pur",
					key: "purQty",
					width: 12,
					numFmt: "#,##0",
					alignment: { horizontal: "right" },
				},
				{
					header: "Sales Qty",
					key: "saleQty",
					width: 12,
					numFmt: "#,##0",
					alignment: { horizontal: "right" },
				},
				{
					header: "Free Qty",
					key: "freeQty",
					width: 10,
					numFmt: "#,##0",
					alignment: { horizontal: "right" },
				},
				{
					header: "S.Ret Qty",
					key: "sRetQty",
					width: 10,
					numFmt: "#,##0",
					alignment: { horizontal: "right" },
				},
				{
					header: "Closing Qty",
					key: "closingQty",
					width: 12,
					numFmt: "#,##0",
					alignment: { horizontal: "right" },
				},
				{
					header: "PTR (₹)",
					key: "ptr",
					width: 12,
					numFmt: "#,##0.00",
					alignment: { horizontal: "right" },
				},
				{
					header: "Sales Val (₹)",
					key: "saleVal",
					width: 14,
					numFmt: "#,##0.00",
					alignment: { horizontal: "right" },
				},
				{
					header: "Closing Val (₹)",
					key: "closingVal",
					width: 14,
					numFmt: "#,##0.00",
					alignment: { horizontal: "right" },
				},
			];

			const buffer = await buildStyledExcelBuffer({
				sheetName: "Stock & Sales",
				title: "Stock & Sales Statement Report",
				metadata: {
					mrName,
					company:
						mrInfo.company ||
						(company !== "All" ? company : "All Companies"),
					division:
						company !== "All"
							? company
							: mrInfo.division || mrInfo.company || "All Divisions",
					period: `${defaultFrom} to ${defaultTo}`,
					year: "2026-27",
				},
				columns,
				data: excelRows,
				totals: {
					itemCode: "",
					itemName: "GRAND TOTAL :",
					packing: "",
					division: "",
					batchNo: "",
					openingQty: totalOpening,
					purQty: totalPur,
					saleQty: totalSale,
					freeQty: totalFree,
					sRetQty: totalSRet,
					closingQty: totalClosing,
					ptr: 0,
					saleVal: Number(totalSaleVal.toFixed(2)),
					closingVal: Number(totalClosingVal.toFixed(2)),
				},
			});

			return new NextResponse(new Uint8Array(buffer), {
				headers: {
					"Content-Disposition": `attachment; filename="${filename}.xlsx"`,
					"Content-Type":
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				},
			});
		}

		// CSV
		if (excelRows.length === 0) {
			return new NextResponse("No data available", { status: 200 });
		}
		const csvHeaders = [
			"Item Code",
			"Product Name",
			"Packing",
			"Division",
			"Batch No",
			"Opening Qty",
			"Inward / Pur",
			"Sales Qty",
			"Free Qty",
			"S.Ret Qty",
			"Closing Qty",
			"PTR",
			"Sales Value",
			"Closing Value",
		];
		const csvRows = excelRows.map((r) =>
			[
				`"${r.itemCode.replace(/"/g, '""')}"`,
				`"${r.itemName.replace(/"/g, '""')}"`,
				`"${r.packing.replace(/"/g, '""')}"`,
				`"${r.division.replace(/"/g, '""')}"`,
				`"${r.batchNo.replace(/"/g, '""')}"`,
				r.openingQty,
				r.purQty,
				r.saleQty,
				r.freeQty,
				r.sRetQty,
				r.closingQty,
				r.ptr.toFixed(2),
				r.saleVal.toFixed(2),
				r.closingVal.toFixed(2),
			].join(","),
		);
		csvRows.push(
			`,"GRAND TOTAL :",,,,${totalOpening},${totalPur},${totalSale},${totalFree},${totalSRet},${totalClosing},,${totalSaleVal.toFixed(2)},${totalClosingVal.toFixed(2)}`,
		);

		return new NextResponse([csvHeaders.join(","), ...csvRows].join("\n"), {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.csv"`,
				"Content-Type": "text/csv; charset=utf-8",
			},
		});
	}

	// ==========================================
	// 2. Handle Free Schemes (Claim Qty)
	// ==========================================
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
				if (rowDiv !== "") {
					return rowDiv === sel || rowDiv.includes(sel) || sel.includes(rowDiv);
				}
				return (
					(rowComp !== "" &&
						(rowComp === sel ||
							rowComp.includes(sel) ||
							sel.includes(rowComp))) ||
					(rowCode !== "" && rowCode === sel)
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
					Company:
						row.Company ||
						mrInfo.company ||
						row.Division ||
						mrInfo.division ||
						(company !== "All" ? company : "All"),
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

		const excelClaimRows = claimRows.map((r) => {
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
				invNo: r.InvNo,
				invDt: r.InvDt ? new Date(r.InvDt).toLocaleDateString("en-GB") : "-",
				customer: r.Customer || "Unknown Party",
				itemName: r.ItemName,
				packing: r.Packing || "-",
				batchNo: r.BatchNo || "-",
				saleQty: qty,
				freeQty: free,
				scheme: schemeStr || "-",
				claimQty,
				mrp,
				pRate,
				ptr,
				netRate,
				invRate: sRate,
				rateDiff: typeof rateDiff === "number" ? rateDiff : "-",
				claimValue: claimVal,
			};
		});

		if (format === "excel") {
			const columns: ExcelColumnDef[] = [
				{ header: "Inv No", key: "invNo", width: 12 },
				{ header: "Inv Date", key: "invDt", width: 12 },
				{ header: "Customer / Party", key: "customer", width: 28 },
				{ header: "Item Name", key: "itemName", width: 26 },
				{ header: "Packing", key: "packing", width: 10 },
				{ header: "Batch No", key: "batchNo", width: 12 },
				{
					header: "Sale Qty",
					key: "saleQty",
					width: 10,
					numFmt: "#,##0",
					alignment: { horizontal: "right" },
				},
				{
					header: "Free Qty",
					key: "freeQty",
					width: 10,
					numFmt: "#,##0",
					alignment: { horizontal: "right" },
				},
				{ header: "Scheme", key: "scheme", width: 12 },
				{
					header: "Claim Qty",
					key: "claimQty",
					width: 10,
					numFmt: "#,##0",
					alignment: { horizontal: "right" },
				},
				{
					header: "MRP (₹)",
					key: "mrp",
					width: 11,
					numFmt: "#,##0.00",
					alignment: { horizontal: "right" },
				},
				{
					header: "PRate (₹)",
					key: "pRate",
					width: 11,
					numFmt: "#,##0.00",
					alignment: { horizontal: "right" },
				},
				{
					header: "PTR (₹)",
					key: "ptr",
					width: 11,
					numFmt: "#,##0.00",
					alignment: { horizontal: "right" },
				},
				{
					header: "Net Rate (₹)",
					key: "netRate",
					width: 12,
					numFmt: "#,##0.00",
					alignment: { horizontal: "right" },
				},
				{
					header: "Inv Rate (₹)",
					key: "invRate",
					width: 12,
					numFmt: "#,##0.00",
					alignment: { horizontal: "right" },
				},
				{
					header: "Rate Diff (₹)",
					key: "rateDiff",
					width: 12,
					alignment: { horizontal: "right" },
				},
				{
					header: "Claim Value (₹)",
					key: "claimValue",
					width: 14,
					numFmt: "#,##0.00",
					alignment: { horizontal: "right" },
				},
			];

			const buffer = await buildStyledExcelBuffer({
				sheetName: "Claim Report",
				title: "Scheme Claim / Free Scheme Statement",
				metadata: {
					mrName,
					company:
						mrInfo.company || (company !== "All" ? company : "All Companies"),
					division:
						company !== "All"
							? company
							: mrInfo.division || mrInfo.company || "All Divisions",
					period: `${defaultFrom} to ${defaultTo}`,
					year: "2026-27",
				},
				columns,
				data: excelClaimRows,
				totals: {
					invNo: "",
					invDt: "",
					customer: "GRAND TOTAL :",
					saleQty: totalSaleQty,
					freeQty: totalFreeQty,
					claimQty: totalClaimQty,
					claimValue: Number(totalClaimVal.toFixed(2)),
				},
			});

			return new NextResponse(new Uint8Array(buffer), {
				headers: {
					"Content-Disposition": `attachment; filename="${filename}.xlsx"`,
					"Content-Type":
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				},
			});
		}

		// CSV
		if (excelClaimRows.length === 0) {
			return new NextResponse("No data available", { status: 200 });
		}
		const csvHeaders = [
			"Inv No",
			"Inv Date",
			"Customer",
			"Item Name",
			"Packing",
			"Batch No",
			"Sale Qty",
			"Free Qty",
			"Scheme",
			"Claim Qty",
			"MRP",
			"PRate",
			"PTR",
			"Net Rate",
			"Inv Rate",
			"Rate Diff",
			"Claim Value",
		];
		const csvRows = excelClaimRows.map((r) =>
			[
				r.invNo,
				r.invDt,
				`"${r.customer.replace(/"/g, '""')}"`,
				`"${r.itemName.replace(/"/g, '""')}"`,
				r.packing,
				r.batchNo,
				r.saleQty,
				r.freeQty,
				r.scheme,
				r.claimQty,
				r.mrp.toFixed(2),
				r.pRate.toFixed(2),
				r.ptr.toFixed(2),
				r.netRate.toFixed(2),
				r.invRate.toFixed(2),
				r.rateDiff,
				r.claimValue.toFixed(2),
			].join(","),
		);
		csvRows.push(
			`,,"GRAND TOTAL :",,,,${totalSaleQty},${totalFreeQty},,${totalClaimQty},,,,,,,${totalClaimVal.toFixed(2)}`,
		);

		return new NextResponse([csvHeaders.join(","), ...csvRows].join("\n"), {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.csv"`,
				"Content-Type": "text/csv; charset=utf-8",
			},
		});
	}

	// ==========================================
	// 3. Normal Sales or Product Wise Query
	// ==========================================
	const salesResult = await getItemCustomerSale({
		fromDate: defaultFrom,
		toDate: defaultTo,
		locNo: mrInfo.locNo || "11",
		compCode: compCodeToQuery,
	});

	let rows = salesResult.success && salesResult.data ? salesResult.data : [];

	if (company !== "All") {
		const itemDivisionMap = await getItemDivisionMap(
			compCodeToQuery,
			mrInfo.locNo || "11",
		);
		const sel = company.trim().toUpperCase();
		rows = rows.filter((r) => {
			const name = (r.ItemName || "").toString().trim().toUpperCase();
			const code = (r.ItemCode || "").toString().trim().toUpperCase();
			const itemDiv = itemDivisionMap.get(name) || itemDivisionMap.get(code);
			if (!itemDiv) return false;
			return itemDiv === sel || itemDiv.includes(sel) || sel.includes(itemDiv);
		});
	}

	const reportTypeTitle =
		tab === "products" ? "Product_Report" : "Sales_Report";
	const filename = `${safeMrName}_${safeCompany}_${reportTypeTitle}_${dateRangeTag}`;

	if (format === "json") {
		// Provide comprehensive sales & return rows for both product and sales PDF generators
		const jsonSalesData = rows.map((r) => ({
			"MR Name": mrName,
			Division:
				company !== "All"
					? company
					: mrInfo.division || mrInfo.company || "General",
			Manufacturer: mrInfo.company || mrInfo.division || company || "General",
			Customer: r.Customer || "Unknown Party",
			Address: r.Address || "",
			City: r.City || "",
			InvNo: r.InvNo,
			"Inv No": r.InvNo,
			InvDt: r.InvDt ? new Date(r.InvDt).toISOString().split("T")[0] : "-",
			"Inv Date": r.InvDt ? new Date(r.InvDt).toISOString().split("T")[0] : "-",
			Code: r.ItemCode || "-",
			ItemCode: r.ItemCode || "-",
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
			Srate: Number(r.Srate || r.PTR || 0),
			TaxableAmt: Number(r.IAmt || 0),
			GSTAmt: 0,
			Amount: Number(r.IAmt || 0),
			IAmt: Number(r.IAmt || 0),
			DocType: r.DocType || "",
			ReturnType: r.ReturnType || "",
			Series: r.Series || "",
		}));

		return NextResponse.json(jsonSalesData);
	}

	// Tabular data for CSV/Excel
	let totalQty = 0;
	let totalFreeQty = 0;
	let totalAmount = 0;

	const excelSalesRows = rows.map((r) => {
		const qty = Number(r.Qty || 0);
		const fQty = Number(r.FQty || 0);
		const amt = Number(r.IAmt || 0);
		const rate = Number(r.Srate || r.PTR || 0);

		totalQty += qty;
		totalFreeQty += fQty;
		totalAmount += amt;

		return {
			invNo: r.InvNo,
			invDt: r.InvDt ? new Date(r.InvDt).toLocaleDateString("en-GB") : "-",
			customer: r.Customer || "Unknown Party",
			itemCode: r.ItemCode || "-",
			itemName: r.ItemName,
			packing: r.Packing || "-",
			batchNo: r.BatchNo || "-",
			qty,
			freeQty: fQty,
			rate,
			amount: amt,
			division: mrInfo.division || mrInfo.company || "-",
		};
	});

	if (format === "excel") {
		const isProducts = tab === "products";
		const sheetTitle = isProducts
			? "Productwise Sales Statement"
			: "Sales Statement";

		const columns: ExcelColumnDef[] = [
			{ header: "Inv No", key: "invNo", width: 12 },
			{ header: "Inv Date", key: "invDt", width: 12 },
			{ header: "Customer / Party", key: "customer", width: 28 },
			{ header: "Item Code", key: "itemCode", width: 12 },
			{ header: "Item Name", key: "itemName", width: 26 },
			{ header: "Packing", key: "packing", width: 10 },
			{ header: "Batch No", key: "batchNo", width: 12 },
			{
				header: "Qty",
				key: "qty",
				width: 10,
				numFmt: "#,##0",
				alignment: { horizontal: "right" },
			},
			{
				header: "Free Qty",
				key: "freeQty",
				width: 10,
				numFmt: "#,##0",
				alignment: { horizontal: "right" },
			},
			{
				header: "Rate (₹)",
				key: "rate",
				width: 12,
				numFmt: "#,##0.00",
				alignment: { horizontal: "right" },
			},
			{
				header: "Amount (₹)",
				key: "amount",
				width: 14,
				numFmt: "#,##0.00",
				alignment: { horizontal: "right" },
			},
			{ header: "Division", key: "division", width: 14 },
		];

		const buffer = await buildStyledExcelBuffer({
			sheetName: isProducts ? "Product Sales" : "Sales",
			title: sheetTitle,
			metadata: {
				mrName,
				company:
					mrInfo.company || (company !== "All" ? company : "All Companies"),
				division:
					company !== "All"
						? company
						: mrInfo.division || mrInfo.company || "All Divisions",
				period: `${defaultFrom} to ${defaultTo}`,
				year: "2026-27",
			},
			columns,
			data: excelSalesRows,
			totals: {
				invNo: "",
				invDt: "",
				customer: "GRAND TOTAL :",
				qty: totalQty,
				freeQty: totalFreeQty,
				amount: Number(totalAmount.toFixed(2)),
			},
		});

		return new NextResponse(new Uint8Array(buffer), {
			headers: {
				"Content-Disposition": `attachment; filename="${filename}.xlsx"`,
				"Content-Type":
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			},
		});
	}

	// CSV
	if (excelSalesRows.length === 0) {
		return new NextResponse("No data available", { status: 200 });
	}

	const csvHeaders = [
		"Inv No",
		"Inv Date",
		"Customer",
		"Item Code",
		"Item Name",
		"Packing",
		"Batch No",
		"Qty",
		"Free Qty",
		"Rate",
		"Amount",
		"Division",
	];
	const csvRows = excelSalesRows.map((r) =>
		[
			r.invNo,
			r.invDt,
			`"${r.customer.replace(/"/g, '""')}"`,
			r.itemCode,
			`"${r.itemName.replace(/"/g, '""')}"`,
			r.packing,
			r.batchNo,
			r.qty,
			r.freeQty,
			r.rate.toFixed(2),
			r.amount.toFixed(2),
			r.division,
		].join(","),
	);
	csvRows.push(
		`,,"GRAND TOTAL :",,,,,,${totalQty},${totalFreeQty},,${totalAmount.toFixed(2)},`,
	);

	return new NextResponse([csvHeaders.join(","), ...csvRows].join("\n"), {
		headers: {
			"Content-Disposition": `attachment; filename="${filename}.csv"`,
			"Content-Type": "text/csv; charset=utf-8",
		},
	});
}
