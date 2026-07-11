import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function generatePdfReport(
	title: string,
	filename: string,
	data: any[],
	mrName?: string,
) {
	const doc = new jsPDF("landscape");

	if (data.length === 0) {
		doc.text("No data available for the selected filters.", 14, 20);
		doc.save(filename);
		return;
	}

	let currentY = 15;

	// Draw custom header
	doc.setFontSize(16);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(30, 58, 138); // Blue
	doc.text("ASMEE PHARMA PRIVATE LIMITED", 14, currentY);

	currentY += 5;
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(50, 50, 50);
	doc.text("BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,", 14, currentY);
	currentY += 4;
	doc.text("RAOPURA, VADODARA - 390001, GUJARAT - 24", 14, currentY);
	currentY += 4;
	doc.text("Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com", 14, currentY);

	// Formulas on the right
	doc.setFontSize(8);
	doc.setFont("helvetica", "bold");
	doc.text("Qty Scheme :", 200, 15);
	doc.setFont("helvetica", "normal");
	doc.text("Scheme Value = PTR x SchemeQty", 215, 15);

	doc.setFont("helvetica", "bold");
	doc.text("Rate Scheme :", 200, 19);
	doc.setFont("helvetica", "normal");
	doc.text("Scheme Value = (NetRate - InvRate) x SaleQty   (Scheme)", 217, 19);
	doc.text("Scheme Value = (PTR - InvRate) x SaleQty   (No Scheme)", 217, 23);

	currentY += 10;
	// Year and Title
	const currentYear = new Date().getFullYear();
	doc.setFontSize(9);
	doc.setFont("helvetica", "bold");
	doc.text(`Year : ${currentYear}-${(currentYear + 1).toString().slice(2)}`, 14, currentY);
	currentY += 5;
	
	doc.text(title, 14, currentY);
	
	doc.setFont("helvetica", "normal");
	doc.text("Page 1 of 1", 270, currentY); // A basic page number placeholder

	currentY += 4;

	// Define columns exactly as requested
	const columns = [
		{ header: "Code", dataKey: "Code" },
		{ header: "Product Name", dataKey: "Product Name" },
		{ header: "Packing", dataKey: "Packing" },
		{ header: "Batch No.", dataKey: "Batch No." },
		{ header: "Inv. No.", dataKey: "Inv. No." },
		{ header: "Inv. Dt.", dataKey: "Inv. Dt." },
		{ header: "MRP", dataKey: "MRP" },
		{ header: "PRate", dataKey: "PRate" },
		{ header: "PTR", dataKey: "PTR" },
		{ header: "Net\nRate", dataKey: "Net Rate" },
		{ header: "Inv.\nRate", dataKey: "Inv. Rate" },
		{ header: "Sale\nQty", dataKey: "Sale Qty" },
		{ header: "Free\nQty", dataKey: "Free Qty" },
		{ header: "Actual\nFQty", dataKey: "Actual FQty" },
		{ header: "Claim\nQty", dataKey: "Scheme Qty" },
		{ header: "Rate\nDiff.", dataKey: "Rate Diff." },
		{ header: "Claim\nValue", dataKey: "Scheme Value" },
		{ header: "Item\nScheme", dataKey: "Item Scheme" },
		{ header: "Applied\nScheme", dataKey: "Applied Scheme" },
	];

	// Grouping Logic
	// We assume data has Manufacturer, SchemeType, and Party properties
	const manufacturers = [...new Set(data.map((item) => item.Manufacturer || "UNKNOWN - MANUFACTURER"))];

	for (const mfg of manufacturers) {
		const mfgData = data.filter((item) => (item.Manufacturer || "UNKNOWN - MANUFACTURER") === mfg);
		
		// Manufacturer Header
		autoTable(doc, {
			startY: currentY,
			theme: "plain",
			head: [[""]], // Dummy header to trick autoTable into a full-width row
			body: [[]],
			didDrawPage: (data) => {
				// We don't want standard drawing for this block, just space allocation
			},
			willDrawCell: (data) => {
				if (data.section === "head") return false;
			},
		});

		currentY = (doc as any).lastAutoTable.finalY + 4;
		doc.setFontSize(10);
		doc.setFont("helvetica", "bold");
		doc.setTextColor(30, 58, 138); // Blue
		doc.text(mfg.toUpperCase(), 14, currentY);
		currentY += 4;

		const claimTypes = [...new Set(mfgData.map((item) => item.SchemeType || "Qty"))];

		for (const cType of claimTypes) {
			const cTypeData = mfgData.filter((item) => (item.SchemeType || "Qty") === cType);

			// Scheme Type Header
			doc.setFontSize(9);
			doc.setFont("helvetica", "bold");
			doc.setTextColor(0, 0, 0);
			doc.text(`Scheme Type : ${cType}`, 14, currentY);
			currentY += 4;

			const parties = [...new Set(cTypeData.map((item) => item.Party || "UNKNOWN PARTY"))];

			for (const party of parties) {
				const partyData = cTypeData.filter((item) => (item.Party || "UNKNOWN PARTY") === party);

				// Party Name
				doc.setFontSize(9);
				doc.setFont("helvetica", "bolditalic");
				doc.setTextColor(0, 0, 0);
				doc.text(party.toUpperCase(), 14, currentY + 2);
				
				// Draw the actual table for this party
				autoTable(doc, {
					startY: currentY + 4,
					columns: columns,
					body: partyData,
					theme: "plain", // We want a very plain theme like the screenshot
					styles: {
						fontSize: 8,
						cellPadding: 1,
						textColor: [0, 0, 0],
					},
					headStyles: {
						fontStyle: "bold",
						textColor: [0, 0, 0],
						lineWidth: { top: 0.5, bottom: 0.5 },
						lineColor: [200, 200, 200],
					},
					bodyStyles: {
						lineWidth: 0,
					},
					columnStyles: {
						// Align numeric columns to right
						"MRP": { halign: "right" },
						"PRate": { halign: "right" },
						"PTR": { halign: "right" },
						"Net Rate": { halign: "right" },
						"Inv. Rate": { halign: "right" },
						"Sale Qty": { halign: "right" },
						"Free Qty": { halign: "right" },
						"Actual FQty": { halign: "right" },
						"Scheme Qty": { halign: "right" },
						"Rate Diff.": { halign: "right" },
						"Scheme Value": { halign: "right" },
					},
					didParseCell: function (data) {
						// Optionally format numbers to 2 decimal places here if they are numbers
						if (data.section === "body" && typeof data.cell.raw === "number") {
							// Avoid formatting integer quantities with decimals if we can detect them
							if (["Sale Qty", "Free Qty", "Actual FQty", "Scheme Qty"].includes(data.column.dataKey as string)) {
								data.cell.text = [data.cell.raw.toString()];
							} else {
								data.cell.text = [data.cell.raw.toFixed(2)];
							}
						}
					}
				});

				currentY = (doc as any).lastAutoTable.finalY + 4;
				
				// Party Subtotal row (mocking visually)
				const totalSaleQty = partyData.reduce((acc, curr) => acc + (curr["Sale Qty"] || 0), 0);
				const totalFreeQty = partyData.reduce((acc, curr) => acc + (curr["Free Qty"] || 0), 0);
				const totalSchemeQty = partyData.reduce((acc, curr) => acc + (curr["Scheme Qty"] || 0), 0);
				const totalClaimVal = partyData.reduce((acc, curr) => acc + (curr["Scheme Value"] || 0), 0);

				autoTable(doc, {
					startY: currentY - 2,
					theme: "plain",
					body: [[
						"", "", "", "", "", "", "", "", "", "", "",
						totalSaleQty, totalFreeQty, "-", totalSchemeQty, "", totalClaimVal.toFixed(2), "", ""
					]],
					styles: { fontSize: 8, fontStyle: "bold", cellPadding: 1, halign: "right" },
					columnStyles: {
						0: { cellWidth: undefined },
					},
					willDrawCell: (data) => {
						if (data.section === "body") {
							// Draw top line for totals
							doc.setDrawColor(200, 200, 200);
							doc.setLineWidth(0.5);
							doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
						}
					}
				});
				currentY = (doc as any).lastAutoTable.finalY + 6;
			}
		}

		// Summary table for Manufacturer
		doc.setFontSize(8);
		doc.setFont("helvetica", "bold");
		doc.text("Summary :", 30, currentY);
		
		const summaryColumns = [
			{ header: "ItemName", dataKey: "ItemName" },
			{ header: "Packing", dataKey: "Packing" },
			{ header: "Sale\nQty", dataKey: "Sale Qty" },
			{ header: "Free\nQty", dataKey: "Free Qty" },
			{ header: "Actual\nFQty", dataKey: "Actual FQty" },
			{ header: "Claim\nQty", dataKey: "Scheme Qty" },
			{ header: "Claim\nValue", dataKey: "Scheme Value" },
		];

		// Aggregate items for summary
		const summaryMap = new Map();
		mfgData.forEach((item) => {
			const key = item["Product Name"];
			if (!summaryMap.has(key)) {
				summaryMap.set(key, {
					ItemName: key,
					Packing: item["Packing"],
					"Sale Qty": 0,
					"Free Qty": 0,
					"Actual FQty": "-",
					"Scheme Qty": 0,
					"Scheme Value": 0
				});
			}
			const agg = summaryMap.get(key);
			agg["Sale Qty"] += (item["Sale Qty"] || 0);
			agg["Free Qty"] += (item["Free Qty"] || 0);
			agg["Scheme Qty"] += (item["Scheme Qty"] || 0);
			agg["Scheme Value"] += (item["Scheme Value"] || 0);
		});

		const summaryData = Array.from(summaryMap.values());
		
		// Add total row to summary
		const mfgSaleQty = summaryData.reduce((acc, curr) => acc + curr["Sale Qty"], 0);
		const mfgFreeQty = summaryData.reduce((acc, curr) => acc + curr["Free Qty"], 0);
		const mfgSchemeQty = summaryData.reduce((acc, curr) => acc + curr["Scheme Qty"], 0);
		const mfgClaimVal = summaryData.reduce((acc, curr) => acc + curr["Scheme Value"], 0);

		summaryData.push({
			ItemName: "Total :",
			Packing: "",
			"Sale Qty": mfgSaleQty,
			"Free Qty": mfgFreeQty,
			"Actual FQty": "-",
			"Scheme Qty": mfgSchemeQty,
			"Scheme Value": mfgClaimVal
		});

		autoTable(doc, {
			startY: currentY + 2,
			margin: { left: 30 }, // Indent the summary
			tableWidth: 150,
			columns: summaryColumns,
			body: summaryData,
			theme: "plain",
			styles: { fontSize: 8, cellPadding: 1 },
			headStyles: { fontStyle: "bold", lineWidth: { top: 0.5, bottom: 0.5 }, lineColor: [200, 200, 200] },
			bodyStyles: { lineWidth: 0 },
			columnStyles: {
				"Sale Qty": { halign: "right" },
				"Free Qty": { halign: "right" },
				"Actual FQty": { halign: "right" },
				"Scheme Qty": { halign: "right" },
				"Scheme Value": { halign: "right" },
			},
			didParseCell: (data) => {
				if (data.row.index === summaryData.length - 1) {
					data.cell.styles.fontStyle = "bold";
				}
				if (data.section === "body" && typeof data.cell.raw === "number") {
					if (data.column.dataKey === "Scheme Value") {
						data.cell.text = [data.cell.raw.toFixed(2)];
					} else {
						data.cell.text = [data.cell.raw.toString()];
					}
				}
			},
			willDrawCell: (data) => {
				// Draw line above Total row
				if (data.section === "body" && data.row.index === summaryData.length - 1) {
					doc.setDrawColor(200, 200, 200);
					doc.setLineWidth(0.5);
					doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
				}
			}
		});

		currentY = (doc as any).lastAutoTable.finalY + 8;

		// Manufacturer Total Line
		doc.setFontSize(9);
		doc.setFont("helvetica", "bold");
		doc.setDrawColor(0, 0, 0);
		doc.setLineWidth(0.5);
		doc.line(14, currentY, 280, currentY);
		
		doc.text(`Total of ${mfg.toUpperCase()} :`, 14, currentY + 4);
		
		// Align values manually or use a trick with autoTable
		// We can just use an empty autoTable to align it perfectly with the columns
		autoTable(doc, {
			startY: currentY + 0.5,
			theme: "plain",
			body: [[
				"", "", "", "", "", "", "", "", "", "", "",
				mfgSaleQty, mfgFreeQty, "-", mfgSchemeQty, "", mfgClaimVal.toFixed(2), "", ""
			]],
			styles: { fontSize: 9, fontStyle: "bold", cellPadding: 1, halign: "right" },
		});

		currentY = (doc as any).lastAutoTable.finalY + 2;
		doc.line(14, currentY, 280, currentY);
		currentY += 6;
	}

	// Footer with Admin and Date
	const pageCount = (doc as any).internal.getNumberOfPages();
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		doc.setFontSize(8);
		doc.setFont("helvetica", "italic");
		const footerDate = new Date().toLocaleString("en-IN", {
			day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
		});
		doc.text(`${mrName || "ADMIN"} (${footerDate})`, 14, doc.internal.pageSize.height - 10);
	}

	doc.save(filename);
}

