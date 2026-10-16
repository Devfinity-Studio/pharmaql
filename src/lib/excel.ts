import ExcelJS from "exceljs";

export interface ExcelColumnDef {
	header: string;
	key: string;
	width?: number;
	numFmt?: string;
	alignment?: Partial<ExcelJS.Alignment>;
}

export async function buildStyledExcelBuffer(options: {
	sheetName: string;
	title: string;
	subtitle?: string;
	columns: ExcelColumnDef[];
	data: Record<string, any>[];
	totals?: Record<string, any>;
	metadata?: {
		mrName?: string;
		company?: string;
		division?: string;
		period?: string;
		year?: string;
	};
}): Promise<Buffer> {
	const {
		sheetName,
		title,
		subtitle,
		columns,
		data,
		totals,
		metadata,
	} = options;

	const workbook = new ExcelJS.Workbook();
	workbook.creator = "Asmee Pharma - PharmaQL";
	workbook.created = new Date();

	const worksheet = workbook.addWorksheet(sheetName, {
		views: [{ showGridLines: true }],
	});

	let rowIndex = 1;

	// 1. Company Letterhead
	const companyRow = worksheet.getRow(rowIndex++);
	companyRow.getCell(1).value = "ASMEE PHARMA PRIVATE LIMITED";
	companyRow.getCell(1).font = { name: "Calibri", size: 14, bold: true, color: { argb: "0B2545" } };

	const addressRow = worksheet.getRow(rowIndex++);
	addressRow.getCell(1).value =
		"BASEMENT-GF, 11/2 ASHOK HOUSE, B/S SANSTHA VASAHAT GATE, PRATAP ROAD, RAOPURA, VADODARA - 390001";
	addressRow.getCell(1).font = { name: "Calibri", size: 9, italic: true, color: { argb: "555555" } };

	const contactRow = worksheet.getRow(rowIndex++);
	contactRow.getCell(1).value =
		"Contact: 9409789800, 9409789700 | Email: asmeepharma2022@gmail.com";
	contactRow.getCell(1).font = { name: "Calibri", size: 9, italic: true, color: { argb: "555555" } };

	rowIndex++; // blank separator

	// 2. Report Title & Metadata Banner
	const titleRow = worksheet.getRow(rowIndex++);
	titleRow.getCell(1).value = title.toUpperCase();
	titleRow.getCell(1).font = { name: "Calibri", size: 12, bold: true, color: { argb: "0071BC" } };

	if (subtitle || metadata) {
		const metaRow = worksheet.getRow(rowIndex++);
		const parts: string[] = [];
		if (metadata?.year) parts.push(`Year: ${metadata.year}`);
		if (metadata?.period) parts.push(`Period: ${metadata.period}`);
		if (metadata?.division) {
			const comp = metadata.company || metadata.division;
			parts.push(`Company:${comp} - ${metadata.division}`);
		}
		if (metadata?.mrName) parts.push(`MR: ${metadata.mrName}`);
		if (subtitle) parts.push(subtitle);

		metaRow.getCell(1).value = parts.join("  |  ");
		metaRow.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: "333333" } };
	}

	rowIndex++; // blank row before table

	// 3. Table Column Headers
	const headerRowIndex = rowIndex++;
	const headerRow = worksheet.getRow(headerRowIndex);
	headerRow.height = 24;

	columns.forEach((col, idx) => {
		const cell = headerRow.getCell(idx + 1);
		cell.value = col.header;
		cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFF" } };
		cell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "0B2545" }, // Navy blue header
		};
		cell.alignment = {
			vertical: "middle",
			horizontal: col.alignment?.horizontal || "left",
			wrapText: true,
		};
		cell.border = {
			top: { style: "thin", color: { argb: "0B2545" } },
			bottom: { style: "medium", color: { argb: "0B2545" } },
			left: { style: "thin", color: { argb: "334155" } },
			right: { style: "thin", color: { argb: "334155" } },
		};
	});

	// 4. Data Rows
	data.forEach((item, rowIdx) => {
		const row = worksheet.getRow(rowIndex++);
		row.height = 19;
		const isAlt = rowIdx % 2 === 1;

		columns.forEach((col, colIdx) => {
			const cell = row.getCell(colIdx + 1);
			const rawVal = item[col.key];
			cell.value = rawVal !== undefined && rawVal !== null ? rawVal : "";
			cell.font = { name: "Calibri", size: 10, color: { argb: "1F2937" } };

			if (col.numFmt) {
				cell.numFmt = col.numFmt;
			}

			cell.alignment = {
				vertical: "middle",
				horizontal: col.alignment?.horizontal || (typeof rawVal === "number" ? "right" : "left"),
			};

			cell.fill = {
				type: "pattern",
				pattern: "solid",
				fgColor: { argb: isAlt ? "F8FAFC" : "FFFFFF" },
			};

			cell.border = {
				top: { style: "thin", color: { argb: "E2E8F0" } },
				bottom: { style: "thin", color: { argb: "E2E8F0" } },
				left: { style: "thin", color: { argb: "E2E8F0" } },
				right: { style: "thin", color: { argb: "E2E8F0" } },
			};
		});
	});

	// 5. Total Summary Row (if provided)
	if (totals) {
		const totalRow = worksheet.getRow(rowIndex++);
		totalRow.height = 22;

		columns.forEach((col, colIdx) => {
			const cell = totalRow.getCell(colIdx + 1);
			const val = totals[col.key];
			cell.value = val !== undefined && val !== null ? val : "";
			cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "0B2545" } };

			if (col.numFmt) {
				cell.numFmt = col.numFmt;
			}

			cell.alignment = {
				vertical: "middle",
				horizontal: col.alignment?.horizontal || (typeof val === "number" ? "right" : "left"),
			};

			cell.fill = {
				type: "pattern",
				pattern: "solid",
				fgColor: { argb: "E0F2FE" }, // Soft blue highlight
			};

			cell.border = {
				top: { style: "medium", color: { argb: "0B2545" } },
				bottom: { style: "double", color: { argb: "0B2545" } },
				left: { style: "thin", color: { argb: "BAE6FD" } },
				right: { style: "thin", color: { argb: "BAE6FD" } },
			};
		});
	}

	// 6. Dynamic Column Widths Calculation (Never squished)
	columns.forEach((col, idx) => {
		const colNum = idx + 1;
		let maxLen = col.header.length;

		data.forEach((row) => {
			const cellVal = String(row[col.key] ?? "");
			if (cellVal.length > maxLen) {
				maxLen = cellVal.length;
			}
		});

		if (totals && totals[col.key]) {
			const totVal = String(totals[col.key] ?? "");
			if (totVal.length > maxLen) maxLen = totVal.length;
		}

		worksheet.getColumn(colNum).width = Math.min(Math.max(col.width || (maxLen + 3), 11), 50);
	});

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}
