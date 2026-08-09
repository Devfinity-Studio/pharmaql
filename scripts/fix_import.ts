import fs from "fs";

let content = fs.readFileSync("import-all-demo.ts", "utf8");

// Change mrMap to hold arrays
content = content.replace(
	/const mrMap = new Map<string, string>\(\);/g,
	"const mrMap = new Map<string, string[]>();",
);

content = content.replace(
	/if \(!mrMap\.has\(spec\.locCodeKey\)\) {\s*mrMap\.set\(spec\.locCodeKey, userId\);\s*}/g,
	"if (!mrMap.has(spec.locCodeKey)) mrMap.set(spec.locCodeKey, []);\n\t\tmrMap.get(spec.locCodeKey)!.push(userId);",
);

content = content.replace(
	/mrMap\.set\(key, userId\);/g,
	"mrMap.set(key, [userId]);",
);

// Update mfgInsertBatch manufacturer mapping to spec.code
content = content.replace(
	/manufacturer: div\.company \|\| "Unknown",/g,
	'manufacturer: spec.code || "Unknown",',
);

// Fix t_dailyss insertion to loop over mrIds
content = content.replace(
	/const mappedMrId = mrMap\.get\(`\$\{locNo\.trim\(\)\}-\$\{code\.trim\(\)\}`\);\s*if \(mappedMrId && itemid\) {/g,
	"const mappedMrIds = mrMap.get(`${locNo.trim()}-${code.trim()}`);\n\t\t\t\t\t\tif (mappedMrIds && itemid) {\n\t\t\t\t\t\t\tfor (const mappedMrId of mappedMrIds) {",
);
content = content.replace(
	/prate: parseFloat\(prate \|\| "0"\),\n\t\t\t\t\t\t\t\}\);\n\t\t\t\t\t\t\}/g,
	'prate: parseFloat(prate || "0"),\n\t\t\t\t\t\t\t});\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}',
);

// Fix view_stocks insertion to loop over mrIds
content = content.replace(
	/const mappedMrId = mrMap\.get\(`\$\{locNo \|\| "11"\}-\$\{salesmanid \|\| "MR"\}`\);\s*if \(mappedMrId && itemId\) {/g,
	'const mappedMrIds = mrMap.get(`${locNo || "11"}-${salesmanid || "MR"}`);\n\t\t\t\t\tif (mappedMrIds && itemId) {\n\t\t\t\t\t\tfor (const mappedMrId of mappedMrIds) {',
);
content = content.replace(
	/prate: parseFloat\(prate \|\| "0"\),\n\t\t\t\t\t\t\}\);\n\t\t\t\t\t}/g,
	'prate: parseFloat(prate || "0"),\n\t\t\t\t\t\t});\n\t\t\t\t\t\t}\n\t\t\t\t\t}',
);

// Fix t_item_sales insertion to loop over mrIds
content = content.replace(
	/const mappedMrId = mrMap\.get\(`\$\{locNo\.trim\(\)\}-\$\{code\.trim\(\)\}`\);\s*if \(mappedMrId && itemId\) {/g,
	"const mappedMrIds = mrMap.get(`${locNo.trim()}-${code.trim()}`);\n\t\t\t\t\t\tif (mappedMrIds && itemId) {\n\t\t\t\t\t\t\tfor (const mappedMrId of mappedMrIds) {",
);
content = content.replace(
	/amount: parseFloat\(amount \|\| "0"\),\n\t\t\t\t\t\t\t\}\);\n\t\t\t\t\t\t\}/g,
	'amount: parseFloat(amount || "0"),\n\t\t\t\t\t\t\t});\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}',
);

fs.writeFileSync("import-all-demo.ts", content);