export function generateStockPdfReport(
	filename: string,
	data: any[],
	mrName?: string,
	fromDate?: string,
	toDate?: string,
) {
	const doc = new jsPDF("landscape");

	if (data.length === 0) {
		doc.text("No stock data available for the selected filters.", 14, 20);
		doc.save(filename);
		return;
	}

	let currentY = 15;

	// Draw custom header
	doc.setFontSize(16);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(30, 58, 138); // Blue
	doc.text("ASMEE PHARMA PRIVATE LIMITED", 14, currentY);

	currentY += 5;
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(50, 50, 50);
	doc.text("BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,", 14, currentY);
	currentY += 4;
	doc.text("RAOPURA, VADODARA - 390001, GUJARAT - 24", 14, currentY);
	currentY += 4;
	doc.text("Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com", 14, currentY);

	currentY += 8;
	const currentYear = new Date().getFullYear();
	doc.setFontSize(9);
	doc.setFont("helvetica", "bold");
	doc.text(`Year : ${currentYear}-${(currentYear + 1).toString().slice(2)}`, 14, currentY);
	
	doc.setFontSize(8);
	doc.setFont("helvetica", "italic");
	doc.text("Purc Days : Difference between last purchase date and today's date", 120, currentY);
	
	doc.setFont("helvetica", "normal");
	doc.text("Page 1 of 1", 270, currentY);
	
	currentY += 5;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(9);
	doc.text(`Stock Movement Statement for the Period of ${fromDate || "Start"} to ${toDate || "End"}`, 14, currentY);
	
	doc.text("Value Calc. on : PRate", 245, currentY);

	currentY += 4;

	// Define 13 columns
	const columns = [
		{ header: "Item Name", dataKey: "Item Name" },
		{ header: "Packing", dataKey: "Packing" },
		{ header: "Purc\nDays", dataKey: "Purc Days" },
		{ header: "Opening\nQty.", dataKey: "Opening Qty." },
		{ header: "Purchase\nQty", dataKey: "Purchase Qty" },
		{ header: "S.Ret\nQty.", dataKey: "S.Ret Qty." },
		{ header: "Stk Adj\nAdd", dataKey: "Stk Adj Add" },
		{ header: "Total\nIn Qty", dataKey: "Total In Qty" },
		{ header: "Sales\nQty.", dataKey: "Sales Qty." },
		{ header: "P.Ret\nQty.", dataKey: "P.Ret Qty." },
		{ header: "Stk Adj\nLess", dataKey: "Stk Adj Less" },
		{ header: "Balance\nQty.", dataKey: "Balance Qty." },
		{ header: "Stock\nValue", dataKey: "Stock Value" },
	];

	const manufacturers = [...new Set(data.map((item) => item.Manufacturer || "UNKNOWN"))];
	let grandTotalOpeningValue = 0;
	let grandTotalPurchaseValue = 0;
	let grandTotalSalesValue = 0;
	let grandTotalStockValue = 0;

	for (const mfg of manufacturers) {
		const mfgData = data.filter((item) => (item.Manufacturer || "UNKNOWN") === mfg);
		
		let mfgOpeningValue = 0;
		let mfgPurchaseValue = 0;
		let mfgSalesValue = 0;
		let mfgStockValue = 0;

		autoTable(doc, {
			startY: currentY,
			theme: "plain",
			head: [[""]],
			body: [[]],
			didDrawPage: (data) => {},
			willDrawCell: (data) => { if (data.section === "head") return false; },
		});

		currentY = (doc as any).lastAutoTable.finalY + 4;

		// Company Header Row
		doc.setFontSize(9);
		doc.setFont("helvetica", "bold");
		doc.setTextColor(0, 0, 128); // Dark blue for company row
		const mfgName = mfg.toUpperCase();
		const mfgShort = mfg.split(" ")[0].toUpperCase();
		
		doc.setDrawColor(200, 200, 200);
		doc.setFillColor(245, 245, 245);
		doc.rect(14, currentY - 3, 270, 6, "FD"); // Header background
		doc.text(`Company : ${mfgName} - ${mfgShort}`, 16, currentY + 1);
		
		currentY += 4;
		
		// Map data for autoTable body
		const bodyData = mfgData.map((row) => {
			const prate = Number(row["prate"]) || 0;
			const openingVal = (row["Opening Qty."] || 0) * prate;
			const purchaseVal = (row["Purchase Qty"] || 0) * prate;
			const salesVal = (row["Sales Qty."] || 0) * prate;
			const stockVal = (row["Stock Value"] || 0);

			mfgOpeningValue += openingVal;
			mfgPurchaseValue += purchaseVal;
			mfgSalesValue += salesVal;
			mfgStockValue += stockVal;

			return {
				...row,
				"Stock Value": stockVal.toFixed(2),
				"Opening Qty.": row["Opening Qty."] || "-",
				"Purchase Qty": row["Purchase Qty"] || "-",
				"S.Ret Qty.": row["S.Ret Qty."] !== 0 ? row["S.Ret Qty."] : "-",
				"Stk Adj Add": row["Stk Adj Add"] !== 0 ? row["Stk Adj Add"] : "-",
				"Total In Qty": row["Total In Qty"] || "-",
				"Sales Qty.": row["Sales Qty."] || "-",
				"P.Ret Qty.": row["P.Ret Qty."] !== 0 ? row["P.Ret Qty."] : "-",
				"Stk Adj Less": row["Stk Adj Less"] !== 0 ? row["Stk Adj Less"] : "-",
				"Balance Qty.": row["Balance Qty."] || "-",
			};
		});
		
		grandTotalOpeningValue += mfgOpeningValue;
		grandTotalPurchaseValue += mfgPurchaseValue;
		grandTotalSalesValue += mfgSalesValue;
		grandTotalStockValue += mfgStockValue;

		autoTable(doc, {
			startY: currentY,
			columns: columns,
			body: bodyData,
			theme: "plain",
			styles: {
				fontSize: 8,
				cellPadding: 1,
				textColor: [0, 0, 0],
			},
			headStyles: {
				fontStyle: "bold",
				textColor: [0, 0, 0],
				lineWidth: { top: 0.5, bottom: 0.5 },
				lineColor: [100, 100, 100], // Darker borders for head
			},
			columnStyles: {
				"Purc Days": { halign: "right" },
				"Opening Qty.": { halign: "right" },
				"Purchase Qty": { halign: "right" },
				"S.Ret Qty.": { halign: "right" },
				"Stk Adj Add": { halign: "right" },
				"Total In Qty": { halign: "right" },
				"Sales Qty.": { halign: "right" },
				"P.Ret Qty.": { halign: "right" },
				"Stk Adj Less": { halign: "right" },
				"Balance Qty.": { halign: "right" },
				"Stock Value": { halign: "right" },
				"Packing": { halign: "center" },
			}
		});

		currentY = (doc as any).lastAutoTable.finalY;

		// Company Total Row
		autoTable(doc, {
			startY: currentY,
			theme: "plain",
			body: [[
				`Total value of ${mfgShort} :`, "", "",
				mfgOpeningValue.toFixed(2), mfgPurchaseValue.toFixed(2), "", "", "",
				mfgSalesValue.toFixed(2), "", "", "", mfgStockValue.toFixed(2)
			]],
			styles: { fontSize: 8, fontStyle: "bold", cellPadding: 1, textColor: [0, 0, 0] },
			columnStyles: {
				3: { halign: "right" },
				4: { halign: "right" },
				8: { halign: "right" },
				12: { halign: "right" },
			},
			willDrawCell: (data) => {
				if (data.section === "body") {
					doc.setDrawColor(200, 200, 200);
					doc.setLineWidth(0.5);
					doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
					doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
				}
			}
		});
		currentY = (doc as any).lastAutoTable.finalY;

		// Full Company Total Row
		autoTable(doc, {
			startY: currentY,
			theme: "plain",
			body: [[
				`Total value of ${mfgName} :`, "", "",
				mfgOpeningValue.toFixed(2), mfgPurchaseValue.toFixed(2), "", "", "",
				mfgSalesValue.toFixed(2), "", "", "", mfgStockValue.toFixed(2)
			]],
			styles: { fontSize: 8, fontStyle: "bold", cellPadding: 1, textColor: [0, 0, 0] },
			columnStyles: {
				3: { halign: "right" },
				4: { halign: "right" },
				8: { halign: "right" },
				12: { halign: "right" },
			},
			willDrawCell: (data) => {
				if (data.section === "body") {
					doc.setDrawColor(150, 150, 150);
					doc.setLineWidth(1);
					doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
				}
			}
		});

		currentY = (doc as any).lastAutoTable.finalY + 6;
	}

	// Grand Total Row
	doc.setDrawColor(100, 100, 100);
	doc.setLineWidth(1.5);
	doc.line(14, currentY, 280, currentY);
	currentY += 2;
	
	doc.setFontSize(9);
	doc.setFont("helvetica", "bold");
	doc.text("Total Value :", 16, currentY + 3);
	
	const lastTable = (doc as any).lastAutoTable;
	const getXForColumn = (dataKey: string) => {
		const col = lastTable?.columns?.find((c: any) => c.dataKey === dataKey);
		return col ? col.x + col.width : 280;
	};

	doc.text(grandTotalOpeningValue.toFixed(2), getXForColumn("Opening Qty."), currentY + 3, { align: "right" });
	doc.text(grandTotalPurchaseValue.toFixed(2), getXForColumn("Purchase Qty"), currentY + 3, { align: "right" });
	doc.text(grandTotalSalesValue.toFixed(2), getXForColumn("Sales Qty."), currentY + 3, { align: "right" });
	doc.text(grandTotalStockValue.toFixed(2), getXForColumn("Stock Value"), currentY + 3, { align: "right" });
	
	currentY += 5;
	doc.line(14, currentY, 280, currentY);

	// Footer with Admin and Date
	const pageCount = (doc as any).internal.getNumberOfPages();
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		doc.setFontSize(8);
		doc.setFont("helvetica", "italic");
		const footerDate = new Date().toLocaleString("en-IN", {
			day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
		});
		doc.text(`${mrName || "ADMIN"} (${footerDate})`, 14, doc.internal.pageSize.height - 10);
	}

	doc.save(filename);
}

