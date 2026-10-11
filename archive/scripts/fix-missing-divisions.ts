import { and, eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import readline from "readline";
import { db } from "./src/server/db";
import { mrManufacturers } from "./src/server/db/schema";

async function run() {
	const dataDir = path.join(process.cwd(), "demo data");
	const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".sql"));

	const allDivisions = new Set<string>();
	const assignmentsToAdd: any[] = [];

	for (const file of files) {
		const filePath = path.join(dataDir, file);
		console.log(`Processing ${file}...`);
		const fileStream = fs.createReadStream(filePath);
		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity,
		});

		let currentTable = "";
		for await (const line of rl) {
			const trimmed = line.trim();
			if (trimmed.startsWith("INSERT INTO")) {
				const match = trimmed.match(/INSERT INTO `([^`]+)`/);
				if (match) {
					currentTable = match[1];
				}
			}

			if (currentTable === "m_mr" && trimmed.startsWith("(")) {
				let valuesStr = trimmed;
				if (valuesStr.endsWith("),") || valuesStr.endsWith(");")) {
					valuesStr = valuesStr.slice(1, -2);
				} else {
					valuesStr = valuesStr.slice(1, -1);
				}

				const parts = valuesStr
					.split(/,(?=(?:(?:[^']*'){2})*[^']*$)/)
					.map((s) => {
						let clean = s.trim();
						if (clean.startsWith("'") && clean.endsWith("'")) {
							clean = clean.slice(1, -1).replace(/\\'/g, "'");
						}
						return clean;
					});

				const [
					firmNo,
					locno,
					code,
					division,
					company,
					mrName,
					loginId,
					loginPassword,
					rank,
				] = parts;
				if (loginId && mrName && locno && code) {
					const email = loginId.trim().toLowerCase();
					const cleanEmail = email.includes("@") ? email : `${email}@demo.com`;
					const div = division ? division.trim() : "";

					const uniqueKey = `${cleanEmail}|${code.trim()}|${div}`;
					if (!allDivisions.has(uniqueKey)) {
						allDivisions.add(uniqueKey);
						assignmentsToAdd.push({
							mrId: cleanEmail,
							manufacturer: code.trim(),
							division: div,
							firmNo: firmNo || "11",
							company: company || "",
						});
					}
				}
			}
			if (trimmed.endsWith(";")) {
				currentTable = "";
			}
		}
	}

	console.log(
		`Found ${assignmentsToAdd.length} unique MR assignments in SQL dumps.`,
	);

	let addedCount = 0;
	for (const assignment of assignmentsToAdd) {
		const existing = await db
			.select()
			.from(mrManufacturers)
			.where(
				and(
					eq(mrManufacturers.mrId, assignment.mrId),
					eq(mrManufacturers.manufacturer, assignment.manufacturer),
					eq(mrManufacturers.division, assignment.division),
				),
			);

		if (existing.length === 0) {
			console.log(
				`Adding missing assignment: ${assignment.mrId} -> ${assignment.manufacturer} / ${assignment.division}`,
			);
			await db.insert(mrManufacturers).values({
				id: `${assignment.mrId}-${assignment.manufacturer}-${assignment.division}`.substring(
					0,
					50,
				),
				mrId: assignment.mrId,
				manufacturer: assignment.manufacturer,
				division: assignment.division,
				firmNo: assignment.firmNo,
				company: assignment.company,
			});
			addedCount++;
		}
	}
	console.log(`Added ${addedCount} missing assignments.`);
}

run()
	.catch(console.error)
	.then(() => process.exit(0));
