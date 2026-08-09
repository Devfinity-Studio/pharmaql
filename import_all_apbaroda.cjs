const fs = require("fs");
const { execSync } = require("child_process");

const files = [
	"dataexport.sql",
	"APBARODA.sql",
	"APBARODA_1.sql",
	"APBARODA_2.sql",
	"APBARODA-APRIL2026.sql",
	"APBARODA-MAY2026.sql",
	"APBARODA-JUNE2026.sql",
];

for (const file of files) {
	let c = fs.readFileSync("migrate-sql.ts", "utf8");
	c = c.replace(
		/const filePath = path\.join\(process\.cwd\(\), "demo data", ".*?"\);/,
		`const filePath = path.join(process.cwd(), "demo data", "${file}");`,
	);
	fs.writeFileSync("migrate-sql.ts", c);
	console.log("Running migration for " + file);
	try {
		execSync("pnpm dlx tsx migrate-sql.ts", {
			stdio: "inherit",
			env: {
				...process.env,
				DATABASE_URL:
					"postgresql://neondb_owner:npg_0moVxqFMbDZ4@ep-divine-mud-apv9cwln-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
			},
		});
	} catch (e) {
		console.error("Migration failed for " + file);
	}
}