export function generateGroupedPdfReport(
	title: string,
	filename: string,
	data: any[],
	columns: { header: string; dataKey: string; halign?: "left" | "center" | "right" }[],
	mrName?: string,
	fromDate?: string,
	toDate?: string,
) {
	const doc = new jsPDF("landscape");

	if (data.length === 0) {
		doc.text("No data available for the selected filters.", 14, 20);
		doc.save(filename);
		return;
	}

	let currentY = 15;

	// Draw custom header
	doc.setFontSize(16);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(30, 58, 138); // Blue
	doc.text("ASMEE PHARMA PRIVATE LIMITED", 14, currentY);

	currentY += 5;
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(50, 50, 50);
	doc.text("BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,", 14, currentY);
	currentY += 4;
	doc.text("RAOPURA, VADODARA - 390001, GUJARAT - 24", 14, currentY);
	currentY += 4;
	doc.text("Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com", 14, currentY);

	currentY += 8;
	const currentYear = new Date().getFullYear();
	doc.setFontSize(9);
	doc.setFont("helvetica", "bold");
	doc.text(`Year : ${currentYear}-${(currentYear + 1).toString().slice(2)}`, 14, currentY);
	
	doc.setFontSize(8);
	doc.setFont("helvetica", "italic");
	doc.text("Page 1 of 1", 270, currentY);
	
	currentY += 5;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(9);
	doc.text(`${title} for the Period of ${fromDate || "Start"} to ${toDate || "End"}`, 14, currentY);
	
	currentY += 4;

	const manufacturers = [...new Set(data.map((item) => item.Manufacturer || "UNKNOWN"))];
	
	const amountKey = columns.find(c => c.dataKey.toLowerCase().includes("amount") || c.dataKey.toLowerCase().includes("value"))?.dataKey;
	const qtyKey = columns.find(c => c.dataKey.toLowerCase().includes("qty") && !c.dataKey.toLowerCase().includes("free"))?.dataKey;

	let grandTotalAmount = 0;
	let grandTotalQty = 0;

	for (const mfg of manufacturers) {
		const mfgData = data.filter((item) => (item.Manufacturer || "UNKNOWN") === mfg);
		
		let mfgAmount = 0;
		let mfgQty = 0;

		autoTable(doc, {
			startY: currentY,
			theme: "plain",
			head: [[""]],
			body: [[]],
			didDrawPage: (data) => {},
			willDrawCell: (data) => { if (data.section === "head") return false; },
		});

		currentY = (doc as any).lastAutoTable.finalY + 4;

		// Company Header Row
		doc.setFontSize(9);
		doc.setFont("helvetica", "bold");
		doc.setTextColor(0, 0, 128); // Dark blue for company row
		const mfgName = mfg.toUpperCase();
		
		doc.setDrawColor(200, 200, 200);
		doc.setFillColor(245, 245, 245);
		doc.rect(14, currentY - 3, 270, 6, "FD"); // Header background
		doc.text(`Company : ${mfgName}`, 16, currentY + 1);
		
		currentY += 4;
		
		// Map data for autoTable body
		const bodyData = mfgData.map((row) => {
			if (amountKey) mfgAmount += (row[amountKey] || 0);
			if (qtyKey) mfgQty += (row[qtyKey] || 0);
			
			const newRow: any = { ...row };
			if (amountKey && row[amountKey]) newRow[amountKey] = row[amountKey].toFixed(2);
			return newRow;
		});
		
		grandTotalAmount += mfgAmount;
		grandTotalQty += mfgQty;

		const columnStyles: any = {};
		columns.forEach((c, idx) => {
			if (c.halign) {
				columnStyles[c.dataKey] = { halign: c.halign };
			} else if (c.dataKey === amountKey || c.dataKey === qtyKey) {
				columnStyles[c.dataKey] = { halign: "right" };
			}
		});

		autoTable(doc, {
			startY: currentY,
			columns: columns,
			body: bodyData,
			theme: "plain",
			styles: {
				fontSize: 8,
				cellPadding: 1,
				textColor: [0, 0, 0],
			},
			headStyles: {
				fontStyle: "bold",
				textColor: [0, 0, 0],
				lineWidth: { top: 0.5, bottom: 0.5 },
				lineColor: [100, 100, 100], // Darker borders for head
			},
			columnStyles: columnStyles
		});

		currentY = (doc as any).lastAutoTable.finalY;

		// Full Company Total Row
		if (amountKey || qtyKey) {
			const totalRow: any = {};
			columns.forEach((c, i) => {
				if (i === 0) totalRow[c.dataKey] = `Total for ${mfgName} :`;
				else if (c.dataKey === amountKey) totalRow[c.dataKey] = mfgAmount.toFixed(2);
				else if (c.dataKey === qtyKey) totalRow[c.dataKey] = mfgQty.toString();
				else totalRow[c.dataKey] = "";
			});

			autoTable(doc, {
				startY: currentY,
				theme: "plain",
				columns: columns,
				body: [totalRow],
				styles: { fontSize: 8, fontStyle: "bold", cellPadding: 1, textColor: [0, 0, 0] },
				columnStyles: columnStyles,
				willDrawCell: (data) => {
					if (data.section === "body") {
						doc.setDrawColor(150, 150, 150);
						doc.setLineWidth(1);
						doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
					}
				}
			});

			currentY = (doc as any).lastAutoTable.finalY + 6;
		}
	}

	// Grand Total Row
	if (amountKey || qtyKey) {
		doc.setDrawColor(100, 100, 100);
		doc.setLineWidth(1.5);
		doc.line(14, currentY, 280, currentY);
		currentY += 2;
		
		doc.setFontSize(9);
		doc.setFont("helvetica", "bold");
		doc.text("Grand Total :", 16, currentY + 3);
		
		// Find x positions for qty and amount
		let lastTable = (doc as any).lastAutoTable;
		if (lastTable && lastTable.rows && lastTable.rows.length > 0) {
			const lastRow = lastTable.rows[lastTable.rows.length - 1];
			columns.forEach((col: any, idx) => {
				const cell = lastRow.cells[col.dataKey] || lastRow.cells[idx];
				if (cell) {
					if (col.dataKey === qtyKey) {
						const xPos = cell.x + cell.width - 2;
						const yPos = currentY + 3;
						doc.text(grandTotalQty.toString(), xPos, yPos, { align: "right" });
					}
					if (col.dataKey === amountKey) {
						const xPos = cell.x + cell.width - 2;
						const yPos = currentY + 3;
						doc.text(grandTotalAmount.toFixed(2), xPos, yPos, { align: "right" });
					}
				}
			});
		}
		
		currentY += 5;
		doc.line(14, currentY, 280, currentY);
	}

	// Footer with Admin and Date
	const pageCount = (doc as any).internal.getNumberOfPages();
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		doc.setFontSize(8);
		doc.setFont("helvetica", "italic");
		const footerDate = new Date().toLocaleString("en-IN", {
			day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
		});
		doc.text(`${mrName || "ADMIN"} (${footerDate})`, 14, doc.internal.pageSize.height - 10);
	}

	doc.save(filename);
}
