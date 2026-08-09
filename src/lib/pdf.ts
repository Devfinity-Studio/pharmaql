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
	doc.text(
		"BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,",
		14,
		currentY,
	);
	currentY += 4;
	doc.text("RAOPURA, VADODARA - 390001, GUJARAT - 24", 14, currentY);
	currentY += 4;
	doc.text(
		"Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com",
		14,
		currentY,
	);

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
	doc.text(
		`Year : ${currentYear}-${(currentYear + 1).toString().slice(2)}`,
		14,
		currentY,
	);
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
	const manufacturers = [
		...new Set(
			data.map((item) => item.Manufacturer || "UNKNOWN - MANUFACTURER"),
		),
	];

	for (const mfg of manufacturers) {
		const mfgData = data.filter(
			(item) => (item.Manufacturer || "UNKNOWN - MANUFACTURER") === mfg,
		);

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

		const claimTypes = [
			...new Set(mfgData.map((item) => item.SchemeType || "Qty")),
		];

		for (const cType of claimTypes) {
			const cTypeData = mfgData.filter(
				(item) => (item.SchemeType || "Qty") === cType,
			);

			// Scheme Type Header
			doc.setFontSize(9);
			doc.setFont("helvetica", "bold");
			doc.setTextColor(0, 0, 0);
			doc.text(`Scheme Type : ${cType}`, 14, currentY);
			currentY += 4;

			const parties = [
				...new Set(cTypeData.map((item) => item.Party || "UNKNOWN PARTY")),
			];

			for (const party of parties) {
				const partyData = cTypeData.filter(
					(item) => (item.Party || "UNKNOWN PARTY") === party,
				);

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
						MRP: { halign: "right" },
						PRate: { halign: "right" },
						PTR: { halign: "right" },
						"Net Rate": { halign: "right" },
						"Inv. Rate": { halign: "right" },
						"Sale Qty": { halign: "right" },
						"Free Qty": { halign: "right" },
						"Actual FQty": { halign: "right" },
						"Scheme Qty": { halign: "right" },
						"Rate Diff.": { halign: "right" },
						"Scheme Value": { halign: "right" },
					},
					didParseCell: (data) => {
						// Optionally format numbers to 2 decimal places here if they are numbers
						if (data.section === "body" && typeof data.cell.raw === "number") {
							// Avoid formatting integer quantities with decimals if we can detect them
							if (
								["Sale Qty", "Free Qty", "Actual FQty", "Scheme Qty"].includes(
									data.column.dataKey as string,
								)
							) {
								data.cell.text = [data.cell.raw.toString()];
							} else {
								data.cell.text = [data.cell.raw.toFixed(2)];
							}
						}
					},
				});

				currentY = (doc as any).lastAutoTable.finalY + 4;

				// Party Subtotal row (mocking visually)
				const totalSaleQty = partyData.reduce(
					(acc, curr) => acc + (curr["Sale Qty"] || 0),
					0,
				);
				const totalFreeQty = partyData.reduce(
					(acc, curr) => acc + (curr["Free Qty"] || 0),
					0,
				);
				const totalSchemeQty = partyData.reduce(
					(acc, curr) => acc + (curr["Scheme Qty"] || 0),
					0,
				);
				const totalClaimVal = partyData.reduce(
					(acc, curr) => acc + (curr["Scheme Value"] || 0),
					0,
				);

				autoTable(doc, {
					startY: currentY - 2,
					theme: "plain",
					body: [
						[
							"",
							"",
							"",
							"",
							"",
							"",
							"",
							"",
							"",
							"",
							"",
							totalSaleQty,
							totalFreeQty,
							"-",
							totalSchemeQty,
							"",
							totalClaimVal.toFixed(2),
							"",
							"",
						],
					],
					styles: {
						fontSize: 8,
						fontStyle: "bold",
						cellPadding: 1,
						halign: "right",
					},
					columnStyles: {
						0: { cellWidth: undefined },
					},
					willDrawCell: (data) => {
						if (data.section === "body") {
							// Draw top line for totals
							doc.setDrawColor(200, 200, 200);
							doc.setLineWidth(0.5);
							doc.line(
								data.cell.x,
								data.cell.y,
								data.cell.x + data.cell.width,
								data.cell.y,
							);
						}
					},
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
					"Scheme Value": 0,
				});
			}
			const agg = summaryMap.get(key);
			agg["Sale Qty"] += item["Sale Qty"] || 0;
			agg["Free Qty"] += item["Free Qty"] || 0;
			agg["Scheme Qty"] += item["Scheme Qty"] || 0;
			agg["Scheme Value"] += item["Scheme Value"] || 0;
		});

		const summaryData = Array.from(summaryMap.values());

		// Add total row to summary
		const mfgSaleQty = summaryData.reduce(
			(acc, curr) => acc + curr["Sale Qty"],
			0,
		);
		const mfgFreeQty = summaryData.reduce(
			(acc, curr) => acc + curr["Free Qty"],
			0,
		);
		const mfgSchemeQty = summaryData.reduce(
			(acc, curr) => acc + curr["Scheme Qty"],
			0,
		);
		const mfgClaimVal = summaryData.reduce(
			(acc, curr) => acc + curr["Scheme Value"],
			0,
		);

		summaryData.push({
			ItemName: "Total :",
			Packing: "",
			"Sale Qty": mfgSaleQty,
			"Free Qty": mfgFreeQty,
			"Actual FQty": "-",
			"Scheme Qty": mfgSchemeQty,
			"Scheme Value": mfgClaimVal,
		});

		autoTable(doc, {
			startY: currentY + 2,
			margin: { left: 30 }, // Indent the summary
			tableWidth: 150,
			columns: summaryColumns,
			body: summaryData,
			theme: "plain",
			styles: { fontSize: 8, cellPadding: 1 },
			headStyles: {
				fontStyle: "bold",
				lineWidth: { top: 0.5, bottom: 0.5 },
				lineColor: [200, 200, 200],
			},
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
				if (
					data.section === "body" &&
					data.row.index === summaryData.length - 1
				) {
					doc.setDrawColor(200, 200, 200);
					doc.setLineWidth(0.5);
					doc.line(
						data.cell.x,
						data.cell.y,
						data.cell.x + data.cell.width,
						data.cell.y,
					);
				}
			},
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
			body: [
				[
					"",
					"",
					"",
					"",
					"",
					"",
					"",
					"",
					"",
					"",
					"",
					mfgSaleQty,
					mfgFreeQty,
					"-",
					mfgSchemeQty,
					"",
					mfgClaimVal.toFixed(2),
					"",
					"",
				],
			],
			styles: {
				fontSize: 9,
				fontStyle: "bold",
				cellPadding: 1,
				halign: "right",
			},
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
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		doc.text(
			`${mrName || "ADMIN"} (${footerDate})`,
			14,
			doc.internal.pageSize.height - 10,
		);
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

	let currentY = 20;

	// Draw custom header
	doc.setFontSize(28);
	doc.setFont("helvetica", "bolditalic");
	doc.setTextColor(11, 37, 69); // #0B2545
	doc.text("A", 14, currentY); 

	doc.setFontSize(16);
	doc.setFont("helvetica", "bold");
	doc.text("ASMEE PHARMA PRIVATE LIMITED", 26, currentY - 4);

	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(100, 100, 100);
	doc.text(
		"BASEMENT-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP",
		26,
		currentY + 1,
	);
	doc.text("ROAD, RAOPURA, VADODARA - 390001, GUJARAT", 26, currentY + 5);
	doc.text(
		"Contact: 9409789800, Mobile: 9409789700",
		26,
		currentY + 9,
	);

	// Right side details
	doc.setTextColor(11, 37, 69);
	doc.setFontSize(10);
	doc.setFont("helvetica", "bold");
	doc.text("Stock Movement Statement", 280, currentY - 4, { align: "right" });

	let rightY = currentY;
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(50, 50, 50);
	if (fromDate || toDate) {
		doc.text(`For the Period of : ${fromDate || ""} to ${toDate || ""}`, 280, rightY, { align: "right" });
		rightY += 4;
	}

	doc.text("Purc Days : Difference between last purchase date and today's date", 280, rightY, { align: "right" });
	
	rightY += 6;
	doc.setFontSize(10);
	doc.text("Value Calc. on : PRate", 280, rightY, { align: "right" });

	currentY += 16;
	doc.setDrawColor(11, 37, 69);
	doc.setLineWidth(0.5);
	doc.line(14, currentY, 280, currentY);
	
	currentY += 5;

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

	const divisions = [
		...new Set(data.map((item) => item.Division || item.Manufacturer || "UNKNOWN")),
	].sort();

	let grandTotalOpeningValue = 0;
	let grandTotalPurchaseValue = 0;
	let grandTotalSalesValue = 0;
	let grandTotalStockValue = 0;

	for (const div of divisions) {
		const divData = data.filter(
			(item) => (item.Division || item.Manufacturer || "UNKNOWN") === div,
		);

		let divOpeningValue = 0;
		let divPurchaseValue = 0;
		let divSalesValue = 0;
		let divStockValue = 0;

		autoTable(doc, {
			startY: currentY,
			theme: "plain",
			head: [[""]],
			body: [[]],
			didDrawPage: (data) => {},
			willDrawCell: (data) => {
				if (data.section === "head") return false;
			},
		});

		currentY = (doc as any).lastAutoTable.finalY + 4;

		// Division Header Row
		doc.setFontSize(9);
		doc.setFont("helvetica", "bold");
		doc.setTextColor(0, 0, 128);

		doc.setDrawColor(200, 200, 200);
		doc.setFillColor(245, 245, 245);
		doc.rect(14, currentY - 3, 270, 6, "FD"); // Header background
		doc.text(`Division : ${div.toUpperCase()}`, 16, currentY + 1);

		currentY += 4;

		// Map data for autoTable body
		const bodyData = divData.map((row) => {
			const prate = Number(row["prate"]) || 0;
			const openingVal = (row["Opening Qty."] || 0) * prate;
			const purchaseVal = (row["Purchase Qty"] || 0) * prate;
			const salesVal = (row["Sales Qty."] || 0) * prate;
			const stockVal = row["Stock Value"] || 0;

			divOpeningValue += openingVal;
			divPurchaseValue += purchaseVal;
			divSalesValue += salesVal;
			divStockValue += stockVal;

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

		grandTotalOpeningValue += divOpeningValue;
		grandTotalPurchaseValue += divPurchaseValue;
		grandTotalSalesValue += divSalesValue;
		grandTotalStockValue += divStockValue;

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
				Packing: { halign: "center" },
			},
		});

		currentY = (doc as any).lastAutoTable.finalY;

		// Division Total Row
		autoTable(doc, {
			startY: currentY,
			theme: "plain",
			body: [
				[
					`Total value of ${div.toUpperCase()} :`,
					"",
					"",
					divOpeningValue.toFixed(2),
					divPurchaseValue.toFixed(2),
					"",
					"",
					"",
					divSalesValue.toFixed(2),
					"",
					"",
					"",
					divStockValue.toFixed(2),
				],
			],
			styles: {
				fontSize: 8,
				fontStyle: "bold",
				cellPadding: 1,
				textColor: [0, 0, 0],
			},
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
					doc.line(
						data.cell.x,
						data.cell.y,
						data.cell.x + data.cell.width,
						data.cell.y,
					);
					doc.line(
						data.cell.x,
						data.cell.y + data.cell.height,
						data.cell.x + data.cell.width,
						data.cell.y + data.cell.height,
					);
				}
			},
		});

		currentY = (doc as any).lastAutoTable.finalY + 6;
	}

	if (divisions.length > 1) {
		currentY += 4;
		
		for (const div of divisions) {
			const divData = data.filter(
				(item) => (item.Division || item.Manufacturer || "UNKNOWN") === div,
			);
			
			let summaryOpening = 0;
			let summaryPurchase = 0;
			let summarySales = 0;
			let summaryStock = 0;
			divData.forEach((row) => {
				const prate = Number(row["prate"]) || 0;
				summaryOpening += (row["Opening Qty."] || 0) * prate;
				summaryPurchase += (row["Purchase Qty"] || 0) * prate;
				summarySales += (row["Sales Qty."] || 0) * prate;
				summaryStock += row["Stock Value"] || 0;
			});

			autoTable(doc, {
				startY: currentY,
				theme: "plain",
				body: [
					[
						`Total value of ${div.toUpperCase()} :`,
						"",
						"",
						summaryOpening.toFixed(2),
						summaryPurchase.toFixed(2),
						"",
						"",
						"",
						summarySales.toFixed(2),
						"",
						"",
						"",
						summaryStock.toFixed(2),
					],
				],
				styles: {
					fontSize: 8,
					fontStyle: "bold",
					cellPadding: 1,
					textColor: [11, 37, 69],
					fillColor: [240, 244, 248],
				},
				columnStyles: {
					3: { halign: "right" },
					4: { halign: "right" },
					8: { halign: "right" },
					12: { halign: "right", textColor: [0, 86, 179] },
				},
				willDrawCell: (data) => {
					if (data.section === "body") {
						doc.setDrawColor(200, 200, 200);
						doc.setLineWidth(1.0);
						doc.line(
							data.cell.x,
							data.cell.y,
							data.cell.x + data.cell.width,
							data.cell.y,
						);
						doc.line(
							data.cell.x,
							data.cell.y + data.cell.height,
							data.cell.x + data.cell.width,
							data.cell.y + data.cell.height,
						);
					}
				},
			});
			currentY = (doc as any).lastAutoTable.finalY;
		}
		currentY += 4;
	}

	// Grand Total Row
	autoTable(doc, {
		startY: currentY,
		theme: "plain",
		body: [
			[
				"Total Value :",
				"",
				"",
				grandTotalOpeningValue.toFixed(2),
				grandTotalPurchaseValue.toFixed(2),
				"",
				"",
				"",
				grandTotalSalesValue.toFixed(2),
				"",
				"",
				"",
				grandTotalStockValue.toFixed(2),
			],
		],
		styles: {
			fontSize: 10,
			fontStyle: "bold",
			cellPadding: 2,
			textColor: [11, 37, 69],
			fillColor: [243, 244, 246],
		},
		columnStyles: {
			3: { halign: "right" },
			4: { halign: "right" },
			8: { halign: "right" },
			12: { halign: "right" },
		},
		willDrawCell: (data) => {
			if (data.section === "body") {
				doc.setDrawColor(11, 37, 69);
				doc.setLineWidth(2.0);
				doc.line(
					data.cell.x,
					data.cell.y + data.cell.height,
					data.cell.x + data.cell.width,
					data.cell.y + data.cell.height,
				);
			}
		},
	});

	currentY = (doc as any).lastAutoTable.finalY + 5;

	// Footer with Admin and Date
	const pageCount = (doc as any).internal.getNumberOfPages();
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		doc.setFontSize(8);
		doc.setFont("helvetica", "italic");
		const footerDate = new Date().toLocaleString("en-IN", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		doc.text(
			`${mrName || "ADMIN"} (${footerDate})`,
			14,
			doc.internal.pageSize.height - 10,
		);
	}

	doc.save(filename);
}

