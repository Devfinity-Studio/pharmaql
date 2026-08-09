const fs = require("fs");
let c = fs.readFileSync("migrate-sql.ts", "utf8");

c = c.replace(
	/async function migrateSql\(\) \{\s*const filePath = path\.join\(process\.cwd\(\), "demo data", "APBARODA_1\.sql"\);\s*console\.log\(`Starting migration from \$\{filePath\}`\);\s*if \(!fs\.existsSync\(filePath\)\) \{\s*console\.error\(`File not found: \$\{filePath\}`\);\s*process\.exit\(1\);\s*\}/,
	`async function migrateSql() {
	const files = ["demo data/APBARODA-APRIL2026.sql", "demo data/APBARODA-MAY2026.sql", "demo data/APBARODA-JUNE2026.sql", "demo data/APBARODA-JULY2026.sql", "demo data/APBARODA-AUG2026.sql", "demo data/APBARODA-SEP2026.sql", "demo data/APBARODA-OCT2026.sql"];
	let blocksProcessed = 0;
	const mrMap = new Map();

	for (const file of files) {
		const filePath = path.join(process.cwd(), file);
		console.log(\`Starting migration from $\{filePath}\`);
		if (!fs.existsSync(filePath)) {
			console.log(\`File not found: $\{filePath}\`);
			continue;
		}`,
);

// We need to also remove the existing `let blocksProcessed = 0;` and `const mrMap = new Map<string, string>();`
c = c.replace(
	/let blocksProcessed = 0;\s*\/\/\s*Mapping[^\n]*\n\s*const mrMap = new Map<string, string>\(\);/m,
	"",
);

c = c.replace(
	/productsBatch = \[\];\s*usersBatch = \[\];\s*mfgBatch = \[\];\s*inventoryBatch = \[\];\s*salesBatch = \[\];\s*invoicesBatch = \[\];\s*outstandingBatch = \[\];\s*\}\s*\}\s*\}/m,
	`productsBatch = [];
				usersBatch = [];
				mfgBatch = [];
				inventoryBatch = [];
				salesBatch = [];
				invoicesBatch = [];
				outstandingBatch = [];
			}
		}
	}`,
);

fs.writeFileSync("migrate-sql.ts", c);
