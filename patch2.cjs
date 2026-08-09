const fs = require("fs");
let c = fs.readFileSync("migrate-sql.ts", "utf8");

c = c.replace(
	'const filePath = path.join(process.cwd(), "demo data", "APBARODA_1.sql");',
	`const files = ["demo data/APBARODA-APRIL2026.sql", "demo data/APBARODA-MAY2026.sql", "demo data/APBARODA-JUNE2026.sql", "demo data/APBARODA-JULY2026.sql", "demo data/APBARODA-AUG2026.sql", "demo data/APBARODA-SEP2026.sql", "demo data/APBARODA-OCT2026.sql"];
	for (const file of files) {
		const filePath = path.join(process.cwd(), file);`,
);

c = c.replace(
	'if (!fs.existsSync(filePath)) {\n\t\tconsole.error("File not found:", filePath);\n\t\tprocess.exit(1);\n\t}',
	'if (!fs.existsSync(filePath)) {\n\t\t\tconsole.log("File not found:", filePath);\n\t\t\tcontinue;\n\t\t}',
);

c = c.replace(
	/productsBatch = \[\];[\s\S]*outstandingBatch = \[\];\s*}\s*}\s*await flushBatch/m,
	`productsBatch = [];
				usersBatch = [];
				mfgBatch = [];
				inventoryBatch = [];
				salesBatch = [];
				invoicesBatch = [];
				outstandingBatch = [];
			}
		}
	}
	
	// flush final
	await flushBatch`,
);

fs.writeFileSync("migrate-sql.ts", c);
