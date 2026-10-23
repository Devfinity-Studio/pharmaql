import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const PDF_SAFE_ROW_LIMIT = 2500;

/**
 * Validates dataset size before generating PDF to protect lower-memory mobile devices.
 */
export function validatePdfDatasetSize(rowCount: number): {
	safe: boolean;
	warning?: string;
	cappedRowCount: number;
} {
	if (rowCount > PDF_SAFE_ROW_LIMIT) {
		return {
			safe: false,
			warning: `Dataset contains ${rowCount} rows, which exceeds the safe PDF limit (${PDF_SAFE_ROW_LIMIT} rows) and may crash mobile devices. Capping to first ${PDF_SAFE_ROW_LIMIT} records. For complete records, please export as Excel.`,
			cappedRowCount: PDF_SAFE_ROW_LIMIT,
		};
	}
	return {
		safe: true,
		cappedRowCount: rowCount,
	};
}

/**
 * Yields execution back to the browser event loop to prevent UI freezing during large data iteration.
 */
export async function yieldToMain(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

async function getLogoDataUrl(): Promise<string | null> {
	try {
		const res = await fetch("/logo.png");
		if (!res.ok) return null;
		const blob = await res.blob();
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	} catch (e) {
		return null;
	}
}

function addFooterToAllPages(
	doc: jsPDF,
	mrName: string | undefined,
	serverTimeStr: string | undefined,
) {
	const pageCount = (doc.internal as any).getNumberOfPages();
	const personName = mrName || "Unknown";

	const dateObj = serverTimeStr ? new Date(serverTimeStr) : new Date();

	const dd = String(dateObj.getDate()).padStart(2, "0");
	const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
	const yyyy = dateObj.getFullYear();
	let hh = dateObj.getHours();
	const min = String(dateObj.getMinutes()).padStart(2, "0");
	const ss = String(dateObj.getSeconds()).padStart(2, "0");
	const ampm = hh >= 12 ? "PM" : "AM";
	hh = hh % 12;
	if (hh === 0) hh = 12;
	const strHh = String(hh).padStart(2, "0");

	const formattedDate = `${dd}/${mm}/${yyyy} ${strHh}:${min}:${ss} ${ampm}`;
	const footerText = `${personName} (${formattedDate})`;

	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		doc.setFontSize(8);
		doc.setTextColor(100);
		const pageWidth = doc.internal.pageSize.width;
		const pageHeight = doc.internal.pageSize.height;
		doc.text(`Page ${i} of ${pageCount}`, 14, pageHeight - 7);
		doc.text(footerText, pageWidth - 14, pageHeight - 7, { align: "right" });
	}
}

function formatDisplayDate(val?: string | Date | null): string {
	if (!val) return "";
	if (typeof val === "string") {
		const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (match) return `${match[3]}/${match[2]}/${match[1]}`;
		if (val.includes("T")) {
			const datePart = val.split("T")[0];
			if (datePart) {
				const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})/);
				if (m) return `${m[3]}/${m[2]}/${m[1]}`;
			}
		}
	}
	const d = new Date(val);
	if (isNaN(d.getTime())) return String(val);
	const day = String(d.getDate()).padStart(2, "0");
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const year = d.getFullYear();
	return `${day}/${month}/${year}`;
}

