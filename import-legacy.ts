import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { db } from "./src/server/db";
import { sql } from "drizzle-orm";
import { pgTableCreator, varchar, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";

const createTable = pgTableCreator((name) => `pg-drizzle_${name}`);

const legacyViewStocks = createTable("legacy_view_stocks", {
  id: varchar("id", { length: 255 }).primaryKey(),
  cmpNo: varchar("cmp_no", { length: 50 }),
  locNo: varchar("loc_no", { length: 50 }),
  tDate: timestamp("t_date", { withTimezone: true }),
  itemId: integer("item_id"),
  batchId: integer("batch_id"),
  opening: integer("opening"),
  inward: integer("inward"),
  sRetInward: integer("s_ret_inward"),
  outward: integer("outward"),
  saleQty: integer("sale_qty"),
  saleFQty: integer("sale_f_qty"),
  addStockAdj: integer("add_stock_adj"),
  lessStockAdj: integer("less_stock_adj"),
  qty: integer("qty")
});

const legacyHBatch = createTable("legacy_h_batch", {
  id: integer("id").primaryKey(),
  itemId: integer("item_id"),
  batchNo: varchar("batch_no", { length: 255 }),
  prate: doublePrecision("prate"),
  ptr: doublePrecision("ptr"),
  mrp: doublePrecision("mrp"),
  costrate: doublePrecision("cost_rate")
});

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
					// LineID 0, CmpNo 1, LocNo 2, YearNo 3, TDate 4, TNo 5, Custid 6, ItemId 7, BatchId 8, EntryType 9
					// Opening 10, Inward 11, SRetInward 12, SretExpInward 13, Outward 14, SaleQty 15, SaleFQty 16
					// AddStockAdj 17, LessStockAdj 18, ExpiryOut 19, FQty 20, Godown 21, Qty 22
					const [lineId, cmpNo, locNo, yearNo, tDate, tNo, custId, itemId, batchId, entryType, opening, inward, sRetInward, sRetExpInward, outward, saleQty, saleFQty, addStockAdj, lessStockAdj, expiryOut, fQty, godown, qty] = parts;
					
					if (tNo?.trim().startsWith("BR") || entryType?.trim() === "GRNO") {
						continue;
					}
					
					if (itemId) {
						vsBatch.push({
							id: lineId || `${itemId}-${Math.random().toString(36).substring(7)}`,
							cmpNo: cmpNo,
							locNo: locNo,
							tDate: tDate ? new Date(tDate) : null,
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
					// ID 0, CmpNo 1, LocNo 2, YearNo 3, ItemID 4, BatchNo 5, MfgBy 6, MfgDt 7, ExpDt 8, MRP 9
					// PRate 10, PTR 11, CostRate 12
					const [id, cmpNo, locNo, yearNo, itemId, batchNo, mfgBy, mfgDt, expDt, mrp, pRate, ptr, costRate] = parts;
					
					if (id && itemId) {
						hbBatch.push({
							id: id,
							itemId: itemId,
							batchNo: batchNo,
							prate: parseFloat(pRate || "0"),
							ptr: parseFloat(ptr || "0"),
							mrp: parseFloat(mrp || "0"),
							costrate: parseFloat(costRate || "0")
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
