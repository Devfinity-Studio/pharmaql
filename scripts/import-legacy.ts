import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { sql } from "drizzle-orm";
import { db } from "./src/server/db";

async function main() {
	console.log("Altering pg-drizzle_legacy_view_stocks...");
	try {
		await db.execute(
			sql`ALTER TABLE "pg-drizzle_legacy_view_stocks" ADD COLUMN IF NOT EXISTS "t_no" text;`,
		);
		await db.execute(
			sql`ALTER TABLE "pg-drizzle_legacy_view_stocks" ADD COLUMN IF NOT EXISTS "entry_type" text;`,
		);
	} catch (e) {
		console.log("Error adding columns (might already exist):", e);
	}

	console.log("Truncating legacy tables to remove old incorrect data...");
	await db.execute(sql.raw(`TRUNCATE TABLE "pg-drizzle_legacy_view_stocks" CASCADE`));
	await db.execute(sql.raw(`TRUNCATE TABLE "pg-drizzle_legacy_h_batch" CASCADE`));

	const filePath = path.join(process.cwd(), "demo data", "dataexport.sql");
	console.log(`Starting migration from ${filePath}`);
	const rl = readline.createInterface({
		input: fs.createReadStream(filePath),
		crlfDelay: Infinity,
	});

	let currentTable = "";
	let vsBatch: any[] = [];
	let hbBatch: any[] = [];
	const BATCH_SIZE = 1000;

	async function flushVs() {
		if (vsBatch.length === 0) return;
		const q =
			`INSERT INTO "pg-drizzle_legacy_view_stocks" 
            (id, cmp_no, loc_no, t_date, item_id, batch_id, opening, inward, s_ret_inward, add_stock_adj, outward, sale_qty, sale_f_qty, less_stock_adj, qty, t_no, entry_type) 
            VALUES ` +
			vsBatch
				.map(
					(v) =>
						`('${v.id.replace(/'/g, "''")}', '${v.cmp_no}', '${v.loc_no}', ${v.t_date ? `'${v.t_date}'` : "NULL"}, '${v.item_id}', '${v.batch_id}', ${v.opening}, ${v.inward}, ${v.s_ret_inward}, ${v.add_stock_adj}, ${v.outward}, ${v.sale_qty}, ${v.sale_f_qty}, ${v.less_stock_adj}, ${v.qty}, '${v.t_no}', '${v.entry_type}')`,
				)
				.join(",") +
			` ON CONFLICT (id) DO NOTHING`;
		try {
			await db.execute(sql.raw(q));
		} catch (e) {
			console.error("VS Insert error", e);
		}
		vsBatch = [];
	}

	async function flushHb() {
		if (hbBatch.length === 0) return;
		const q =
			`INSERT INTO "pg-drizzle_legacy_h_batch" 
            (id, item_id, batch_no, prate, ptr, mrp, cost_rate) 
            VALUES ` +
			hbBatch
				.map(
					(v) =>
						`('${v.id}', '${v.item_id}', '${v.batch_no.replace(/'/g, "''")}', ${v.prate}, ${v.ptr}, ${v.mrp}, ${v.cost_rate})`,
				)
				.join(",") +
			` ON CONFLICT (id) DO NOTHING`;
		try {
			await db.execute(sql.raw(q));
		} catch (e) {
			console.error("HB Insert error", e);
		}
		hbBatch = [];
	}

	let processed = 0;
	for await (const line of rl) {
		const trimmed = line.trim();
		const insertMatch = trimmed.match(/^INSERT INTO `(.*?)`/i);
		if (insertMatch && insertMatch[1]) {
			currentTable = insertMatch[1].toLowerCase();
			continue;
		}

		if (currentTable === "view_stocks" && trimmed.startsWith("(")) {
            const match = trimmed.match(/^\((.*)\)[,;]$/);
            if (match) {
                const p = match[1].split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map(s => {
					let c = s.trim();
					if (c.startsWith("'") && c.endsWith("'")) c = c.slice(1, -1).replace(/\\'/g, "'");
					return c;
				});
                if (p.length >= 23) {
                    vsBatch.push({
                        id: `${p[1]}-${p[2]}-${p[4]}-${p[5]}-${p[7]}-${p[8]}-${p[9]}-${Math.random().toString(36).substring(7)}`, cmp_no: p[1]||'0', loc_no: p[2]||'0', t_date: p[4] === 'NULL' ? null : (p[4]||'0'), t_no: p[5]||'0', item_id: p[7]||'0', batch_id: p[8]||'0', entry_type: p[9]||'0',
                        opening: p[10]||0, inward: p[11]||0, s_ret_inward: p[12]||0, add_stock_adj: p[17]||0, outward: p[14]||0, sale_qty: p[15]||0, sale_f_qty: p[16]||0, less_stock_adj: p[18]||0, qty: p[22]||0
                    });
                    if (vsBatch.length >= BATCH_SIZE) await flushVs();
                }
            }
        } else if (currentTable === "h_batch" && trimmed.startsWith("(")) {
             const match = trimmed.match(/^\((.*)\)[,;]$/);
            if (match) {
                const p = match[1].split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map(s => {
					let c = s.trim();
					if (c.startsWith("'") && c.endsWith("'")) c = c.slice(1, -1).replace(/\\'/g, "'");
					return c;
				});
                if (p.length >= 13) {
                    hbBatch.push({
                        id: p[0]||'0', item_id: p[4]||'0', batch_no: p[5]||'0', mrp: p[9]||0, prate: p[10]||0, ptr: p[11]||0, cost_rate: p[12]||0
                    });
                    if (hbBatch.length >= BATCH_SIZE) await flushHb();
                }
            }
        }

		if (trimmed.endsWith(";")) {
			currentTable = "";
			processed++;
			if (processed % 100 === 0) console.log(`Processed ${processed} blocks`);
		}
	}

	await flushVs();
	await flushHb();
	console.log("Legacy tables import complete!");
	process.exit(0);
}

main().catch(console.error);
