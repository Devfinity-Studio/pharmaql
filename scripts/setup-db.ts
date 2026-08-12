import { execSync } from "node:child_process";
import fs from "node:fs";

function run(command: string) {
	console.log(`\n\n======================================================`);
	console.log(`🚀 RUNNING: ${command}`);
	console.log(`======================================================\n`);
	try {
		execSync(command, { stdio: "inherit" });
	} catch (e) {
		console.error(`\n❌ FAILED: ${command}`);
		process.exit(1);
	}
}

function main() {
	console.log("🏁 Starting Database Setup & Seeding...");

	// 1. Push Drizzle Schemas (Modern Tables)
	run("pnpm run db:push");

	// 2. Recreate Legacy Tables (IF NOT EXISTS)
	run("npx tsx scripts/create_legacy_tables.ts");
	run("npx tsx scripts/create_customers_table.ts");

	// 3. Import Data into Legacy Tables (Upsert mode)
	if (fs.existsSync("demo data/APBARODA-APRIL2026.sql")) {
		run("npx tsx scripts/import-customers.ts");
		run("npx tsx scripts/import-legacy.ts");
		run("npx tsx scripts/import-new-sales.ts");
	} else {
		console.log(
			"⚠️ 'demo data/' directory or files not found, skipping legacy data imports.",
		);
	}

	// 4. Aggregate Legacy Data into Modern Drizzle Tables
	if (fs.existsSync("demo data/APBARODA-APRIL2026.sql")) {
		run("npx tsx scripts/import-all-demo.ts");
	} else {
		console.log(
			"⚠️ 'demo data/' directory or files not found, skipping aggregation.",
		);
	}

	// 5. Seed Admin User
	if (fs.existsSync("scripts/create_admin.ts")) {
		run("npx tsx scripts/create_admin.ts");
	} else {
		console.log(
			"⚠️ 'scripts/create_admin.ts' not found, skipping admin creation.",
		);
	}

	console.log(`\n✅ Database Setup Complete!`);
}

main();
