import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { db } from "./src/server/db";
import { legacyViewStocks, legacyHBatch } from "./src/server/db/schema";
import { sql } from "drizzle-orm";

const BATCH_SIZE = 2000;

async function flushBatch(table: any, batch: any[], conflictTarget?: any, setObj?: any) {
	if (batch.length === 0) return;
	const map = new Map<any, any>();
	for (const item of batch) {
		if (item.id) map.set(item.id, item);
	}
	const uniqueBatch = Array.from(map.values());
	if (uniqueBatch.length === 0) return;

	for (let i = 0; i < uniqueBatch.length; i += BATCH_SIZE) {
		const chunk = uniqueBatch.slice(i, i + BATCH_SIZE);
		try {
			if (conflictTarget && setObj) {
				await db.insert(table).values(chunk).onConflictDoUpdate({
					target: conflictTarget,
					set: setObj,
				});
			} else {
				await db.insert(table).values(chunk).onConflictDoNothing();
			}
		} catch (e) {
			console.error(`Error inserting chunk:`, e);
		}
	}
}

async function main() {
	const filePath = path.join(process.cwd(), "demo data/dataexport.sql");
	if (!fs.existsSync(filePath)) {
		console.log(`File not found: ${filePath}`);
		process.exit(1);
	}

	console.log("Wiping existing legacy tables...");
	await db.delete(legacyViewStocks);
	await db.delete(legacyHBatch);

	console.log(`Scanning dataexport.sql... this may take a few minutes`);
	const fileStream = fs.createReadStream(filePath);
	const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

	let currentTable = "";
	let linesRead = 0;
	let vsBatch: any[] = [];
	let hbBatch: any[] = [];

	for await (const line of rl) {
		linesRead++;
		const trimmed = line.trim();
		
		const insertMatch = trimmed.match(/^INSERT (?:IGNORE )?INTO [`"']?(.*?)[`"']?\s*\(/i);
		if (insertMatch && insertMatch[1]) {
			currentTable = insertMatch[1].toLowerCase();
		} else if (trimmed.startsWith("INSERT INTO")) {
		    continue;
		}

		if (currentTable && trimmed.startsWith("(")) {
			// Extract all values wrapped in parentheses
			const valuesRegex = /\((.*?)\)(?=[,\;])/g;
			let match;
			const lineToMatch = trimmed + (trimmed.endsWith(";") ? "" : ",");
			
			while ((match = valuesRegex.exec(lineToMatch)) !== null) {
				const valuesStr = match[1];
				if (!valuesStr) continue;

				const parts = valuesStr.split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map(s => {
					let clean = s.trim();
					if (clean.startsWith("'") && clean.endsWith("'")) {
						clean = clean.slice(1, -1).replace(/\\'/g, "'");
					}
					return clean;
				});

				if (currentTable === "view_stocks") {
					const [lineId, cmpNo, locNo, yearNo, tDate, tNo, custId, itemId, batchId, entryType, opening, inward, sRetInward, sRetExpInward, outward, saleQty, saleFQty, addStockAdj, lessStockAdj, expiryOut, fQty, godown, qty] = parts;
					
					if (itemId) {
						vsBatch.push({
							id: `${tNo}-${lineId}-${Math.random().toString(36).substring(7)}`,
							cmpNo: cmpNo,
							locNo: locNo,
							tDate: (tDate && tDate !== '0000-00-00 00:00:00') ? new Date(tDate) : null,
							itemId: itemId,
							batchId: batchId,
							opening: parseInt(opening || "0"),
							inward: parseInt(inward || "0"),
							sRetInward: parseInt(sRetInward || "0"),
							addStockAdj: parseInt(addStockAdj || "0"),
							outward: parseInt(outward || "0"),
							saleQty: parseInt(saleQty || "0"),
							saleFQty: parseInt(saleFQty || "0"),
							lessStockAdj: parseInt(lessStockAdj || "0"),
							qty: parseInt(qty || "0"),
						});
					}
				} else if (currentTable === "h_batch") {
					const [id, cmpNo, locNo, yearNo, itemId, batchNo, mfgBy, mfgDt, expDt, mrp, pRate, ptr, costRate] = parts;
					
					if (id && itemId) {
						hbBatch.push({
							id: id,
							itemId: itemId,
							batchNo: batchNo,
							pRate: parseFloat(pRate || "0").toString(),
							ptr: parseFloat(ptr || "0").toString(),
							mrp: parseFloat(mrp || "0").toString(),
							costRate: parseFloat(costRate || "0").toString()
						});
					}
				}
			}

			if (vsBatch.length >= 5000) {
				await flushBatch(legacyViewStocks, vsBatch);
				vsBatch = [];
			}
			if (hbBatch.length >= 5000) {
				await flushBatch(legacyHBatch, hbBatch);
				hbBatch = [];
			}
		}

		if (trimmed.endsWith(";")) {
			currentTable = "";
		}
		
		if (linesRead % 500000 === 0) {
		    console.log(`Processed ${linesRead} lines...`);
		}
	}

	if (vsBatch.length > 0) await flushBatch(legacyViewStocks, vsBatch);
	if (hbBatch.length > 0) await flushBatch(legacyHBatch, hbBatch);

	console.log(`Legacy import completed! Processed ${linesRead} lines.`);
	process.exit(0);
}

main().catch((err) => {
	console.error("Legacy migration failed:", err);
	process.exit(1);
});
