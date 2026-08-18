const fs = require("fs");

function fixFile(file) {
	let code = fs.readFileSync(file, "utf8");

	// Add format 'print' to type
	code = code.replace(
		/<"csv" \| "excel" \| "pdf">/,
		'<"csv" | "excel" | "pdf" | "print">',
	);
	code = code.replace(
		/\(fmt: "csv" \| "excel" \| "pdf"\)/,
		'(fmt: "csv" | "excel" | "pdf" | "print")',
	);

	// Change if (format === 'pdf') to if (format === 'pdf' || format === 'print')
	code = code.replace(
		/if \(format === "pdf"\) \{/,
		'if (format === "pdf" || format === "print") {',
	);

	// Update generate function calls to pass format === 'print' ? 'print' : 'download'
	code = code.replace(
		/generateStockPdfReport\([\s\S]*?displayTo,\s*\);/g,
		(match) =>
			match.replace(
				"displayTo,",
				'displayTo, format === "print" ? "print" : "download",',
			),
	);
	code = code.replace(
		/generateSalesPdfReport\([\s\S]*?displayTo,\s*\);/g,
		(match) =>
			match.replace(
				"displayTo,",
				'displayTo, format === "print" ? "print" : "download",',
			),
	);
	code = code.replace(
		/generateFreeSchemePdfReport\([\s\S]*?displayTo,\s*\);/g,
		(match) =>
			match.replace(
				"displayTo,",
				'displayTo, format === "print" ? "print" : "download",',
			),
	);
	code = code.replace(/generateGroupedPdfReport\([\s\S]*?\]\s*\);/g, (match) =>
		match.replace("]", '], format === "print" ? "print" : "download"'),
	);

	// Add Print button UI
	if (!code.includes('openModal("print")')) {
		const pdfBtnRegex =
			/<button[\s\S]*?onClick=\{\(\) => openModal\("pdf"\)\}[\s\S]*?PDF\s*<\/button>/;
		const match = code.match(pdfBtnRegex);
		if (match) {
			const printBtn = match[0]
				.replace('openModal("pdf")', 'openModal("print")')
				.replace("Download Product Report (PDF)", "Print Report")
				.replace("PDF", "Print")
				.replace("bg-[#0B2545]", "bg-[#1e293b]")
				.replace("hover:bg-[#1E293B]", "hover:bg-[#334155]");
			code = code.replace(match[0], match[0] + "\n\n\t\t\t\t" + printBtn);
		}
	}

	fs.writeFileSync(file, code);
}

fixFile("src/components/report-download-buttons.tsx");
fixFile("src/components/outstanding-download-buttons.tsx");
