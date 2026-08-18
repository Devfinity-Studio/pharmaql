const fs = require("fs");
let code = fs.readFileSync("src/lib/pdf.ts", "utf8");

code = code.replace(
	/halign\?: "left" \| "center" \| "right";\s*\}\[\],/,
	(match) =>
		match.replace("}[],", '}[], action: "download" | "print" = "download",'),
);

fs.writeFileSync("src/lib/pdf.ts", code);
