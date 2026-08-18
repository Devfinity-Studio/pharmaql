const fs = require("fs");
let code = fs.readFileSync("src/lib/pdf.ts", "utf8");

// Replace doc.save
code = code.replace(
	/doc\.save\(filename\);/g,
	'if (action === "print") { doc.autoPrint(); window.open(URL.createObjectURL(doc.output("blob")), "_blank"); } else { doc.save(filename); }',
);

// Add action parameter to functions
code = code.replace(
	/export function generatePdfReport\([\s\S]*?mrName\?: string,\s*\) \{/,
	(match) =>
		match.replace(
			"mrName?: string,",
			'mrName?: string, action: "download" | "print" = "download",',
		),
);

code = code.replace(
	/export function generateStockPdfReport\([\s\S]*?toDate\?: string,\s*\) \{/,
	(match) =>
		match.replace(
			"toDate?: string,",
			'toDate?: string, action: "download" | "print" = "download",',
		),
);

code = code.replace(
	/export function generateGroupedPdfReport\([\s\S]*?halign\?: "left" \| "center" \| "right";\s*\}\[\],\s*\) \{/,
	(match) =>
		match.replace("}[],", '}[], action: "download" | "print" = "download",'),
);

code = code.replace(
	/export function generateSalesPdfReport\([\s\S]*?toDate\?: string,\s*\) \{/,
	(match) =>
		match.replace(
			"toDate?: string,",
			'toDate?: string, action: "download" | "print" = "download",',
		),
);

code = code.replace(
	/export function generateFreeSchemePdfReport\([\s\S]*?toDate\?: string,\s*\) \{/,
	(match) =>
		match.replace(
			"toDate?: string,",
			'toDate?: string, action: "download" | "print" = "download",',
		),
);

fs.writeFileSync("src/lib/pdf.ts", code);