function formatExpDate(val?: string | Date | null): string {
	if (!val) return "";
	if (typeof val === "string") {
		const match = val.match(/\d{4}-\d{2}(-\d{2})?/);
		if (match) return match[0] || "";
	}
	const d = new Date(val);
	if (isNaN(d.getTime())) return String(val);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatHeaderDate(d?: string): string {
	if (!d) return "";
	if (d.includes("-")) {
		const parts = d.split("-");
		if (parts.length === 3 && parts[0] && parts[0].length === 4) {
			return `${parts[2]}/${parts[1]}/${parts[0]}`;
		}
		if (parts.length === 3 && parts[2] && parts[2].length === 4) {
			return `${parts[0]}/${parts[1]}/${parts[2]}`;
		}
	}
	return d;
}

function drawReportStationeryHeader(
	doc: jsPDF,
	logoDataUrl: string | null,
	title: string,
	fromDate?: string,
	toDate?: string,
	summaryRight?: string,
): number {
	let currentY = 12;

	doc.setFontSize(14);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(17, 24, 39); // text-gray-900

	let textX = 14;
	if (logoDataUrl) {
		doc.addImage(logoDataUrl, "PNG", 14, currentY - 5, 24, 14);
		textX = 40;
	}

	doc.text("ASMEE PHARMA PRIVATE LIMITED", textX, currentY);

	currentY += 4.5;
	doc.setFontSize(7.5);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(75, 85, 99); // text-gray-600
	doc.text(
		"BASEMENT-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE,",
		textX,
		currentY,
	);
	currentY += 3.2;
	doc.text("PRATAP ROAD, RAOPURA, VADODARA - 390001, GUJARAT - 390024", textX, currentY);
	currentY += 3.2;
	doc.text(
		"Contact: 9409789800, 9409789700 Mobile: 9409789700 Email: asmeepharma2022@gmail.com",
		textX,
		currentY,
	);

	const rightMargin = doc.internal.pageSize.width - 14;

	currentY += 5;
	doc.setDrawColor(209, 213, 219); // border-gray-300
	doc.setLineWidth(0.3);
	doc.line(14, currentY, rightMargin, currentY);

	currentY += 4;
	doc.setFontSize(8);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(17, 24, 39); // text-gray-900
	doc.text("Year : 2026-27", 14, currentY);

	const fDisp = formatHeaderDate(fromDate);
	const tDisp = formatHeaderDate(toDate);
	let periodStr = title;
	if (fDisp && tDisp) {
		periodStr = `${title} for Period of ${fDisp} to ${tDisp}`;
	} else if (fDisp) {
		periodStr = `${title} as of ${fDisp}`;
	}

	const midX = doc.internal.pageSize.width / 2;
	doc.setFont("helvetica", "bold");
	doc.setTextColor(11, 37, 69); // #0B2545
	doc.text(periodStr, midX, currentY, { align: "center" });

	let headerBottomY = currentY;
	if (summaryRight) {
		const lines = summaryRight.split("\n");
		doc.setFontSize(7.5);
		doc.setFont("helvetica", "bold");
		doc.setTextColor(75, 85, 99);
		lines.forEach((line, idx) => {
			const lineY = currentY + idx * 3.2;
			doc.text(line, rightMargin, lineY, { align: "right" });
			if (lineY > headerBottomY) headerBottomY = lineY;
		});
	}

	currentY = headerBottomY + 2.5;
	doc.setDrawColor(17, 24, 39); // border-gray-900
	doc.setLineWidth(0.6);
	doc.line(14, currentY, rightMargin, currentY);

	return currentY + 3;
}

// ---------------------------------------------------------------------------
// 1. STOCK MOVEMENT STATEMENT PDF
// ---------------------------------------------------------------------------
export async function generateStockPdfReport(
	filename: string,
	data: any[],
	mrName?: string,
	fromDate?: string,
	toDate?: string,
	action: "download" | "print" = "download",
	serverTimeStr?: string,
) {
	const logoDataUrl = await getLogoDataUrl();
	const doc = new jsPDF("landscape");

	const activeData = data.filter((row) => {
		const opening = Number(
			row["Opening Qty."] ?? row["Opening Qty"] ?? row["Opening"] ?? 0,
		);
		const purchase = Number(row["Purchase Qty"] ?? row["Purchase"] ?? 0);
		const sRet = Number(row["S.Ret Qty."] ?? row["SReturn"] ?? 0);
		const inQty = Number(row["Total In Qty"] ?? 0);
		const sales = Number(
			row["Sales Qty."] ?? row["Sales Qty"] ?? row["SalesQty"] ?? 0,
		);
		const pRet = Number(row["P.Ret Qty."] ?? row["PReturn"] ?? 0);
		const balance = Number(
			row["Balance Qty."] ?? row["Balance Qty"] ?? row["Qty"] ?? 0,
		);
		const stkAdjAdd = Number(row["Stk Adj Add"] ?? row["StkAdjAdd"] ?? 0);
		const stkAdjLess = Number(row["Stk Adj Less"] ?? row["StkAdjLess"] ?? 0);
		return (
			opening !== 0 ||
			purchase !== 0 ||
			sRet !== 0 ||
			inQty !== 0 ||
			sales !== 0 ||
			pRet !== 0 ||
			balance !== 0 ||
			stkAdjAdd !== 0 ||
			stkAdjLess !== 0
		);
	});

	if (activeData.length === 0) {
		doc.text(
			"No active stock movement records found for the selected period.",
			14,
			20,
		);
		addFooterToAllPages(doc, mrName, serverTimeStr);
		if (action === "print") {
			doc.autoPrint();
			window.open(URL.createObjectURL(doc.output("blob")), "_blank");
		} else {
			doc.save(filename);
		}
		return;
	}

	const sizeCheck = validatePdfDatasetSize(activeData.length);
	const renderData = sizeCheck.safe ? activeData : activeData.slice(0, PDF_SAFE_ROW_LIMIT);

	const summaryRight = sizeCheck.safe
		? `Total Items: ${activeData.length}\nValue Calc. on: PRate`
		: `Total Items: ${activeData.length} (Capped to ${PDF_SAFE_ROW_LIMIT})\nValue Calc. on: PRate`;

	const startY = drawReportStationeryHeader(
		doc,
		logoDataUrl,
		"Stock Movement Statement",
		fromDate,
		toDate,
		summaryRight,
	);

	const divisions = [
		...new Set(
			renderData.map((item) =>
				(item.Division || item.Manufacturer || "General").toString().trim(),
			),
		),
	].sort();

	const tableBody: any[] = [];
	let grandTotalOpeningValue = 0;
	let grandTotalPurchaseValue = 0;
	let grandTotalSalesValue = 0;
	let grandTotalStockValue = 0;

	for (const div of divisions) {
		const divData = renderData
			.filter(
				(item) =>
					(item.Division || item.Manufacturer || "General")
						.toString()
						.trim() === div,
			)
			.sort((a, b) =>
				(a["Item Name"] || "").localeCompare(b["Item Name"] || ""),
			);

		let divOpeningValue = 0;
		let divPurchaseValue = 0;
		let divSalesValue = 0;
		let divStockValue = 0;

		const compName = (
			divData[0]?.Manufacturer ||
			divData[0]?.Company ||
			div
		)
			.toString()
			.toUpperCase();
		const divName = div.toUpperCase();

		// Division Header Banner Row
		tableBody.push([
			{
				content: `Company:${compName} - ${divName}`,
				colSpan: 13,
				styles: {
					fillColor: [238, 246, 252],
					textColor: [0, 43, 102],
					fontStyle: "bold",
					fontSize: 8,
					lineWidth: { top: 0.3, bottom: 0.3 },
					lineColor: [184, 215, 245],
				},
			},
		]);

		divData.forEach((row) => {
			const prate =
				Number(row["prate"] ?? row["P Rate"] ?? row["PRate"] ?? 0) || 0;
			const openingQty = Number(
				row["Opening Qty."] ?? row["Opening Qty"] ?? row["Opening"] ?? 0,
			);
			const purchaseQty = Number(row["Purchase Qty"] ?? row["Purchase"] ?? 0);
			const sRetQty = Number(row["S.Ret Qty."] ?? row["SReturn"] ?? 0);
			const stkAdjAdd = Number(row["Stk Adj Add"] ?? row["StkAdjAdd"] ?? 0);
			const totalInQty = Number(
				row["Total In Qty"] ??
					openingQty + purchaseQty + sRetQty + stkAdjAdd,
			);
			const salesQty = Number(
				row["Sales Qty."] ?? row["Sales Qty"] ?? row["SalesQty"] ?? 0,
			);
			const pRetQty = Number(row["P.Ret Qty."] ?? row["PReturn"] ?? 0);
			const stkAdjLess = Number(row["Stk Adj Less"] ?? row["StkAdjLess"] ?? 0);
			const balanceQty = Number(
				row["Balance Qty."] ?? row["Balance Qty"] ?? row["Qty"] ?? 0,
			);
			const stockVal = Number(row["Stock Value"] ?? balanceQty * prate);
			const purcDays = Number(row["Purc Days"] ?? row["Days"] ?? 0);

			divOpeningValue += openingQty * prate;
			divPurchaseValue += purchaseQty * prate;
			divSalesValue += salesQty * prate;
			divStockValue += stockVal;

			const isDeadStock = purcDays > 90 && salesQty === 0;
			const rowFillColor = isDeadStock ? [254, 242, 242] : [255, 255, 255];
			const rowTextColor = isDeadStock ? [153, 27, 27] : [31, 41, 55];

			tableBody.push([
				{
					content: row["Item Name"] || "-",
					styles: {
						fillColor: rowFillColor,
						textColor: rowTextColor,
						fontStyle: isDeadStock ? "bold" : "normal",
					},
				},
				{
					content: row["Packing"] || "-",
					styles: {
						halign: "center",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
				{
					content: purcDays > 0 ? String(purcDays) : "-",
					styles: {
						halign: "right",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
				{
					content: openingQty !== 0 ? String(openingQty) : "-",
					styles: {
						halign: "right",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
				{
					content: purchaseQty !== 0 ? String(purchaseQty) : "-",
					styles: {
						halign: "right",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
				{
					content: sRetQty !== 0 ? String(sRetQty) : "-",
					styles: {
						halign: "right",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
				{
					content: stkAdjAdd !== 0 ? String(stkAdjAdd) : "-",
					styles: {
						halign: "right",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
				{
					content: totalInQty !== 0 ? String(totalInQty) : "-",
					styles: {
						halign: "right",
						fontStyle: "bold",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
				{
					content: salesQty !== 0 ? String(salesQty) : "-",
					styles: {
						halign: "right",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
				{
					content: pRetQty !== 0 ? String(pRetQty) : "-",
					styles: {
						halign: "right",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
				{
					content: stkAdjLess !== 0 ? String(stkAdjLess) : "-",
					styles: {
						halign: "right",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
				{
					content: balanceQty !== 0 ? String(balanceQty) : "-",
					styles: {
						halign: "right",
						fontStyle: "bold",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
				{
					content: stockVal !== 0 ? stockVal.toFixed(2) : "0.00",
					styles: {
						halign: "right",
						fontStyle: "bold",
						fillColor: rowFillColor,
						textColor: rowTextColor,
					},
				},
			]);
		});

		grandTotalOpeningValue += divOpeningValue;
		grandTotalPurchaseValue += divPurchaseValue;
		grandTotalSalesValue += divSalesValue;
		grandTotalStockValue += divStockValue;

		// Division Subtotal Row
		tableBody.push([
			{
				content: `Total value of ${div.toUpperCase()} :`,
				colSpan: 3,
				styles: {
					fillColor: [249, 250, 251],
					fontStyle: "bold",
					textColor: [17, 24, 39],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: divOpeningValue.toFixed(2),
				styles: {
					halign: "right",
					fontStyle: "bold",
					fillColor: [249, 250, 251],
					textColor: [30, 64, 175],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: divPurchaseValue.toFixed(2),
				styles: {
					halign: "right",
					fontStyle: "bold",
					fillColor: [249, 250, 251],
					textColor: [30, 64, 175],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: "",
				colSpan: 3,
				styles: {
					fillColor: [249, 250, 251],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: divSalesValue.toFixed(2),
				styles: {
					halign: "right",
					fontStyle: "bold",
					fillColor: [249, 250, 251],
					textColor: [30, 64, 175],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: "",
				colSpan: 3,
				styles: {
					fillColor: [249, 250, 251],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: divStockValue.toFixed(2),
				styles: {
					halign: "right",
					fontStyle: "bold",
					fillColor: [249, 250, 251],
					textColor: [30, 64, 175],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
		]);
	}

	// Grand Total Row
	tableBody.push([
		{
			content: "Grand Total Value :",
			colSpan: 3,
			styles: {
				fillColor: [243, 244, 246],
				fontStyle: "bold",
				fontSize: 8.5,
				textColor: [17, 24, 39],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandTotalOpeningValue.toFixed(2),
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8.5,
				fillColor: [243, 244, 246],
				textColor: [30, 64, 175],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandTotalPurchaseValue.toFixed(2),
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8.5,
				fillColor: [243, 244, 246],
				textColor: [30, 64, 175],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: "",
			colSpan: 3,
			styles: {
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandTotalSalesValue.toFixed(2),
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8.5,
				fillColor: [243, 244, 246],
				textColor: [30, 64, 175],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: "",
			colSpan: 3,
			styles: {
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandTotalStockValue.toFixed(2),
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8.5,
				fillColor: [243, 244, 246],
				textColor: [30, 64, 175],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
	]);

	autoTable(doc, {
		startY,
		head: [
			[
				"Item Name",
				"Packing",
				"Purc\nDays",
				"Opening\nQty.",
				"Purchase\nQty",
				"S.Ret\nQty.",
				"Stk Adj\nAdd",
				"Total\nIn Qty",
				"Sales\nQty.",
				"P.Ret\nQty.",
				"Stk Adj\nLess",
				"Balance\nQty.",
				"Stock\nValue",
			],
		],
		body: tableBody,
		theme: "plain",
		styles: {
			fontSize: 7.5,
			cellPadding: 1.2,
			textColor: [31, 41, 55],
			lineColor: [243, 244, 246],
			lineWidth: { bottom: 0.1 },
		},
		headStyles: {
			fillColor: [249, 250, 251], // bg-gray-50
			textColor: [17, 24, 39], // text-gray-900
			fontStyle: "bold",
			fontSize: 7.5,
			halign: "right",
			lineWidth: { top: 0.6, bottom: 0.6 },
			lineColor: [17, 24, 39], // border-gray-900
		},
		didParseCell: (hookData) => {
			if (hookData.section === "head") {
				if (hookData.column.index === 0) hookData.cell.styles.halign = "left";
				if (hookData.column.index === 1) hookData.cell.styles.halign = "center";
			}
		},
		columnStyles: {
			0: { cellWidth: 58, halign: "left" },
			1: { cellWidth: 16, halign: "center" },
			2: { cellWidth: 14, halign: "right" },
			3: { cellWidth: 17, halign: "right" },
			4: { cellWidth: 17, halign: "right" },
			5: { cellWidth: 16, halign: "right" },
			6: { cellWidth: 16, halign: "right" },
			7: { cellWidth: 18, halign: "right" },
			8: { cellWidth: 17, halign: "right" },
			9: { cellWidth: 16, halign: "right" },
			10: { cellWidth: 16, halign: "right" },
			11: { cellWidth: 18, halign: "right" },
			12: { cellWidth: 26, halign: "right" },
		},
		margin: { top: 14, left: 14, right: 14, bottom: 14 },
	});

	addFooterToAllPages(doc, mrName, serverTimeStr);
	if (action === "print") {
		doc.autoPrint();
		window.open(URL.createObjectURL(doc.output("blob")), "_blank");
	} else {
		doc.save(filename);
	}
}

// ---------------------------------------------------------------------------
// 2. CLAIM QUANTITY STATEMENT PDF
// ---------------------------------------------------------------------------
export async function generateFreeSchemePdfReport(
	filename: string,
	data: any[],
	mrName?: string,
	fromDate?: string,
	toDate?: string,
	action: "download" | "print" = "download",
	serverTimeStr?: string,
) {
	const logoDataUrl = await getLogoDataUrl();
	const doc = new jsPDF("landscape");

	if (data.length === 0) {
		doc.text("No claim data available for the selected filters.", 14, 20);
		addFooterToAllPages(doc, mrName, serverTimeStr);
		if (action === "print") {
			doc.autoPrint();
			window.open(URL.createObjectURL(doc.output("blob")), "_blank");
		} else {
			doc.save(filename);
		}
		return;
	}

	const startY = drawReportStationeryHeader(
		doc,
		logoDataUrl,
		"Claim Quantity Statement",
		fromDate,
		toDate,
		"Qty Claim: PTR × ClaimQty\nRate Claim: (NetRate - InvRate) × SaleQty",
	);

	const manufacturers = [
		...new Set(
			data.map(
				(item) => item.Manufacturer || item.Company || item.Division || "General",
			),
		),
	].sort();

	const tableBody: any[] = [];
	let grandSaleQty = 0;
	let grandFreeQty = 0;
	let grandActualFQty = 0;
	let grandClaimQty = 0;
	let grandClaimValue = 0;

	for (const mfg of manufacturers) {
		const mfgData = data.filter(
			(d) =>
				(d.Manufacturer || d.Company || d.Division || "General") === mfg,
		);

		const compName = (
			mfgData[0]?.Company ||
			mfgData[0]?.Manufacturer ||
			mfg
		)
			.toString()
			.toUpperCase();
		const divName = (
			mfgData[0]?.Division ||
			mfg
		)
			.toString()
			.toUpperCase();

		// Manufacturer Banner Row
		tableBody.push([
			{
				content: `Company:${compName} - ${divName}`,
				colSpan: 19,
				styles: {
					fillColor: [238, 246, 252],
					textColor: [0, 113, 188],
					fontStyle: "bold",
					fontSize: 8.5,
					lineWidth: { top: 0.3, bottom: 0.3 },
					lineColor: [184, 215, 245],
				},
			},
		]);

		const claimTypes = [
			...new Set(mfgData.map((d) => d.SchemeType || "Qty")),
		].sort();

		for (const cType of claimTypes) {
			const typeData = mfgData.filter(
				(d) => (d.SchemeType || "Qty") === cType,
			);

			// Claim Type Subheading Row
			tableBody.push([
				{
					content: `Claim Type : ${cType}`,
					colSpan: 19,
					styles: {
						fontStyle: "bolditalic",
						fontSize: 8,
						textColor: [11, 37, 69],
						fillColor: [248, 250, 252],
					},
				},
			]);

			const parties = [
				...new Set(typeData.map((d) => d.Party || d.Customer || "Unknown Party")),
			].sort();

			let typeSaleQty = 0;
			let typeFreeQty = 0;
			let typeActualFQty = 0;
			let typeClaimQty = 0;
			let typeClaimValue = 0;

			for (const party of parties) {
				const partyRows = typeData.filter(
					(d) => (d.Party || d.Customer || "Unknown Party") === party,
				);

				// Party Name Header Row
				tableBody.push([
					{
						content: party,
						colSpan: 19,
						styles: {
							fontStyle: "bold",
							fontSize: 7.5,
							textColor: [17, 24, 39],
						},
					},
				]);

				let partySaleQty = 0;
				let partyFreeQty = 0;
				let partyActualFQty = 0;
				let partyClaimQty = 0;
				let partyClaimValue = 0;

				partyRows.forEach((r) => {
					const saleQty = Number(r["Sale Qty"] ?? r.Qty ?? 0) || 0;
					const freeQty = Number(r["Free Qty"] ?? r.Free ?? r.FQty ?? 0) || 0;
					const actualFQty = Number(r["Actual FQty"] ?? r.FQty ?? 0) || 0;
					const claimQty = Number(r["Claim Qty"] ?? r.Free ?? r.FQty ?? 0) || 0;
					const claimVal = Number(r["Claim Value"] ?? r.FreeIAmt ?? 0) || 0;
					const mrp = Number(r.MRP || 0);
					const pRate = Number(r.PRate || 0);
					const ptr = Number(r.PTR || 0);
					const netRate = Number(r["Net Rate"] ?? r.SRate ?? 0);
					const invRate = Number(r["Inv. Rate"] ?? r.SRate ?? 0);
					const rawDiff = Number(r["Rate Diff."] ?? (netRate - invRate));
					const rateDiffStr = rawDiff > 0 ? rawDiff.toFixed(2) : "-";

					partySaleQty += saleQty;
					partyFreeQty += freeQty;
					partyActualFQty += actualFQty;
					partyClaimQty += claimQty;
					partyClaimValue += claimVal;

					tableBody.push([
						r.Code || r.ItemCode || "-",
						r["Product Name"] || r.ItemName || "-",
						{ content: r.Packing || "-", styles: { halign: "center" } },
						r["Batch No."] || r.BatchNo || "-",
						r["Inv. No."] || r.InvNo || "-",
						formatDisplayDate(r["Inv. Dt."] || r.InvDt) || "-",
						{
							content: mrp > 0 ? mrp.toFixed(2) : "-",
							styles: { halign: "right" },
						},
						{
							content: pRate > 0 ? pRate.toFixed(2) : "-",
							styles: { halign: "right" },
						},
						{
							content: ptr > 0 ? ptr.toFixed(2) : "-",
							styles: { halign: "right" },
						},
						{
							content: netRate > 0 ? netRate.toFixed(2) : "-",
							styles: { halign: "right" },
						},
						{
							content: invRate > 0 ? invRate.toFixed(2) : "-",
							styles: { halign: "right" },
						},
						{
							content: saleQty > 0 ? String(saleQty) : "-",
							styles: { halign: "right" },
						},
						{
							content: freeQty > 0 ? String(freeQty) : "-",
							styles: { halign: "right" },
						},
						{
							content: actualFQty > 0 ? String(actualFQty) : "-",
							styles: { halign: "right" },
						},
						{
							content: claimQty > 0 ? String(claimQty) : "-",
							styles: { halign: "right", fontStyle: "bold" },
						},
						{ content: rateDiffStr, styles: { halign: "right" } },
						{
							content: claimVal > 0 ? claimVal.toFixed(2) : "-",
							styles: { halign: "right", fontStyle: "bold" },
						},
						{
							content: r["Item Scheme"] || r.Scheme || "-",
							styles: { halign: "center" },
						},
						{
							content: r["Applied Scheme"] || r.Scheme || "-",
							styles: { halign: "center" },
						},
					]);
				});

				typeSaleQty += partySaleQty;
				typeFreeQty += partyFreeQty;
				typeActualFQty += partyActualFQty;
				typeClaimQty += partyClaimQty;
				typeClaimValue += partyClaimValue;

				// Party Subtotal Row
				tableBody.push([
					{
						content: `Total of ${party} :`,
						colSpan: 11,
						styles: {
							fontStyle: "bolditalic",
							halign: "right",
							fontSize: 7,
							textColor: [17, 24, 39],
							lineWidth: { top: 0.3 },
							lineColor: [209, 213, 219],
						},
					},
					{
						content: partySaleQty > 0 ? String(partySaleQty) : "-",
						styles: { halign: "right", fontStyle: "bold", fontSize: 7, lineWidth: { top: 0.3 }, lineColor: [209, 213, 219] },
					},
					{
						content: partyFreeQty > 0 ? String(partyFreeQty) : "-",
						styles: { halign: "right", fontStyle: "bold", fontSize: 7, lineWidth: { top: 0.3 }, lineColor: [209, 213, 219] },
					},
					{
						content: partyActualFQty > 0 ? String(partyActualFQty) : "-",
						styles: { halign: "right", fontStyle: "bold", fontSize: 7, lineWidth: { top: 0.3 }, lineColor: [209, 213, 219] },
					},
					{
						content: partyClaimQty > 0 ? String(partyClaimQty) : "-",
						styles: { halign: "right", fontStyle: "bold", fontSize: 7, lineWidth: { top: 0.3 }, lineColor: [209, 213, 219] },
					},
					{ content: "-", styles: { halign: "right", fontSize: 7, lineWidth: { top: 0.3 }, lineColor: [209, 213, 219] } },
					{
						content: partyClaimValue > 0 ? partyClaimValue.toFixed(2) : "-",
						styles: {
							halign: "right",
							fontStyle: "bold",
							fontSize: 7,
							textColor: [30, 64, 175],
							lineWidth: { top: 0.3 },
							lineColor: [209, 213, 219],
						},
					},
					{ content: "", colSpan: 2, styles: { lineWidth: { top: 0.3 }, lineColor: [209, 213, 219] } },
				]);
			}

			// Claim Type Total Row
			tableBody.push([
				{
					content: `TOTAL (${cType}) :`,
					colSpan: 11,
					styles: {
						fontStyle: "bold",
						halign: "right",
						fontSize: 7.5,
						fillColor: [249, 250, 251],
						textColor: [17, 24, 39],
						lineWidth: { top: 0.4, bottom: 0.4 },
						lineColor: [156, 163, 175],
					},
				},
				{
					content: typeSaleQty > 0 ? String(typeSaleQty) : "-",
					styles: {
						halign: "right",
						fontStyle: "bold",
						fontSize: 7.5,
						fillColor: [249, 250, 251],
						lineWidth: { top: 0.4, bottom: 0.4 },
						lineColor: [156, 163, 175],
					},
				},
				{
					content: typeFreeQty > 0 ? String(typeFreeQty) : "-",
					styles: {
						halign: "right",
						fontStyle: "bold",
						fontSize: 7.5,
						fillColor: [249, 250, 251],
						lineWidth: { top: 0.4, bottom: 0.4 },
						lineColor: [156, 163, 175],
					},
				},
				{
					content: typeActualFQty > 0 ? String(typeActualFQty) : "-",
					styles: {
						halign: "right",
						fontStyle: "bold",
						fontSize: 7.5,
						fillColor: [249, 250, 251],
						lineWidth: { top: 0.4, bottom: 0.4 },
						lineColor: [156, 163, 175],
					},
				},
				{
					content: typeClaimQty > 0 ? String(typeClaimQty) : "-",
					styles: {
						halign: "right",
						fontStyle: "bold",
						fontSize: 7.5,
						fillColor: [249, 250, 251],
						lineWidth: { top: 0.4, bottom: 0.4 },
						lineColor: [156, 163, 175],
					},
				},
				{
					content: "-",
					styles: {
						halign: "right",
						fontSize: 7.5,
						fillColor: [249, 250, 251],
						lineWidth: { top: 0.4, bottom: 0.4 },
						lineColor: [156, 163, 175],
					},
				},
				{
					content: typeClaimValue > 0 ? typeClaimValue.toFixed(2) : "-",
					styles: {
						halign: "right",
						fontStyle: "bold",
						fontSize: 7.5,
						fillColor: [249, 250, 251],
						textColor: [30, 64, 175],
						lineWidth: { top: 0.4, bottom: 0.4 },
						lineColor: [156, 163, 175],
					},
				},
				{ content: "", colSpan: 2, styles: { fillColor: [249, 250, 251], lineWidth: { top: 0.4, bottom: 0.4 }, lineColor: [156, 163, 175] } },
			]);

			grandSaleQty += typeSaleQty;
			grandFreeQty += typeFreeQty;
			grandActualFQty += typeActualFQty;
			grandClaimQty += typeClaimQty;
			grandClaimValue += typeClaimValue;
		}

		// Manufacturer Total Row
		const mfgSaleQty = mfgData.reduce((acc, curr) => acc + (Number(curr["Sale Qty"] ?? curr.Qty ?? 0) || 0), 0);
		const mfgFreeQty = mfgData.reduce((acc, curr) => acc + (Number(curr["Free Qty"] ?? curr.Free ?? curr.FQty ?? 0) || 0), 0);
		const mfgActualFQty = mfgData.reduce((acc, curr) => acc + (Number(curr["Actual FQty"] ?? curr.FQty ?? 0) || 0), 0);
		const mfgClaimQty = mfgData.reduce((acc, curr) => acc + (Number(curr["Claim Qty"] ?? curr.Free ?? curr.FQty ?? 0) || 0), 0);
		const mfgClaimValue = mfgData.reduce((acc, curr) => acc + (Number(curr["Claim Value"] ?? curr.FreeIAmt ?? 0) || 0), 0);

		tableBody.push([
			{
				content: `Total of ${mfg} :`,
				colSpan: 11,
				styles: {
					fontStyle: "bold",
					halign: "right",
					fontSize: 7.5,
					fillColor: [238, 246, 252],
					textColor: [0, 113, 188],
					lineWidth: { top: 0.5, bottom: 0.5 },
					lineColor: [184, 215, 245],
				},
			},
			{
				content: mfgSaleQty > 0 ? String(mfgSaleQty) : "-",
				styles: {
					halign: "right",
					fontStyle: "bold",
					fontSize: 7.5,
					fillColor: [238, 246, 252],
					lineWidth: { top: 0.5, bottom: 0.5 },
					lineColor: [184, 215, 245],
				},
			},
			{
				content: mfgFreeQty > 0 ? String(mfgFreeQty) : "-",
				styles: {
					halign: "right",
					fontStyle: "bold",
					fontSize: 7.5,
					fillColor: [238, 246, 252],
					lineWidth: { top: 0.5, bottom: 0.5 },
					lineColor: [184, 215, 245],
				},
			},
			{
				content: mfgActualFQty > 0 ? String(mfgActualFQty) : "-",
				styles: {
					halign: "right",
					fontStyle: "bold",
					fontSize: 7.5,
					fillColor: [238, 246, 252],
					lineWidth: { top: 0.5, bottom: 0.5 },
					lineColor: [184, 215, 245],
				},
			},
			{
				content: mfgClaimQty > 0 ? String(mfgClaimQty) : "-",
				styles: {
					halign: "right",
					fontStyle: "bold",
					fontSize: 7.5,
					fillColor: [238, 246, 252],
					lineWidth: { top: 0.5, bottom: 0.5 },
					lineColor: [184, 215, 245],
				},
			},
			{
				content: "-",
				styles: {
					halign: "right",
					fontSize: 7.5,
					fillColor: [238, 246, 252],
					lineWidth: { top: 0.5, bottom: 0.5 },
					lineColor: [184, 215, 245],
				},
			},
			{
				content: mfgClaimValue > 0 ? mfgClaimValue.toFixed(2) : "-",
				styles: {
					halign: "right",
					fontStyle: "bold",
					fontSize: 7.5,
					fillColor: [238, 246, 252],
					textColor: [30, 64, 175],
					lineWidth: { top: 0.5, bottom: 0.5 },
					lineColor: [184, 215, 245],
				},
			},
			{
				content: "",
				colSpan: 2,
				styles: {
					fillColor: [238, 246, 252],
					lineWidth: { top: 0.5, bottom: 0.5 },
					lineColor: [184, 215, 245],
				},
			},
		]);
	}

	// Grand Total Row
	tableBody.push([
		{
			content: "Grand Total Claims :",
			colSpan: 11,
			styles: {
				fillColor: [243, 244, 246],
				fontStyle: "bold",
				fontSize: 8,
				textColor: [17, 24, 39],
				halign: "right",
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandSaleQty > 0 ? String(grandSaleQty) : "-",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandFreeQty > 0 ? String(grandFreeQty) : "-",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandActualFQty > 0 ? String(grandActualFQty) : "-",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandClaimQty > 0 ? String(grandClaimQty) : "-",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: "-",
			styles: {
				halign: "right",
				fontSize: 8,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandClaimValue > 0 ? grandClaimValue.toFixed(2) : "-",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8,
				fillColor: [243, 244, 246],
				textColor: [30, 64, 175],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{ content: "", colSpan: 2, styles: { fillColor: [243, 244, 246], lineWidth: { top: 0.8, bottom: 0.8 }, lineColor: [17, 24, 39] } },
	]);

	autoTable(doc, {
		startY,
		head: [
			[
				"Code",
				"Product Name",
				"Packing",
				"Batch No.",
				"Inv. No.",
				"Inv. Dt.",
				"MRP",
				"PRate",
				"PTR",
				"Net\nRate",
				"Inv.\nRate",
				"Sale\nQty",
				"Free\nQty",
				"Actual\nFQty",
				"Claim\nQty",
				"Rate\nDiff.",
				"Claim\nValue",
				"Item\nScheme",
				"Applied\nScheme",
			],
		],
		body: tableBody,
		theme: "plain",
		styles: {
			fontSize: 6.5,
			cellPadding: 1,
			textColor: [31, 41, 55],
			lineColor: [243, 244, 246],
			lineWidth: { bottom: 0.1 },
		},
		headStyles: {
			fillColor: [249, 250, 251], // bg-gray-50
			textColor: [17, 24, 39], // text-gray-900
			fontStyle: "bold",
			fontSize: 6.5,
			halign: "right",
			lineWidth: { top: 0.6, bottom: 0.6 },
			lineColor: [17, 24, 39], // border-gray-900
		},
		didParseCell: (hookData) => {
			if (hookData.section === "head") {
				if (hookData.column.index < 2) hookData.cell.styles.halign = "left";
				if (hookData.column.index === 2 || hookData.column.index >= 17)
					hookData.cell.styles.halign = "center";
			}
		},
		columnStyles: {
			0: { cellWidth: 12 },
			1: { cellWidth: 38 },
			2: { cellWidth: 12, halign: "center" },
			3: { cellWidth: 14 },
			4: { cellWidth: 14 },
			5: { cellWidth: 14 },
			6: { cellWidth: 11, halign: "right" },
			7: { cellWidth: 11, halign: "right" },
			8: { cellWidth: 11, halign: "right" },
			9: { cellWidth: 11, halign: "right" },
			10: { cellWidth: 11, halign: "right" },
			11: { cellWidth: 11, halign: "right" },
			12: { cellWidth: 10, halign: "right" },
			13: { cellWidth: 10, halign: "right" },
			14: { cellWidth: 11, halign: "right" },
			15: { cellWidth: 11, halign: "right" },
			16: { cellWidth: 15, halign: "right" },
			17: { cellWidth: 16, halign: "center" },
			18: { cellWidth: 16, halign: "center" },
		},
		margin: { top: 14, left: 14, right: 14, bottom: 14 },
	});

	// ---------------------------------------------------------------------------
	// Summary Table by Product Name (Identical to web view Claim Summary)
	// ---------------------------------------------------------------------------
	const summaryMap = new Map<
		string,
		{
			ItemName: string;
			Packing: string;
			SaleQty: number;
			FreeQty: number;
			ActualFQty: number;
			ClaimQty: number;
			ClaimValue: number;
		}
	>();

	data.forEach((item) => {
		const key = item["Product Name"] || item.ItemName || "Unknown Item";
		if (!summaryMap.has(key)) {
			summaryMap.set(key, {
				ItemName: key,
				Packing: item.Packing || "-",
				SaleQty: 0,
				FreeQty: 0,
				ActualFQty: 0,
				ClaimQty: 0,
				ClaimValue: 0,
			});
		}
		const agg = summaryMap.get(key)!;
		agg.SaleQty += Number(item["Sale Qty"] ?? item.Qty ?? 0) || 0;
		agg.FreeQty += Number(item["Free Qty"] ?? item.Free ?? item.FQty ?? 0) || 0;
		agg.ActualFQty += Number(item["Actual FQty"] ?? item.FQty ?? 0) || 0;
		agg.ClaimQty += Number(item["Claim Qty"] ?? item.Free ?? item.FQty ?? 0) || 0;
		agg.ClaimValue += Number(item["Claim Value"] ?? item.FreeIAmt ?? 0) || 0;
	});

	const summaries = Array.from(summaryMap.values());
	const summaryTotals = summaries.reduce(
		(acc, curr) => {
			acc.SaleQty += curr.SaleQty;
			acc.FreeQty += curr.FreeQty;
			acc.ActualFQty += curr.ActualFQty;
			acc.ClaimQty += curr.ClaimQty;
			acc.ClaimValue += curr.ClaimValue;
			return acc;
		},
		{ SaleQty: 0, FreeQty: 0, ActualFQty: 0, ClaimQty: 0, ClaimValue: 0 },
	);

	const summaryBody: any[] = summaries.map((s) => [
		s.ItemName,
		{ content: s.Packing, styles: { halign: "center" } },
		{
			content: s.SaleQty > 0 ? String(s.SaleQty) : "-",
			styles: { halign: "right" },
		},
		{
			content: s.FreeQty > 0 ? String(s.FreeQty) : "-",
			styles: { halign: "right" },
		},
		{
			content: s.ActualFQty > 0 ? String(s.ActualFQty) : "-",
			styles: { halign: "right" },
		},
		{
			content: s.ClaimQty > 0 ? String(s.ClaimQty) : "-",
			styles: { halign: "right", fontStyle: "bold" },
		},
		{
			content: s.ClaimValue > 0 ? s.ClaimValue.toFixed(2) : "-",
			styles: {
				halign: "right",
				fontStyle: "bold",
				textColor: [30, 64, 175],
			},
		},
	]);

	summaryBody.push([
		{
			content: "Total :",
			colSpan: 2,
			styles: {
				fontStyle: "bold",
				halign: "right",
				fontSize: 7.5,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.6, bottom: 0.6 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: summaryTotals.SaleQty > 0 ? String(summaryTotals.SaleQty) : "-",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 7.5,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.6, bottom: 0.6 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: summaryTotals.FreeQty > 0 ? String(summaryTotals.FreeQty) : "-",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 7.5,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.6, bottom: 0.6 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content:
				summaryTotals.ActualFQty > 0 ? String(summaryTotals.ActualFQty) : "-",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 7.5,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.6, bottom: 0.6 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content:
				summaryTotals.ClaimQty > 0 ? String(summaryTotals.ClaimQty) : "-",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 7.5,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.6, bottom: 0.6 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content:
				summaryTotals.ClaimValue > 0
					? summaryTotals.ClaimValue.toFixed(2)
					: "-",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 7.5,
				fillColor: [243, 244, 246],
				textColor: [30, 64, 175],
				lineWidth: { top: 0.6, bottom: 0.6 },
				lineColor: [17, 24, 39],
			},
		},
	]);

	const finalY = (doc as any).lastAutoTable
		? (doc as any).lastAutoTable.finalY
		: startY;
	const pageHeight = doc.internal.pageSize.getHeight();
	const remainingHeight = pageHeight - finalY - 20;
	let summaryStartY = finalY + 12;
	if (remainingHeight < 55) {
		doc.addPage();
		summaryStartY = 20;
	}

	doc.setFont("helvetica", "bold");
	doc.setFontSize(8.5);
	doc.setTextColor(11, 37, 69);
	doc.text("Summary :", 14, summaryStartY - 3);

	autoTable(doc, {
		startY: summaryStartY,
		head: [
			[
				"ItemName",
				"Packing",
				"Sale Qty",
				"Free Qty",
				"Actual FQty",
				"Claim Qty",
				"Claim Value",
			],
		],
		body: summaryBody,
		theme: "plain",
		styles: {
			fontSize: 7,
			cellPadding: 1.2,
			textColor: [31, 41, 55],
			lineColor: [243, 244, 246],
			lineWidth: { bottom: 0.1 },
		},
		headStyles: {
			fillColor: [249, 250, 251],
			textColor: [17, 24, 39],
			fontStyle: "bold",
			fontSize: 7,
			halign: "right",
			lineWidth: { top: 0.6, bottom: 0.6 },
			lineColor: [17, 24, 39],
		},
		didParseCell: (hookData) => {
			if (hookData.section === "head") {
				if (hookData.column.index === 0) hookData.cell.styles.halign = "left";
				if (hookData.column.index === 1) hookData.cell.styles.halign = "center";
			}
		},
		columnStyles: {
			0: { cellWidth: 85, halign: "left" },
			1: { cellWidth: 26, halign: "center" },
			2: { cellWidth: 26, halign: "right" },
			3: { cellWidth: 26, halign: "right" },
			4: { cellWidth: 26, halign: "right" },
			5: { cellWidth: 26, halign: "right" },
			6: { cellWidth: 35, halign: "right" },
		},
		margin: { top: 14, left: 14, right: 14, bottom: 14 },
	});

	addFooterToAllPages(doc, mrName, serverTimeStr);
	if (action === "print") {
		doc.autoPrint();
		window.open(URL.createObjectURL(doc.output("blob")), "_blank");
	} else {
		doc.save(filename);
	}
}

// ---------------------------------------------------------------------------
// 3. PARTYWISE/ITEMWISE SALES PDF
// ---------------------------------------------------------------------------
export async function generatePartyWisePdfReport(
	filename: string,
	data: any[],
	mrName?: string,
	fromDate?: string,
	toDate?: string,
	action: "download" | "print" = "download",
	serverTimeStr?: string,
) {
	const logoDataUrl = await getLogoDataUrl();
	const doc = new jsPDF("landscape");

	if (data.length === 0) {
		doc.text("No party sales data available for the selected filters.", 14, 20);
		addFooterToAllPages(doc, mrName, serverTimeStr);
		if (action === "print") {
			doc.autoPrint();
			window.open(URL.createObjectURL(doc.output("blob")), "_blank");
		} else {
			doc.save(filename);
		}
		return;
	}

	interface CustomerPdfGroup {
		custId: any;
		custCode: string;
		customer: string;
		area: string;
		city: string;
		rows: any[];
		totalQty: number;
		totalFree: number;
		totalAmount: number;
	}

	const customerMap = new Map<string, CustomerPdfGroup>();

	for (const row of data) {
		const key = `${row.CustID || ""}_${row.Customer || "Unknown"}`;
		let group = customerMap.get(key);
		if (!group) {
			group = {
				custId: row.CustID,
				custCode: row.CustCode || "",
				customer: row.Customer || "Unknown Customer",
				area: row.Area || "",
				city: row.City || "",
				rows: [],
				totalQty: 0,
				totalFree: 0,
				totalAmount: 0,
			};
			customerMap.set(key, group);
		}

		group.rows.push(row);
		group.totalQty += Number(row.Qty || 0);
		group.totalFree += Number(row.FQty || row["Free Qty"] || 0);
		group.totalAmount += Number(row.Amount || row.Amt || 0);
	}

	const customerGroups = Array.from(customerMap.values());

	const startY = drawReportStationeryHeader(
		doc,
		logoDataUrl,
		"Partywise/Itemwise Sales",
		fromDate,
		toDate,
		`Total Parties: ${customerGroups.length}`,
	);

	let grandQty = 0;
	let grandFree = 0;
	let grandAmount = 0;

	const tableBody: any[] = [];

	customerGroups.forEach((group) => {
		grandQty += group.totalQty;
		grandFree += group.totalFree;
		grandAmount += group.totalAmount;

		// Customer Party Header Banner Row
		const custTitle = `${group.customer}${group.custCode ? ` [ ${group.custCode} ]` : ""}${group.area ? ` - ${group.area}` : ""}${group.city ? `, ${group.city}` : ""}`;
		tableBody.push([
			{
				content: custTitle,
				colSpan: 14,
				styles: {
					fillColor: [238, 246, 252],
					textColor: [0, 43, 102],
					fontStyle: "bold",
					fontSize: 8,
					lineWidth: { top: 0.3, bottom: 0.3 },
					lineColor: [184, 215, 245],
				},
			},
		]);

		// Items for this Customer
		group.rows.forEach((r, idx) => {
			tableBody.push([
				{ content: String(idx + 1), styles: { halign: "center" } },
				r.InvNo || "-",
				formatDisplayDate(r.InvDt) || "-",
				r.ItemCode || "-",
				r.ItemName || "-",
				r.Packing || "-",
				r.BatchNo || "-",
				formatExpDate(r.ExpDt) || "-",
				{
					content: String(r.Qty || 0),
					styles: { halign: "right", fontStyle: "bold" },
				},
				{
					content: r.FQty ? String(r.FQty) : "",
					styles: { halign: "right" },
				},
				{
					content: Number(r.Rate || r.Srate || 0).toFixed(2),
					styles: { halign: "right" },
				},
				{
					content: Number(r.Amount || r.Amt || 0).toFixed(2),
					styles: { halign: "right", fontStyle: "bold" },
				},
				r.Series || "",
				r.Remarks || "",
			]);
		});

		// Customer Subtotal Row
		tableBody.push([
			{
				content: `Total for ${group.customer}`,
				colSpan: 8,
				styles: {
					fillColor: [249, 250, 251],
					fontStyle: "bold",
					textColor: [17, 24, 39],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: String(group.totalQty),
				styles: {
					halign: "right",
					fontStyle: "bold",
					fillColor: [249, 250, 251],
					textColor: [30, 64, 175],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: group.totalFree ? String(group.totalFree) : "",
				styles: {
					halign: "right",
					fontStyle: "bold",
					fillColor: [249, 250, 251],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: "",
				styles: {
					fillColor: [249, 250, 251],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: group.totalAmount.toFixed(2),
				styles: {
					halign: "right",
					fontStyle: "bold",
					fillColor: [249, 250, 251],
					textColor: [30, 64, 175],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: "",
				colSpan: 2,
				styles: {
					fillColor: [249, 250, 251],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
		]);
	});

	// Grand Total Sales Row
	tableBody.push([
		{
			content: "Grand Total Sales :",
			colSpan: 8,
			styles: {
				fillColor: [243, 244, 246],
				fontStyle: "bold",
				fontSize: 8.5,
				textColor: [17, 24, 39],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: String(grandQty),
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8.5,
				fillColor: [243, 244, 246],
				textColor: [30, 64, 175],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandFree ? String(grandFree) : "",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8.5,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: "",
			styles: {
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandAmount.toFixed(2),
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8.5,
				fillColor: [243, 244, 246],
				textColor: [30, 64, 175],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: "",
			colSpan: 2,
			styles: {
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
	]);

	autoTable(doc, {
		startY,
		head: [
			[
				"SNo.",
				"InvNo",
				"InvDt",
				"ItemCode",
				"Item Name",
				"Packing",
				"BatchNo",
				"Exp.",
				"Qty.",
				"Free",
				"Rate",
				"Amount",
				"Series",
				"Remarks",
			],
		],
		body: tableBody,
		theme: "plain",
		styles: {
			fontSize: 7,
			cellPadding: 1.2,
			textColor: [31, 41, 55],
			lineColor: [243, 244, 246],
			lineWidth: { bottom: 0.1 },
		},
		headStyles: {
			fillColor: [249, 250, 251], // bg-gray-50
			textColor: [17, 24, 39], // text-gray-900
			fontStyle: "bold",
			fontSize: 7.5,
			halign: "left",
			lineWidth: { top: 0.6, bottom: 0.6 },
			lineColor: [17, 24, 39], // border-gray-900
		},
		columnStyles: {
			0: { cellWidth: 9, halign: "center" },
			1: { cellWidth: 16 },
			2: { cellWidth: 16 },
			3: { cellWidth: 16 },
			4: { cellWidth: 55 },
			5: { cellWidth: 15 },
			6: { cellWidth: 16 },
			7: { cellWidth: 14 },
			8: { cellWidth: 12, halign: "right" },
			9: { cellWidth: 11, halign: "right" },
			10: { cellWidth: 14, halign: "right" },
			11: { cellWidth: 18, halign: "right" },
			12: { cellWidth: 16 },
			13: { cellWidth: 16 },
		},
		margin: { top: 14, left: 14, right: 14, bottom: 14 },
	});

	addFooterToAllPages(doc, mrName, serverTimeStr);
	if (action === "print") {
		doc.autoPrint();
		window.open(URL.createObjectURL(doc.output("blob")), "_blank");
	} else {
		doc.save(filename);
	}
}

// ---------------------------------------------------------------------------
// 4. ITEMWISE/CUSTOMERWISE SALES PDF
// ---------------------------------------------------------------------------
export async function generateProductPdfReport(
	filename: string,
	data: any[],
	mrName?: string,
	fromDate?: string,
	toDate?: string,
	action: "download" | "print" = "download",
	serverTimeStr?: string,
) {
	const logoDataUrl = await getLogoDataUrl();
	const doc = new jsPDF("landscape");

	if (data.length === 0) {
		doc.text(
			"No product sales data available for the selected filters.",
			14,
			20,
		);
		addFooterToAllPages(doc, mrName, serverTimeStr);
		if (action === "print") {
			doc.autoPrint();
			window.open(URL.createObjectURL(doc.output("blob")), "_blank");
		} else {
			doc.save(filename);
		}
		return;
	}

	interface ProductPdfGroup {
		code: string;
		name: string;
		packing: string;
		rows: any[];
		totalQty: number;
		totalFree: number;
		totalAmount: number;
	}

	const productMap = new Map<string, ProductPdfGroup>();

	for (const row of data) {
		const key = `${row.ItemCode || ""}_${row.ItemName || "Unknown"}`;
		let group = productMap.get(key);
		if (!group) {
			group = {
				code: row.ItemCode || "",
				name: row.ItemName || row["Product Name"] || "Unknown Item",
				packing: row.Packing || "-",
				rows: [],
				totalQty: 0,
				totalFree: 0,
				totalAmount: 0,
			};
			productMap.set(key, group);
		}

		group.rows.push(row);
		group.totalQty += Number(row.Qty || 0);
		group.totalFree += Number(row.FQty || row["Free Qty"] || 0);
		group.totalAmount += Number(row.Amount || row.IAmt || 0);
	}

	const productGroups = Array.from(productMap.values());

	const startY = drawReportStationeryHeader(
		doc,
		logoDataUrl,
		"Itemwise/Customerwise Sales",
		fromDate,
		toDate,
		`Total Items: ${productGroups.length}`,
	);

	let grandSalesQty = 0;
	let grandSalesFree = 0;
	let grandSalesAmount = 0;

	const tableBody: any[] = [];

	productGroups.forEach((group) => {
		grandSalesQty += group.totalQty;
		grandSalesFree += group.totalFree;
		grandSalesAmount += group.totalAmount;

		// Product Item Header Banner Row
		tableBody.push([
			{
				content: `${group.name} [${group.code}] - Packing: ${group.packing}`,
				colSpan: 13,
				styles: {
					fillColor: [238, 246, 252],
					textColor: [0, 43, 102],
					fontStyle: "bold",
					fontSize: 8,
					lineWidth: { top: 0.3, bottom: 0.3 },
					lineColor: [184, 215, 245],
				},
			},
		]);

		// Transactions for this Product
		group.rows.forEach((r) => {
			tableBody.push([
				r.Customer || "Unknown Party",
				r.Address || r.City || "-",
				r.InvNo || "-",
				formatDisplayDate(r.InvDt) || "-",
				r.BatchNo || "-",
				formatExpDate(r.ExpDt) || "-",
				{
					content: Number(r.MRP || r.PTR || 0).toFixed(2),
					styles: { halign: "right" },
				},
				{
					content: Number(r.Rate || r.Srate || 0).toFixed(2),
					styles: { halign: "right" },
				},
				{
					content: String(r.Qty || 0),
					styles: {
						halign: "right",
						fontStyle: "bold",
						textColor: [29, 78, 216],
					},
				},
				{
					content: r.FQty ? String(r.FQty) : "",
					styles: { halign: "right" },
				},
				{
					content: Number(r.TaxableAmt || r.Amount || r.IAmt || 0).toFixed(2),
					styles: { halign: "right" },
				},
				{ content: "-", styles: { halign: "right" } },
				{
					content: Number(r.Amount || r.IAmt || 0).toFixed(2),
					styles: { halign: "right", fontStyle: "bold", textColor: [17, 24, 39] },
				},
			]);
		});

		// Product Subtotal Row
		tableBody.push([
			{
				content: `Total for ${group.name}`,
				colSpan: 8,
				styles: {
					fillColor: [249, 250, 251],
					fontStyle: "bold",
					textColor: [17, 24, 39],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: String(group.totalQty),
				styles: {
					halign: "right",
					fontStyle: "bold",
					fillColor: [249, 250, 251],
					textColor: [30, 64, 175],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{
				content: group.totalFree ? String(group.totalFree) : "",
				styles: {
					halign: "right",
					fontStyle: "bold",
					fillColor: [249, 250, 251],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{ content: "", colSpan: 2, styles: { fillColor: [249, 250, 251], lineWidth: { top: 0.4, bottom: 0.4 }, lineColor: [156, 163, 175] } },
			{
				content: group.totalAmount.toFixed(2),
				styles: {
					halign: "right",
					fontStyle: "bold",
					fillColor: [249, 250, 251],
					textColor: [30, 64, 175],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
		]);
	});

	// Grand Total Row
	tableBody.push([
		{
			content: "Grand Total Sales :",
			colSpan: 8,
			styles: {
				fillColor: [243, 244, 246],
				fontStyle: "bold",
				fontSize: 8.5,
				textColor: [17, 24, 39],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: String(grandSalesQty),
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8.5,
				fillColor: [243, 244, 246],
				textColor: [30, 64, 175],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{
			content: grandSalesFree ? String(grandSalesFree) : "",
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8.5,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{ content: "", colSpan: 2, styles: { fillColor: [243, 244, 246], lineWidth: { top: 0.8, bottom: 0.8 }, lineColor: [17, 24, 39] } },
		{
			content: grandSalesAmount.toFixed(2),
			styles: {
				halign: "right",
				fontStyle: "bold",
				fontSize: 8.5,
				fillColor: [243, 244, 246],
				textColor: [30, 64, 175],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
	]);

	autoTable(doc, {
		startY,
		head: [
			[
				"Party / City",
				"Address",
				"Doc No",
				"Date",
				"Batch",
				"Exp Dt",
				"PTR",
				"Rate",
				"Qty",
				"Free",
				"Taxable",
				"GST",
				"Amount",
			],
		],
		body: tableBody,
		theme: "plain",
		styles: {
			fontSize: 7,
			cellPadding: 1.2,
			textColor: [31, 41, 55],
			lineColor: [243, 244, 246],
			lineWidth: { bottom: 0.1 },
		},
		headStyles: {
			fillColor: [249, 250, 251], // bg-gray-50
			textColor: [17, 24, 39], // text-gray-900
			fontStyle: "bold",
			fontSize: 7.5,
			halign: "left",
			lineWidth: { top: 0.6, bottom: 0.6 },
			lineColor: [17, 24, 39], // border-gray-900
		},
		columnStyles: {
			0: { cellWidth: 50 },
			1: { cellWidth: 35 },
			2: { cellWidth: 18 },
			3: { cellWidth: 18 },
			4: { cellWidth: 18 },
			5: { cellWidth: 16 },
			6: { cellWidth: 16, halign: "right" },
			7: { cellWidth: 16, halign: "right" },
			8: { cellWidth: 14, halign: "right" },
			9: { cellWidth: 12, halign: "right" },
			10: { cellWidth: 18, halign: "right" },
			11: { cellWidth: 12, halign: "right" },
			12: { cellWidth: 20, halign: "right" },
		},
		margin: { top: 14, left: 14, right: 14, bottom: 14 },
	});

	addFooterToAllPages(doc, mrName, serverTimeStr);
	if (action === "print") {
		doc.autoPrint();
		window.open(URL.createObjectURL(doc.output("blob")), "_blank");
	} else {
		doc.save(filename);
	}
}

// ---------------------------------------------------------------------------
// 5. GROUPED PDF REPORT (OUTSTANDING & OVERDUE)
// ---------------------------------------------------------------------------
export async function generateGroupedPdfReport(
	title: string,
	filename: string,
	data: any[],
	columns: {
		header: string;
		dataKey: string;
		halign?: "left" | "center" | "right";
	}[],
	action: "download" | "print" = "download",
	mrName?: string,
	fromDate?: string,
	toDate?: string,
	serverTimeStr?: string,
) {
	const logoDataUrl = await getLogoDataUrl();
	const doc = new jsPDF("landscape");

	if (data.length === 0) {
		doc.text("No data available for the selected filters.", 14, 20);
		addFooterToAllPages(doc, mrName, serverTimeStr);
		if (action === "print") {
			doc.autoPrint();
			window.open(URL.createObjectURL(doc.output("blob")), "_blank");
		} else {
			doc.save(filename);
		}
		return;
	}

	const startY = drawReportStationeryHeader(
		doc,
		logoDataUrl,
		title,
		fromDate,
		toDate,
		`Total Records: ${data.length}`,
	);

	const manufacturers = [
		...new Set(data.map((item) => item.Manufacturer || "UNKNOWN")),
	].sort();

	const amountKey = columns.find(
		(c) =>
			c.dataKey.toLowerCase().includes("amount") ||
			c.dataKey.toLowerCase().includes("due") ||
			c.dataKey.toLowerCase().includes("balance"),
	)?.dataKey;
	const qtyKey = columns.find(
		(c) =>
			c.dataKey.toLowerCase().includes("qty") &&
			!c.dataKey.toLowerCase().includes("free"),
	)?.dataKey;

	const tableBody: any[] = [];
	let grandTotalAmount = 0;
	let grandTotalQty = 0;

	for (const mfg of manufacturers) {
		const mfgData = data.filter(
			(item) => (item.Manufacturer || "UNKNOWN") === mfg,
		);

		const compName = (
			mfgData[0]?.Company ||
			mfgData[0]?.CompCode ||
			mfg
		)
			.toString()
			.toUpperCase();
		const divName = (
			mfgData[0]?.Division ||
			mfg
		)
			.toString()
			.toUpperCase();

		let mfgAmount = 0;
		let mfgQty = 0;

		// Company Header Row Banner
		tableBody.push([
			{
				content: `Company:${compName} - ${divName}`,
				colSpan: columns.length,
				styles: {
					fillColor: [238, 246, 252],
					textColor: [0, 43, 102],
					fontStyle: "bold",
					fontSize: 8,
					lineWidth: { top: 0.3, bottom: 0.3 },
					lineColor: [184, 215, 245],
				},
			},
		]);

		mfgData.forEach((row) => {
			const rawAmt = amountKey ? row[amountKey] : 0;
			const cleanAmt =
				typeof rawAmt === "number"
					? isNaN(rawAmt)
						? 0
						: rawAmt
					: parseFloat(String(rawAmt || "0").replace(/[^0-9.-]/g, "")) || 0;

			const rawQty = qtyKey ? row[qtyKey] : 0;
			const cleanQty =
				typeof rawQty === "number"
					? isNaN(rawQty)
						? 0
						: rawQty
					: parseFloat(String(rawQty || "0").replace(/[^0-9.-]/g, "")) || 0;

			if (amountKey) mfgAmount += cleanAmt;
			if (qtyKey) mfgQty += cleanQty;

			const rowValues: any[] = [];
			columns.forEach((col) => {
				let val = row[col.dataKey] ?? "-";
				if (col.dataKey.toLowerCase().includes("date")) {
					val = formatDisplayDate(val) || val;
				} else if (col.dataKey === amountKey) {
					val = cleanAmt.toFixed(2);
				} else if (col.dataKey === qtyKey) {
					val = cleanQty.toString();
				}
				rowValues.push({
					content: String(val),
					styles: {
						halign: col.halign || "left",
						fontStyle: col.dataKey === amountKey ? "bold" : "normal",
					},
				});
			});
			tableBody.push(rowValues);
		});

		grandTotalAmount += mfgAmount;
		grandTotalQty += mfgQty;

		// Subtotal for this Company
		if (amountKey || qtyKey) {
			const subtotalRow: any[] = [];
			columns.forEach((col, i) => {
				if (i === 0) {
					subtotalRow.push({
						content: `Total for ${mfg.toUpperCase()} :`,
						styles: {
							fontStyle: "bold",
							fillColor: [249, 250, 251],
							textColor: [17, 24, 39],
							lineWidth: { top: 0.4, bottom: 0.4 },
							lineColor: [156, 163, 175],
						},
					});
				} else if (col.dataKey === amountKey) {
					subtotalRow.push({
						content: mfgAmount.toFixed(2),
						styles: {
							halign: "right",
							fontStyle: "bold",
							fillColor: [249, 250, 251],
							textColor: [30, 64, 175],
							lineWidth: { top: 0.4, bottom: 0.4 },
							lineColor: [156, 163, 175],
						},
					});
				} else if (col.dataKey === qtyKey) {
					subtotalRow.push({
						content: mfgQty.toString(),
						styles: {
							halign: "right",
							fontStyle: "bold",
							fillColor: [249, 250, 251],
							textColor: [30, 64, 175],
							lineWidth: { top: 0.4, bottom: 0.4 },
							lineColor: [156, 163, 175],
						},
					});
				} else {
					subtotalRow.push({
						content: "",
						styles: {
							fillColor: [249, 250, 251],
							lineWidth: { top: 0.4, bottom: 0.4 },
							lineColor: [156, 163, 175],
						},
					});
				}
			});
			tableBody.push(subtotalRow);
		}
	}

	// Grand Total Row
	if (amountKey || qtyKey) {
		const grandTotalRow: any[] = [];
		columns.forEach((col, i) => {
			if (i === 0) {
				grandTotalRow.push({
					content: "Grand Total :",
					styles: {
						fontStyle: "bold",
						fontSize: 8.5,
						fillColor: [243, 244, 246],
						textColor: [17, 24, 39],
						lineWidth: { top: 0.8, bottom: 0.8 },
						lineColor: [17, 24, 39],
					},
				});
			} else if (col.dataKey === amountKey) {
				grandTotalRow.push({
					content: grandTotalAmount.toFixed(2),
					styles: {
						halign: "right",
						fontStyle: "bold",
						fontSize: 8.5,
						fillColor: [243, 244, 246],
						textColor: [30, 64, 175],
						lineWidth: { top: 0.8, bottom: 0.8 },
						lineColor: [17, 24, 39],
					},
				});
			} else if (col.dataKey === qtyKey) {
				grandTotalRow.push({
					content: grandTotalQty.toString(),
					styles: {
						halign: "right",
						fontStyle: "bold",
						fontSize: 8.5,
						fillColor: [243, 244, 246],
						textColor: [30, 64, 175],
						lineWidth: { top: 0.8, bottom: 0.8 },
						lineColor: [17, 24, 39],
					},
				});
			} else {
				grandTotalRow.push({
					content: "",
					styles: {
						fillColor: [243, 244, 246],
						lineWidth: { top: 0.8, bottom: 0.8 },
						lineColor: [17, 24, 39],
					},
				});
			}
		});
		tableBody.push(grandTotalRow);
	}

	autoTable(doc, {
		startY,
		head: [columns.map((c) => c.header)],
		body: tableBody,
		theme: "plain",
		styles: {
			fontSize: 7.5,
			cellPadding: 1.2,
			textColor: [31, 41, 55],
			lineColor: [243, 244, 246],
			lineWidth: { bottom: 0.1 },
		},
		headStyles: {
			fillColor: [249, 250, 251], // bg-gray-50
			textColor: [17, 24, 39], // text-gray-900
			fontStyle: "bold",
			fontSize: 7.5,
			lineWidth: { top: 0.6, bottom: 0.6 },
			lineColor: [17, 24, 39], // border-gray-900
		},
		didParseCell: (hookData) => {
			if (hookData.section === "head") {
				const col = columns[hookData.column.index];
				if (col && col.halign) {
					hookData.cell.styles.halign = col.halign;
				}
			}
		},
		margin: { top: 14, left: 14, right: 14, bottom: 14 },
	});

	addFooterToAllPages(doc, mrName, serverTimeStr);
	if (action === "print") {
		doc.autoPrint();
		window.open(URL.createObjectURL(doc.output("blob")), "_blank");
	} else {
		doc.save(filename);
	}
}

// ---------------------------------------------------------------------------
// 6. SALES PDF REPORT (BACKWARDS COMPATIBILITY)
// ---------------------------------------------------------------------------
export async function generateSalesPdfReport(
	filename: string,
	data: any[],
	mrName?: string,
	fromDate?: string,
	toDate?: string,
	action: "download" | "print" = "download",
	serverTimeStr?: string,
) {
	// Delegate directly to generatePartyWisePdfReport for identical crisp stationery layout
	return generatePartyWisePdfReport(
		filename,
		data,
		mrName,
		fromDate,
		toDate,
		action,
		serverTimeStr,
	);
}

// ---------------------------------------------------------------------------
// 7. GENERIC PDF REPORT (BACKWARDS COMPATIBILITY)
// ---------------------------------------------------------------------------
export async function generatePdfReport(
	title: string,
	filename: string,
	data: any[],
	mrName?: string,
	action: "download" | "print" = "download",
	serverTimeStr?: string,
) {
	const columns = [
		{ header: "Party / Item", dataKey: "Customer" },
		{ header: "Doc No", dataKey: "InvNo" },
		{ header: "Date", dataKey: "InvDt" },
		{ header: "Qty", dataKey: "Qty", halign: "right" as const },
		{ header: "Amount", dataKey: "Amount", halign: "right" as const },
	];
	return generateGroupedPdfReport(
		title,
		filename,
		data,
		columns,
		action,
		mrName,
		undefined,
		undefined,
		serverTimeStr,
	);
}

// ---------------------------------------------------------------------------
// 8. STOCK & SALES STATEMENT PDF REPORT
// ---------------------------------------------------------------------------
export async function generateStockAndSalesPdfReport(
	filename: string,
	data: any[],
	mrName?: string,
	fromDate?: string,
	toDate?: string,
	action: "download" | "print" = "download",
	serverTimeStr?: string,
) {
	const logoDataUrl = await getLogoDataUrl();
	const doc = new jsPDF("landscape");

	const activeData = data.filter((row) => {
		const op = Number(row["Opening Qty."] ?? row["Opening Qty"] ?? row["Opening"] ?? 0);
		const pur = Number(row["Purchase Qty"] ?? row["Purchase"] ?? 0);
		const sale = Number(row["Sales Qty."] ?? row["Sales Qty"] ?? row["Sales"] ?? 0);
		const free = Number(row["Free Qty"] ?? row["Free"] ?? 0);
		const sRet = Number(row["S.Ret Qty."] ?? row["SReturn"] ?? 0);
		const closing = Number(row["Closing Qty"] ?? row["Balance Qty."] ?? row["Qty"] ?? 0);
		return op !== 0 || pur !== 0 || sale !== 0 || free !== 0 || sRet !== 0 || closing !== 0;
	});

	if (activeData.length === 0) {
		doc.text(
			"No active stock & sales records found for the selected period.",
			14,
			20,
		);
		addFooterToAllPages(doc, mrName, serverTimeStr);
		if (action === "print") {
			doc.autoPrint();
			window.open(URL.createObjectURL(doc.output("blob")), "_blank");
		} else {
			doc.save(filename);
		}
		return;
	}

	const sizeCheck = validatePdfDatasetSize(activeData.length);
	const renderData = sizeCheck.safe ? activeData : activeData.slice(0, PDF_SAFE_ROW_LIMIT);

	const summaryRight = sizeCheck.safe
		? `Total Items: ${activeData.length}\nRate Basis: PTR / Rate`
		: `Total Items: ${activeData.length} (Capped to ${PDF_SAFE_ROW_LIMIT})\nRate Basis: PTR / Rate`;

	const startY = drawReportStationeryHeader(
		doc,
		logoDataUrl,
		"Stock & Sales Statement Report",
		fromDate,
		toDate,
		summaryRight,
	);

	const divisions = [
		...new Set(
			renderData.map((item) =>
				(item.Division || item.Manufacturer || "General").toString().trim(),
			),
		),
	].sort();

	const tableBody: any[] = [];
	let grandTotalOpening = 0;
	let grandTotalPur = 0;
	let grandTotalSale = 0;
	let grandTotalFree = 0;
	let grandTotalSRet = 0;
	let grandTotalClosing = 0;
	let grandTotalSaleVal = 0;
	let grandTotalClosingVal = 0;

	for (const div of divisions) {
		const divData = renderData
			.filter(
				(item) =>
					(item.Division || item.Manufacturer || "General")
						.toString()
						.trim() === div,
			)
			.sort((a, b) =>
				(a["Item Name"] || a["Product Name"] || "").localeCompare(
					b["Item Name"] || b["Product Name"] || "",
				),
			);

		let divOpening = 0;
		let divPur = 0;
		let divSale = 0;
		let divFree = 0;
		let divSRet = 0;
		let divClosing = 0;
		let divSaleVal = 0;
		let divClosingVal = 0;

		const compName = (
			divData[0]?.Manufacturer ||
			divData[0]?.Company ||
			div
		)
			.toString()
			.toUpperCase();
		const divName = div.toUpperCase();

		// Division Header Banner Row
		tableBody.push([
			{
				content: `Company: ${compName} - ${divName}`,
				colSpan: 11,
				styles: {
					fillColor: [238, 246, 252],
					textColor: [0, 43, 102],
					fontStyle: "bold",
					fontSize: 8,
					lineWidth: { top: 0.3, bottom: 0.3 },
					lineColor: [184, 215, 245],
				},
			},
		]);

		divData.forEach((row) => {
			const itemName = row["Item Name"] || row["Product Name"] || "-";
			const packing = row["Packing"] || "-";
			const opening = Number(row["Opening Qty."] ?? row["Opening Qty"] ?? 0);
			const pur = Number(row["Purchase Qty"] ?? row["Inward"] ?? 0);
			const sale = Number(row["Sales Qty."] ?? row["Sales Qty"] ?? 0);
			const free = Number(row["Free Qty"] ?? 0);
			const sRet = Number(row["S.Ret Qty."] ?? 0);
			const closing = Number(row["Closing Qty"] ?? row["Balance Qty."] ?? 0);
			const ptr = Number(row["ptr"] ?? row["PTR"] ?? 0);
			const saleVal = Number(row["Sales Value"] ?? row["SaleVal"] ?? sale * ptr);
			const closingVal = Number(row["Stock Value"] ?? row["Closing Value"] ?? row["BalVal"] ?? closing * ptr);

			divOpening += opening;
			divPur += pur;
			divSale += sale;
			divFree += free;
			divSRet += sRet;
			divClosing += closing;
			divSaleVal += saleVal;
			divClosingVal += closingVal;

			grandTotalOpening += opening;
			grandTotalPur += pur;
			grandTotalSale += sale;
			grandTotalFree += free;
			grandTotalSRet += sRet;
			grandTotalClosing += closing;
			grandTotalSaleVal += saleVal;
			grandTotalClosingVal += closingVal;

			tableBody.push([
				{ content: itemName, styles: { halign: "left" } },
				{ content: packing, styles: { halign: "center" } },
				{ content: opening !== 0 ? String(opening) : "-", styles: { halign: "right" } },
				{ content: pur !== 0 ? String(pur) : "-", styles: { halign: "right" } },
				{ content: sale !== 0 ? String(sale) : "-", styles: { halign: "right" } },
				{ content: free !== 0 ? String(free) : "-", styles: { halign: "right" } },
				{ content: sRet !== 0 ? String(sRet) : "-", styles: { halign: "right" } },
				{ content: closing !== 0 ? String(closing) : "-", styles: { halign: "right", fontStyle: "bold" } },
				{ content: ptr !== 0 ? ptr.toFixed(2) : "-", styles: { halign: "right" } },
				{ content: saleVal !== 0 ? saleVal.toFixed(2) : "-", styles: { halign: "right" } },
				{ content: closingVal !== 0 ? closingVal.toFixed(2) : "-", styles: { halign: "right" } },
			]);
		});

		// Division Subtotal Row
		tableBody.push([
			{
				content: `Sub Total (${divName}) :`,
				colSpan: 2,
				styles: {
					fontStyle: "bold",
					fillColor: [249, 250, 251],
					lineWidth: { top: 0.4, bottom: 0.4 },
					lineColor: [156, 163, 175],
				},
			},
			{ content: String(divOpening), styles: { halign: "right", fontStyle: "bold", fillColor: [249, 250, 251] } },
			{ content: String(divPur), styles: { halign: "right", fontStyle: "bold", fillColor: [249, 250, 251] } },
			{ content: String(divSale), styles: { halign: "right", fontStyle: "bold", fillColor: [249, 250, 251] } },
			{ content: String(divFree), styles: { halign: "right", fontStyle: "bold", fillColor: [249, 250, 251] } },
			{ content: String(divSRet), styles: { halign: "right", fontStyle: "bold", fillColor: [249, 250, 251] } },
			{ content: String(divClosing), styles: { halign: "right", fontStyle: "bold", fillColor: [249, 250, 251] } },
			{ content: "", styles: { fillColor: [249, 250, 251] } },
			{ content: divSaleVal.toFixed(2), styles: { halign: "right", fontStyle: "bold", fillColor: [249, 250, 251], textColor: [30, 64, 175] } },
			{ content: divClosingVal.toFixed(2), styles: { halign: "right", fontStyle: "bold", fillColor: [249, 250, 251], textColor: [30, 64, 175] } },
		]);
	}

	// Grand Total Row
	tableBody.push([
		{
			content: "Grand Total :",
			colSpan: 2,
			styles: {
				fontStyle: "bold",
				fontSize: 8.5,
				fillColor: [243, 244, 246],
				lineWidth: { top: 0.8, bottom: 0.8 },
				lineColor: [17, 24, 39],
			},
		},
		{ content: String(grandTotalOpening), styles: { halign: "right", fontStyle: "bold", fontSize: 8.5, fillColor: [243, 244, 246] } },
		{ content: String(grandTotalPur), styles: { halign: "right", fontStyle: "bold", fontSize: 8.5, fillColor: [243, 244, 246] } },
		{ content: String(grandTotalSale), styles: { halign: "right", fontStyle: "bold", fontSize: 8.5, fillColor: [243, 244, 246] } },
		{ content: String(grandTotalFree), styles: { halign: "right", fontStyle: "bold", fontSize: 8.5, fillColor: [243, 244, 246] } },
		{ content: String(grandTotalSRet), styles: { halign: "right", fontStyle: "bold", fontSize: 8.5, fillColor: [243, 244, 246] } },
		{ content: String(grandTotalClosing), styles: { halign: "right", fontStyle: "bold", fontSize: 8.5, fillColor: [243, 244, 246] } },
		{ content: "", styles: { fillColor: [243, 244, 246] } },
		{ content: grandTotalSaleVal.toFixed(2), styles: { halign: "right", fontStyle: "bold", fontSize: 8.5, fillColor: [243, 244, 246], textColor: [30, 64, 175] } },
		{ content: grandTotalClosingVal.toFixed(2), styles: { halign: "right", fontStyle: "bold", fontSize: 8.5, fillColor: [243, 244, 246], textColor: [30, 64, 175] } },
	]);

	autoTable(doc, {
		startY,
		head: [
			[
				"Item Name",
				"Packing",
				"Opening\nQty",
				"Inward\nPur",
				"Sales\nQty",
				"Free\nQty",
				"S.Ret\nQty",
				"Closing\nQty",
				"PTR\n(₹)",
				"Sales Val\n(₹)",
				"Closing Val\n(₹)",
			],
		],
		body: tableBody,
		theme: "plain",
		styles: {
			fontSize: 7.5,
			cellPadding: 1.2,
			textColor: [31, 41, 55],
		},
		headStyles: {
			fillColor: [11, 37, 69],
			textColor: [255, 255, 255],
			fontStyle: "bold",
			halign: "center",
			fontSize: 7.5,
			lineWidth: 0.1,
			lineColor: [209, 213, 219],
		},
		columnStyles: {
			0: { cellWidth: 55 },
			1: { cellWidth: 20 },
			2: { cellWidth: 20 },
			3: { cellWidth: 20 },
			4: { cellWidth: 20 },
			5: { cellWidth: 18 },
			6: { cellWidth: 18 },
			7: { cellWidth: 22 },
			8: { cellWidth: 22 },
			9: { cellWidth: 28 },
			10: { cellWidth: 28 },
		},
		margin: { left: 10, right: 10, bottom: 15 },
		pageBreak: "auto",
		didDrawPage: () => {
			addFooterToAllPages(doc, mrName, serverTimeStr);
		},
	});

	if (action === "print") {
		doc.autoPrint();
		window.open(URL.createObjectURL(doc.output("blob")), "_blank");
	} else {
		doc.save(filename);
	}
}