export function generateGroupedPdfReport(
	title: string,
	filename: string,
	data: any[],
	columns: {
		header: string;
		dataKey: string;
		halign?: "left" | "center" | "right";
	}[],
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
	doc.text(
		"BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,",
		14,
		currentY,
	);
	currentY += 4;
	doc.text("RAOPURA, VADODARA - 390001, GUJARAT - 24", 14, currentY);
	currentY += 4;
	doc.text(
		"Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com",
		14,
		currentY,
	);

	currentY += 8;
	const currentYear = new Date().getFullYear();
	doc.setFontSize(9);
	doc.setFont("helvetica", "bold");
	doc.text(
		`Year : ${currentYear}-${(currentYear + 1).toString().slice(2)}`,
		14,
		currentY,
	);

	doc.setFontSize(8);
	doc.setFont("helvetica", "italic");
	doc.text("Page 1 of 1", 270, currentY);

	currentY += 5;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(9);
	doc.text(
		`${title} for the Period of ${fromDate || "Start"} to ${toDate || "End"}`,
		14,
		currentY,
	);

	currentY += 4;

	const manufacturers = [
		...new Set(data.map((item) => item.Manufacturer || "UNKNOWN")),
	];

	const amountKey = columns.find(
		(c) =>
			c.dataKey.toLowerCase().includes("amount") ||
			c.dataKey.toLowerCase().includes("value"),
	)?.dataKey;
	const qtyKey = columns.find(
		(c) =>
			c.dataKey.toLowerCase().includes("qty") &&
			!c.dataKey.toLowerCase().includes("free"),
	)?.dataKey;

	let grandTotalAmount = 0;
	let grandTotalQty = 0;

	for (const mfg of manufacturers) {
		const mfgData = data.filter(
			(item) => (item.Manufacturer || "UNKNOWN") === mfg,
		);

		let mfgAmount = 0;
		let mfgQty = 0;

		autoTable(doc, {
			startY: currentY,
			theme: "plain",
			head: [[""]],
			body: [[]],
			didDrawPage: (data) => {},
			willDrawCell: (data) => {
				if (data.section === "head") return false;
			},
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
			if (amountKey) mfgAmount += Number(row[amountKey]) || 0;
			if (qtyKey) mfgQty += Number(row[qtyKey]) || 0;

			const newRow: any = { ...row };
			if (amountKey && row[amountKey])
				newRow[amountKey] = Number(row[amountKey]).toFixed(2);
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
			columnStyles: columnStyles,
		});

		currentY = (doc as any).lastAutoTable.finalY;

		// Full Company Total Row
		if (amountKey || qtyKey) {
			const totalRow: any = {};
			columns.forEach((c, i) => {
				if (i === 0) totalRow[c.dataKey] = `Total for ${mfgName} :`;
				else if (c.dataKey === amountKey)
					totalRow[c.dataKey] = mfgAmount.toFixed(2);
				else if (c.dataKey === qtyKey) totalRow[c.dataKey] = mfgQty.toString();
				else totalRow[c.dataKey] = "";
			});

			autoTable(doc, {
				startY: currentY,
				theme: "plain",
				columns: columns,
				body: [totalRow],
				styles: {
					fontSize: 8,
					fontStyle: "bold",
					cellPadding: 1,
					textColor: [0, 0, 0],
				},
				columnStyles: columnStyles,
				willDrawCell: (data) => {
					if (data.section === "body") {
						doc.setDrawColor(150, 150, 150);
						doc.setLineWidth(1);
						doc.line(
							data.cell.x,
							data.cell.y + data.cell.height,
							data.cell.x + data.cell.width,
							data.cell.y + data.cell.height,
						);
					}
				},
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
		const lastTable = (doc as any).lastAutoTable;
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
						doc.text(grandTotalAmount.toFixed(2), xPos, yPos, {
							align: "right",
						});
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
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		doc.text(
			`${mrName || "ADMIN"} (${footerDate})`,
			14,
			doc.internal.pageSize.height - 10,
		);
	}

	doc.save(filename);
}

export function generateSalesPdfReport(
	filename: string,
	data: any[],
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
	doc.setFontSize(36);
	doc.setFont("times", "italic", "bold");
	doc.setTextColor(11, 37, 69); // #0B2545
	doc.text("A", 14, currentY + 8);

	doc.setFontSize(16);
	doc.setFont("helvetica", "bold");
	doc.text("ASMEE PHARMA PRIVATE LIMITED", 30, currentY);

	currentY += 5;
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(11, 37, 69);
	doc.text(
		"BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,",
		30,
		currentY,
	);
	currentY += 4;
	doc.text("RAOPURA, VADODARA - 390001, GUJARAT - 24", 30, currentY);
	currentY += 4;
	doc.text(
		"Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com",
		30,
		currentY,
	);

	currentY += 6;
	doc.setDrawColor(11, 37, 69);
	doc.setLineWidth(0.5);
	doc.line(14, currentY, 280, currentY);

	currentY += 5;
	const currentYear = new Date().getFullYear();
	doc.setFontSize(9);
	doc.setFont("helvetica", "bold");
	doc.text(
		`Year : ${currentYear}-${(currentYear + 1).toString().slice(2)}`,
		14,
		currentY,
	);

	const rightX = 280;
	doc.text("Page 1 of 1", rightX, currentY, { align: "right" });

	currentY += 5;
	doc.setFont("helvetica", "normal");
	const periodText = `Company / Customer / Itemwise Sales for period of ${
		fromDate || "Start"
	} to ${toDate || "End"}`;
	doc.text(periodText, 14, currentY);

	currentY += 3;
	doc.setLineWidth(0.5);
	doc.line(14, currentY, 280, currentY);
	currentY += 1;

	// Table setup
	const columns = [
		{ header: "Sr.", dataKey: "Sr" },
		{ header: "Inv. No.", dataKey: "InvNo" },
		{ header: "Inv. Date", dataKey: "InvDate" },
		{ header: "Code", dataKey: "Code" },
		{ header: "Item Name", dataKey: "ItemName" },
		{ header: "Packing", dataKey: "Packing" },
		{ header: "Batch No.", dataKey: "BatchNo" },
		{ header: "MRP", dataKey: "MRP" },
		{ header: "Exp. Dt.", dataKey: "ExpDt" },
		{ header: "Qty.", dataKey: "Qty" },
		{ header: "FQty.", dataKey: "FQty" },
		{ header: "Rate", dataKey: "Rate" },
		{ header: "Taxable\nAmount", dataKey: "TaxableAmt" },
		{ header: "GST\nAmount", dataKey: "GSTAmt" },
		{ header: "Amount", dataKey: "Amount" },
	];

	// Extract divisions
	const divisions = [
		...new Set(data.map((item) => item.Division || "UNKNOWN")),
	].sort();

	let grandTotalQty = 0;
	let grandTotalTaxable = 0;
	let grandTotalGST = 0;
	let grandTotalAmount = 0;

	for (const div of divisions) {
		const divData = data.filter((item) => (item.Division || "UNKNOWN") === div);
		const customers = [...new Set(divData.map((d) => d.Customer || "Unknown Party"))].sort();

		let divQty = 0;
		let divTaxable = 0;
		let divGST = 0;
		let divAmount = 0;

		// Draw Division Header Row
		autoTable(doc, {
			startY: currentY,
			theme: "plain",
			body: [[div.toUpperCase()]],
			styles: {
				fontSize: 9,
				fontStyle: "bold",
				textColor: [107, 76, 42],
				fillColor: [253, 245, 230],
				cellPadding: 2,
			},
			willDrawCell: (data) => {
				if (data.section === "body") {
					doc.setDrawColor(200, 200, 200);
					doc.setLineWidth(0.5);
					doc.line(
						data.cell.x,
						data.cell.y + data.cell.height,
						data.cell.x + data.cell.width,
						data.cell.y + data.cell.height,
					);
				}
			},
		});
		currentY = (doc as any).lastAutoTable.finalY;

		for (const cust of customers) {
			const custData = divData.filter((d) => (d.Customer || "Unknown Party") === cust);
			
			let custQty = 0;
			let custTaxable = 0;
			let custGST = 0;
			let custAmount = 0;

			const bodyData = custData.map((row, idx) => {
				const qty = Number(row.Qty) || 0;
				const taxable = Number(row.TaxableAmt) || 0;
				const gst = Number(row.GSTAmt) || 0;
				const amt = taxable + gst;

				custQty += qty;
				custTaxable += taxable;
				custGST += gst;
				custAmount += amt;

				return {
					Sr: (idx + 1).toString(),
					InvNo: row.InvNo || "-",
					InvDate: row.InvDate || row.InvDt ? new Date(row.InvDate || row.InvDt).toLocaleDateString() : "-",
					Code: row.Code || "-",
					ItemName: row.ItemName || row.Product || "-",
					Packing: row.Packing || "10 Tablets",
					BatchNo: row.BatchNo || "-",
					MRP: Number(row.MRP || 0).toFixed(2),
					ExpDt: row.ExpDt || "-",
					Qty: qty.toString(),
					FQty: Number(row.FQty || 0).toString(),
					Rate: Number(row.Rate || 0).toFixed(2),
					TaxableAmt: taxable.toFixed(2),
					GSTAmt: gst.toFixed(2),
					Amount: amt.toFixed(2),
				};
			});

			divQty += custQty;
			divTaxable += custTaxable;
			divGST += custGST;
			divAmount += custAmount;

			// Draw Customer Header Row
			autoTable(doc, {
				startY: currentY,
				theme: "plain",
				body: [[cust.toUpperCase()]],
				styles: {
					fontSize: 8,
					fontStyle: "bold",
					textColor: [21, 87, 36],
					fillColor: [212, 237, 218],
					cellPadding: 2,
				},
				willDrawCell: (data) => {
					if (data.section === "body") {
						doc.setDrawColor(204, 229, 255);
						doc.setLineWidth(1.0);
						doc.line(
							data.cell.x,
							data.cell.y,
							data.cell.x + data.cell.width,
							data.cell.y,
						);
						doc.line(
							data.cell.x,
							data.cell.y + data.cell.height,
							data.cell.x + data.cell.width,
							data.cell.y + data.cell.height,
						);
					}
				},
			});
			currentY = (doc as any).lastAutoTable.finalY;

			// Draw Customer Rows
			autoTable(doc, {
				startY: currentY,
				columns: columns,
				body: bodyData,
				theme: "plain",
				styles: {
					fontSize: 7,
					cellPadding: 1,
					textColor: [0, 0, 0],
				},
				headStyles: {
					fontSize: 8,
					fontStyle: "bold",
					textColor: [11, 37, 69],
				},
				columnStyles: {
					MRP: { halign: "right" },
					ExpDt: { halign: "center" },
					Qty: { halign: "right" },
					FQty: { halign: "right" },
					Rate: { halign: "right" },
					TaxableAmt: { halign: "right" },
					GSTAmt: { halign: "right" },
					Amount: { halign: "right" },
				},
				willDrawCell: (data) => {
					if (data.section === "body") {
						doc.setDrawColor(243, 244, 246);
						doc.setLineWidth(0.5);
						doc.line(
							data.cell.x,
							data.cell.y + data.cell.height,
							data.cell.x + data.cell.width,
							data.cell.y + data.cell.height,
						);
					}
				},
			});
			currentY = (doc as any).lastAutoTable.finalY;

			// Draw Customer Total Row
			autoTable(doc, {
				startY: currentY,
				theme: "plain",
				body: [
					[
						`Total value of ${cust.toUpperCase()} :`,
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						custQty.toString(),
						"",
						"",
						custTaxable.toFixed(2),
						custGST.toFixed(2),
						custAmount.toFixed(2),
					],
				],
				styles: {
					fontSize: 7,
					fontStyle: "bold",
					textColor: [11, 37, 69],
					fillColor: [240, 244, 248],
					cellPadding: 1.5,
				},
				columnStyles: {
					9: { halign: "right" },
					12: { halign: "right" },
					13: { halign: "right" },
					14: { halign: "right", textColor: [0, 86, 179] },
				},
				willDrawCell: (data) => {
					if (data.section === "body") {
						doc.setDrawColor(200, 200, 200);
						doc.setLineWidth(1.0);
						doc.line(
							data.cell.x,
							data.cell.y,
							data.cell.x + data.cell.width,
							data.cell.y,
						);
						doc.line(
							data.cell.x,
							data.cell.y + data.cell.height,
							data.cell.x + data.cell.width,
							data.cell.y + data.cell.height,
						);
					}
				},
			});
			currentY = (doc as any).lastAutoTable.finalY;
		}

		grandTotalQty += divQty;
		grandTotalTaxable += divTaxable;
		grandTotalGST += divGST;
		grandTotalAmount += divAmount;

		// Draw Division Total Row
		currentY += 2;
		autoTable(doc, {
			startY: currentY,
			theme: "plain",
			body: [
				[
					`Total value of ${div.toUpperCase()} :`,
					"",
					"",
					"",
					"",
					"",
					"",
					"",
					"",
					divQty.toString(),
					"",
					"",
					divTaxable.toFixed(2),
					divGST.toFixed(2),
					divAmount.toFixed(2),
				],
			],
			styles: {
				fontSize: 8,
				fontStyle: "bold",
				textColor: [11, 37, 69],
				fillColor: [243, 244, 246],
				cellPadding: 2,
			},
			columnStyles: {
				9: { halign: "right" },
				12: { halign: "right" },
				13: { halign: "right" },
				14: { halign: "right" },
			},
			willDrawCell: (data) => {
				if (data.section === "body") {
					doc.setDrawColor(11, 37, 69);
					doc.setLineWidth(1.0);
					doc.line(
						data.cell.x,
						data.cell.y + data.cell.height,
						data.cell.x + data.cell.width,
						data.cell.y + data.cell.height,
					);
				}
			},
		});
		currentY = (doc as any).lastAutoTable.finalY + 4;
	}

	// Grand Total Row
	autoTable(doc, {
		startY: currentY,
		theme: "plain",
		body: [
			[
				"Total Value :",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				grandTotalQty.toString(),
				"",
				"",
				grandTotalTaxable.toFixed(2),
				grandTotalGST.toFixed(2),
				grandTotalAmount.toFixed(2),
			],
		],
		styles: {
			fontSize: 10,
			fontStyle: "bold",
			textColor: [11, 37, 69],
			fillColor: [243, 244, 246],
			cellPadding: 3,
		},
		columnStyles: {
			9: { halign: "right" },
			12: { halign: "right" },
			13: { halign: "right" },
			14: { halign: "right" },
		},
		willDrawCell: (data) => {
			if (data.section === "body") {
				doc.setDrawColor(11, 37, 69);
				doc.setLineWidth(2.0);
				doc.line(
					data.cell.x,
					data.cell.y + data.cell.height,
					data.cell.x + data.cell.width,
					data.cell.y + data.cell.height,
				);
			}
		},
	});

	// Footer with Admin and Date
	const pageCount = (doc as any).internal.getNumberOfPages();
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		doc.setFontSize(8);
		doc.setFont("helvetica", "italic");
		const footerDate = new Date().toLocaleString("en-IN", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		doc.text(
			`${mrName || "ADMIN"} (${footerDate})`,
			14,
			doc.internal.pageSize.height - 10,
		);
	}

	doc.save(filename);
}

export function generateFreeSchemePdfReport(
	filename: string,
	data: any[],
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

	// Custom Header - Left Side
	doc.setFontSize(36);
	doc.setFont("times", "italic", "bold");
	doc.setTextColor(11, 37, 69); // #0B2545
	doc.text("A", 14, currentY + 8);

	doc.setFontSize(16);
	doc.setFont("helvetica", "bold");
	doc.text("ASMEE PHARMA PRIVATE LIMITED", 30, currentY);

	currentY += 5;
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(11, 37, 69);
	doc.text(
		"BASEMENE-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,, PRATAP ROAD,",
		30,
		currentY,
	);
	currentY += 4;
	doc.text("RAOPURA, VADODARA - 390001, GUJARAT - 24", 30, currentY);
	currentY += 4;
	doc.text(
		"Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com",
		30,
		currentY,
	);

	// Custom Header - Right Side (Legend)
	const legendRightX = 280;
	let legendY = 15;
	doc.setFontSize(8);
	doc.setFont("helvetica", "bold");
	doc.text("Qty Claim : Claim Value = PTR x ClaimQty", legendRightX, legendY, { align: "right" });
	legendY += 4;
	doc.text("Rate Claim : Claim Value = (NetRate - InvRate) x SaleQty ( Scheme )", legendRightX, legendY, { align: "right" });
	legendY += 4;
	doc.setFont("helvetica", "normal");
	doc.text("Claim Value = (PTR - InvRate) x SaleQty ( No Scheme )", legendRightX, legendY, { align: "right" });

	currentY += 6;
	const currentYear = new Date().getFullYear();
	doc.setFontSize(9);
	doc.setFont("helvetica", "bold");
	doc.text(
		`Year : ${currentYear}-${(currentYear + 1).toString().slice(2)}`,
		14,
		currentY,
	);

	doc.text("Page 1 of 1", 280, currentY, { align: "right" });

	currentY += 5;
	doc.setFont("helvetica", "bold");
	const periodText = `Qty / Special Rate Claim Report for the period of ${
		fromDate || "Start"
	} to ${toDate || "End"}`;
	doc.text(periodText, 14, currentY);

	currentY += 3;
	doc.setLineWidth(0.5);
	doc.line(14, currentY, 280, currentY);
	currentY += 1;

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
		{ header: "Claim\nQty", dataKey: "Claim Qty" },
		{ header: "Rate\nDiff.", dataKey: "Rate Diff." },
		{ header: "Claim\nValue", dataKey: "Claim Value" },
		{ header: "Item\nScheme", dataKey: "Item Scheme" },
		{ header: "Applied\nScheme", dataKey: "Applied Scheme" },
	];

	const columnStyles: any = {
		MRP: { halign: "right" },
		PRate: { halign: "right" },
		PTR: { halign: "right" },
		"Net Rate": { halign: "right" },
		"Inv. Rate": { halign: "right" },
		"Sale Qty": { halign: "right" },
		"Free Qty": { halign: "right" },
		"Actual FQty": { halign: "right" },
		"Claim Qty": { halign: "right" },
		"Rate Diff.": { halign: "right" },
		"Claim Value": { halign: "right" },
		"Item Scheme": { halign: "center" },
		"Applied Scheme": { halign: "center" },
	};

	const divisions = [
		...new Set(data.map((item) => item.Division || item.Manufacturer || "UNKNOWN")),
	].sort();

	for (const div of divisions) {
		const divData = data.filter(
			(item) => (item.Division || item.Manufacturer || "UNKNOWN") === div,
		);

		// Division Header Row
		autoTable(doc, {
			startY: currentY,
			theme: "plain",
			body: [[div.toUpperCase()]],
			styles: {
				fontSize: 9,
				fontStyle: "bold",
				textColor: [0, 0, 200], // Blue-ish
				fillColor: [253, 245, 230],
				cellPadding: 2,
			},
			willDrawCell: (data) => {
				if (data.section === "body") {
					doc.setDrawColor(200, 200, 200);
					doc.setLineWidth(0.5);
					doc.line(
						data.cell.x,
						data.cell.y + data.cell.height,
						data.cell.x + data.cell.width,
						data.cell.y + data.cell.height,
					);
				}
			},
		});
		currentY = (doc as any).lastAutoTable.finalY + 2;

		const claimTypes = [...new Set(divData.map((d) => d.SchemeType || "Qty"))].sort();

		for (const cType of claimTypes) {
			const typeData = divData.filter((d) => (d.SchemeType || "Qty") === cType);
			
			// Claim Type Header (Underlined italic)
			doc.setFontSize(8);
			doc.setFont("helvetica", "italic", "bold");
			doc.setTextColor(0, 0, 0);
			doc.text(`Claim Type : ${cType}`, 14, currentY);
			doc.setDrawColor(0, 0, 0);
			doc.setLineWidth(0.2);
			doc.line(14, currentY + 1, 40, currentY + 1); // Simple underline
			currentY += 4;

			const customers = [...new Set(typeData.map((d) => d.Party || d.Customer || "Unknown Party"))].sort();

			let typeSaleQty = 0;
			let typeFreeQty = 0;
			let typeActualFQty = 0;
			let typeClaimQty = 0;
			let typeClaimValue = 0;

			const typeSummaryMap = new Map<string, any>(); // For the "Summary :" table at the end of the type

			for (const cust of customers) {
				const custData = typeData.filter((d) => (d.Party || d.Customer || "Unknown Party") === cust);

				// Customer Header Row (Bold italic)
				doc.setFontSize(8);
				doc.setFont("helvetica", "italic", "bold");
				doc.text(cust.toUpperCase(), 14, currentY);
				currentY += 2;

				let custSaleQty = 0;
				let custFreeQty = 0;
				let custActualFQty = 0;
				let custClaimQty = 0;
				let custClaimValue = 0;

				const bodyData = custData.map((row) => {
					const saleQty = Number(row["Sale Qty"]) || 0;
					const freeQty = Number(row["Free Qty"]) || 0;
					const actualFQty = Number(row["Actual FQty"]) || 0;
					const claimQty = Number(row["Claim Qty"]) || 0;
					const claimValue = Number(row["Claim Value"]) || 0;

					custSaleQty += saleQty;
					custFreeQty += freeQty;
					custActualFQty += actualFQty;
					custClaimQty += claimQty;
					custClaimValue += claimValue;

					const pName = row["Product Name"] || "-";
					if (!typeSummaryMap.has(pName)) {
						typeSummaryMap.set(pName, {
							Packing: row.Packing || "-",
							saleQty: 0,
							freeQty: 0,
							actualFQty: 0,
							claimQty: 0,
							claimValue: 0
						});
					}
					const sum = typeSummaryMap.get(pName);
					sum.saleQty += saleQty;
					sum.freeQty += freeQty;
					sum.actualFQty += actualFQty;
					sum.claimQty += claimQty;
					sum.claimValue += claimValue;

					return {
						Code: row.Code || "-",
						"Product Name": pName,
						Packing: row.Packing || "-",
						"Batch No.": row["Batch No."] || "-",
						"Inv. No.": row["Inv. No."] || "-",
						"Inv. Dt.": row["Inv. Dt."] || "-",
						MRP: Number(row.MRP || 0).toFixed(2),
						PRate: Number(row.PRate || 0).toFixed(2),
						PTR: Number(row.PTR || 0).toFixed(2),
						"Net Rate": Number(row["Net Rate"] || 0).toFixed(2),
						"Inv. Rate": Number(row["Inv. Rate"] || 0).toFixed(2),
						"Sale Qty": saleQty.toString(),
						"Free Qty": freeQty.toString(),
						"Actual FQty": actualFQty > 0 ? actualFQty.toString() : "-",
						"Claim Qty": claimQty.toString(),
						"Rate Diff.": Number(row["Rate Diff."] || 0).toFixed(2),
						"Claim Value": claimValue.toFixed(2),
						"Item Scheme": row["Item Scheme"] || "-",
						"Applied Scheme": row["Applied Scheme"] || "-",
					};
				});

				typeSaleQty += custSaleQty;
				typeFreeQty += custFreeQty;
				typeActualFQty += custActualFQty;
				typeClaimQty += custClaimQty;
				typeClaimValue += custClaimValue;

				// Draw Customer Rows
				autoTable(doc, {
					startY: currentY,
					columns: columns,
					body: bodyData,
					theme: "plain",
					styles: {
						fontSize: 7,
						cellPadding: 1,
						textColor: [0, 0, 0],
					},
					headStyles: {
						fontSize: 7,
						fontStyle: "bold",
						textColor: [0, 0, 0],
					},
					columnStyles: columnStyles,
				});
				currentY = (doc as any).lastAutoTable.finalY;
			}

			// Subtotal for Claim Type
			const lastTable = (doc as any).lastAutoTable;
			doc.setDrawColor(0, 0, 0);
			doc.setLineWidth(0.5);
			
			// Try to find the exact X position for Sale Qty and others
			// We can just use an autoTable to make it align perfectly!
			autoTable(doc, {
				startY: currentY,
				theme: "plain",
				columns: columns,
				body: [
					{
						"Code": "",
						"Product Name": "",
						"Packing": "",
						"Batch No.": "",
						"Inv. No.": "",
						"Inv. Dt.": "",
						"MRP": "",
						"PRate": "",
						"PTR": "",
						"Net Rate": "",
						"Inv. Rate": "",
						"Sale Qty": typeSaleQty.toString(),
						"Free Qty": typeFreeQty.toString(),
						"Actual FQty": typeActualFQty > 0 ? typeActualFQty.toString() : "-",
						"Claim Qty": typeClaimQty.toString(),
						"Rate Diff.": "",
						"Claim Value": typeClaimValue.toFixed(2),
						"Item Scheme": "",
						"Applied Scheme": ""
					}
				],
				styles: {
					fontSize: 7,
					fontStyle: "bold",
					textColor: [0, 0, 0],
					cellPadding: 1,
				},
				columnStyles: columnStyles,
				willDrawCell: (data) => {
					if (data.section === "body") {
						// Only draw borders above and below the totals
						if (data.column.dataKey === "Sale Qty" || data.column.dataKey === "Free Qty" || 
							data.column.dataKey === "Actual FQty" || data.column.dataKey === "Claim Qty" ||
							data.column.dataKey === "Claim Value") {
							
							doc.setDrawColor(0, 0, 0);
							doc.setLineWidth(0.5);
							doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
							doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
						}
					}
				}
			});
			currentY = (doc as any).lastAutoTable.finalY + 8;

			// SUMMARY BLOCK
			doc.setFontSize(8);
			doc.setFont("helvetica", "bold");
			doc.setFillColor(230, 230, 230);
			doc.rect(14, currentY, 20, 5, 'F');
			doc.text("Summary :", 15, currentY + 3.5);
			currentY += 6;

			const summaryBody: any[] = [];
			Array.from(typeSummaryMap.keys()).sort().forEach(pName => {
				const v = typeSummaryMap.get(pName);
				summaryBody.push([
					pName,
					v.Packing,
					v.saleQty.toString(),
					v.freeQty.toString(),
					v.actualFQty > 0 ? v.actualFQty.toString() : "-",
					v.claimQty.toString(),
					v.claimValue.toFixed(2)
				]);
			});
			
			// Summary Table
			autoTable(doc, {
				startY: currentY,
				margin: { left: 14, right: 140 }, // Keep it on the left side
				head: [["ItemName", "Packing", "Sale\nQty", "Free\nQty", "Actual\nFQty", "Claim\nQty", "Claim\nValue"]],
				body: summaryBody,
				theme: "plain",
				styles: {
					fontSize: 7,
					cellPadding: 1,
					textColor: [0, 0, 0],
				},
				headStyles: {
					fontSize: 7,
					fontStyle: "bold",
					textColor: [0, 0, 0],
					lineColor: [0,0,0],
					lineWidth: {top: 0.5, bottom: 0.5}
				},
				columnStyles: {
					2: { halign: "right" },
					3: { halign: "right" },
					4: { halign: "right" },
					5: { halign: "right" },
					6: { halign: "right" }
				}
			});
			currentY = (doc as any).lastAutoTable.finalY;

			// Summary Total
			autoTable(doc, {
				startY: currentY,
				margin: { left: 14, right: 140 },
				theme: "plain",
				body: [[
					"Total :",
					"",
					typeSaleQty.toString(),
					typeFreeQty.toString(),
					typeActualFQty > 0 ? typeActualFQty.toString() : "-",
					typeClaimQty.toString(),
					typeClaimValue.toFixed(2)
				]],
				styles: {
					fontSize: 7,
					fontStyle: "bold",
					textColor: [0, 0, 0],
					cellPadding: 1,
				},
				columnStyles: {
					2: { halign: "right" },
					3: { halign: "right" },
					4: { halign: "right" },
					5: { halign: "right" },
					6: { halign: "right" }
				},
				willDrawCell: (data) => {
					if (data.section === "body") {
						doc.setDrawColor(0, 0, 0);
						doc.setLineWidth(0.5);
						doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
						doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
					}
				}
			});
			currentY = (doc as any).lastAutoTable.finalY + 6;
			
			// Total of DIVISION
			autoTable(doc, {
				startY: currentY,
				margin: { left: 14, right: 14 },
				theme: "plain",
				body: [[
					`Total of ${div.toUpperCase()} :`,
					"",
					"",
					"",
					"",
					"",
					"",
					"",
					"",
					"",
					"",
					typeSaleQty.toString(),
					typeFreeQty.toString(),
					"-",
					typeClaimQty.toString(),
					"",
					typeClaimValue.toFixed(2),
					"",
					""
				]],
				styles: {
					fontSize: 7,
					fontStyle: "bold",
					textColor: [0, 0, 0],
					cellPadding: 2,
				},
				columnStyles: {
					11: { halign: "right" },
					12: { halign: "right" },
					13: { halign: "right" },
					14: { halign: "right" },
					16: { halign: "right" },
				},
				willDrawCell: (data) => {
					if (data.section === "body") {
						doc.setDrawColor(0, 0, 0);
						doc.setLineWidth(0.5);
						doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
						doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
					}
				}
			});
			currentY = (doc as any).lastAutoTable.finalY + 6;
		}
	}

	// Footer with Admin and Date
	const pageCount = (doc as any).internal.getNumberOfPages();
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		doc.setFontSize(7);
		doc.setFont("helvetica", "italic");
		const footerDate = new Date().toLocaleString("en-IN", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		doc.text(
			`ADMIN (${footerDate})`,
			14,
			doc.internal.pageSize.height - 10,
		);
	}

	doc.save(filename);
}
