import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { sql } from "drizzle-orm";
import { db } from "./src/server/db";

async function main() {
	console.log("Truncating new legacy tables...");
	await db.execute(sql.raw(`TRUNCATE TABLE "pg-drizzle_legacy_h_sale" CASCADE`));
	await db.execute(sql.raw(`TRUNCATE TABLE "pg-drizzle_legacy_l_sale" CASCADE`));
	await db.execute(sql.raw(`TRUNCATE TABLE "pg-drizzle_legacy_m_ledger" CASCADE`));

	const filePath = path.join(process.cwd(), "demo data", "dataexport.sql");
	console.log(`Starting migration from ${filePath}`);
	const rl = readline.createInterface({
		input: fs.createReadStream(filePath),
		crlfDelay: Infinity,
	});

	let currentTable = "";
	let hsBatch: any[] = [];
	let lsBatch: any[] = [];
	let mlBatch: any[] = [];
	const BATCH_SIZE = 1000;

	async function flushHs() {
		if (hsBatch.length === 0) return;
		const q =
			`INSERT INTO "pg-drizzle_legacy_h_sale" 
            (id, cmp_no, loc_no, inv_dt, inv_no, cust_id, inv_type) 
            VALUES ` +
			hsBatch
				.map(
					(v) =>
						`('${v.id}', '${v.cmp_no}', '${v.loc_no}', ${v.inv_dt ? `'${v.inv_dt}'` : "NULL"}, '${v.inv_no.replace(/'/g, "''")}', '${v.cust_id}', '${v.inv_type}')`,
				)
				.join(",") +
			` ON CONFLICT (id) DO NOTHING`;
		try {
			await db.execute(sql.raw(q));
		} catch (e) {
			console.error("HS Insert error", e);
		}
		hsBatch = [];
	}

	async function flushLs() {
		if (lsBatch.length === 0) return;
		const q =
			`INSERT INTO "pg-drizzle_legacy_l_sale" 
            (id, rid, item_id, batch_no, exp_dt, mrp, rate, qty, f_qty, taxable_amt, vat_amt, line_amt) 
            VALUES ` +
			lsBatch
				.map(
					(v) =>
						`('${v.id}', '${v.rid}', ${v.item_id}, '${v.batch_no.replace(/'/g, "''")}', '${v.exp_dt.replace(/'/g, "''")}', ${v.mrp}, ${v.rate}, ${v.qty}, ${v.f_qty}, ${v.taxable_amt}, ${v.vat_amt}, ${v.line_amt})`,
				)
				.join(",") +
			` ON CONFLICT (id) DO NOTHING`;
		try {
			await db.execute(sql.raw(q));
		} catch (e) {
			console.error("LS Insert error", e);
		}
		lsBatch = [];
	}

	async function flushMl() {
		if (mlBatch.length === 0) return;
		const q =
			`INSERT INTO "pg-drizzle_legacy_m_ledger" 
            (id, name) 
            VALUES ` +
			mlBatch
				.map(
					(v) =>
						`(${v.id}, '${v.name.replace(/'/g, "''")}')`,
				)
				.join(",") +
			` ON CONFLICT (id) DO NOTHING`;
		try {
			await db.execute(sql.raw(q));
		} catch (e) {
			console.error("ML Insert error", e);
		}
		mlBatch = [];
	}

	let processed = 0;
	for await (const line of rl) {
		const trimmed = line.trim();
		const insertMatch = trimmed.match(/^INSERT INTO `(.*?)`/i);
		if (insertMatch && insertMatch[1]) {
			currentTable = insertMatch[1].toLowerCase();
			continue;
		}

		if (currentTable === "h_sale" && trimmed.startsWith("(")) {
            const match = trimmed.match(/^\((.*)\)[,;]$/);
            if (match) {
                const p = match[1].split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map(s => {
					let c = s.trim();
					if (c.startsWith("'") && c.endsWith("'")) c = c.slice(1, -1).replace(/\\'/g, "'");
					return c;
				});
                if (p.length >= 8) {
                    hsBatch.push({
                        id: p[0]||'0', cmp_no: p[1]||'0', loc_no: p[2]||'0', inv_dt: p[5] === 'NULL' ? null : (p[5]||'0'), inv_no: p[6]||'0', cust_id: p[7]||'0', inv_type: p[8]||'0'
                    });
                    if (hsBatch.length >= BATCH_SIZE) await flushHs();
                }
            }
        } else if (currentTable === "l_sale" && trimmed.startsWith("(")) {
             const match = trimmed.match(/^\((.*)\)[,;]$/);
            if (match) {
                const p = match[1].split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map(s => {
					let c = s.trim();
					if (c.startsWith("'") && c.endsWith("'")) c = c.slice(1, -1).replace(/\\'/g, "'");
					return c;
				});
                if (p.length >= 35) {
                    lsBatch.push({
                        id: p[0]||'0', rid: p[3]||'0', item_id: p[7]||'0', batch_no: p[11]||'0', exp_dt: p[14]||'0', mrp: p[15]||0, rate: p[21]||0, qty: p[23]||0, f_qty: p[27]||0, taxable_amt: p[34]||0, vat_amt: p[36]||0, line_amt: p[32]||0
                    });
                    if (lsBatch.length >= BATCH_SIZE) await flushLs();
                }
            }
        } else if (currentTable === "m_ledger" && trimmed.startsWith("(")) {
             const match = trimmed.match(/^\((.*)\)[,;]$/);
            if (match) {
                const p = match[1].split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map(s => {
					let c = s.trim();
					if (c.startsWith("'") && c.endsWith("'")) c = c.slice(1, -1).replace(/\\'/g, "'");
					return c;
				});
                if (p.length >= 2) {
                    mlBatch.push({
                        id: p[0]||'0', name: p[1]||'0'
                    });
                    if (mlBatch.length >= BATCH_SIZE) await flushMl();
                }
            }
        }

		if (trimmed.endsWith(";")) {
			currentTable = "";
			processed++;
			if (processed % 100 === 0) console.log(`Processed ${processed} blocks`);
		}
	}

	await flushHs();
	await flushLs();
    await flushMl();
	console.log("Legacy sales tables import complete!");
	process.exit(0);
}

main().catch(console.error);
