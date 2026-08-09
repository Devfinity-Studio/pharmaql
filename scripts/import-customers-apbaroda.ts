import fs from "fs";
import readline from "readline";
import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function run() {
    const files = ["demo data/APBARODA.sql", "demo data/APBARODA_1.sql", "demo data/APBARODA_2.sql", "demo data/APBARODA-APRIL2026.sql", "demo data/APBARODA-MAY2026.sql", "demo data/APBARODA-JUNE2026.sql"];
    
    const customersMap = new Map();

    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const rl = readline.createInterface({ input: fs.createReadStream(file) });
        
        for await (const line of rl) {
            const trimmed = line.trim();
            if (trimmed.startsWith("(") && (trimmed.endsWith("),") || trimmed.endsWith(");"))) {
                // APBARODA.sql has INSERT INTO t_item_sales with:
                // Firmno, LocNo, Code, Division, T_Date, Dealer, Area, ItemId, salesQty, fQty, Amount
                const match = trimmed.match(/^\((.*)\)[,;]$/);
                if (match) {
                    const parts = match[1].split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map(s => {
                        let c = s.trim();
                        if (c.startsWith("'") && c.endsWith("'")) c = c.slice(1, -1).replace(/\\'/g, "'");
                        return c;
                    });
                    
                    if (parts.length === 11 || parts.length === 12) {
                        const code = parts[2];
                        const dealer = parts[5];
                        const area = parts[6];
                        if (code && dealer && code !== "NULL" && dealer !== "NULL") {
                            customersMap.set(code, { name: dealer, city: area || "" });
                        }
                    }
                }
            }
        }
    }

    console.log(`Extracted ${customersMap.size} unique customers from APBARODA files.`);

    const batch = Array.from(customersMap.entries()).map(([id, info]) => ({
        id: id,
        name: info.name,
        city: info.city
    }));

    if (batch.length > 0) {
        let inserted = 0;
        for (let i = 0; i < batch.length; i += 1000) {
            const chunk = batch.slice(i, i + 1000);
            
            const values = chunk.map(c => `('${c.id.replace(/'/g, "''")}', '${c.name.replace(/'/g, "''")}', '${c.city.replace(/'/g, "''")}')`).join(",");
            const q = `INSERT INTO "pg-drizzle_legacy_customers" (id, name, city) VALUES ${values} ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, city = CASE WHEN EXCLUDED.city != '' THEN EXCLUDED.city ELSE "pg-drizzle_legacy_customers".city END`;
            
            await db.execute(sql.raw(q));
            inserted += chunk.length;
        }
        console.log(`Inserted ${inserted} customers.`);
    }

    process.exit(0);
}
run();
