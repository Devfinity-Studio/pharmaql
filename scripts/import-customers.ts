import fs from "fs";
import readline from "readline";
import { db } from "./src/server/db/index";
import { sql } from "drizzle-orm";

async function run() {
    const rl = readline.createInterface({ input: fs.createReadStream('demo data/dataexport.sql') });
    
    let currentTable = "";
    const customersMap = new Map();

    for await (const line of rl) {
        const trimmed = line.trim();
        if (trimmed.startsWith("INSERT INTO `")) {
            const tableMatch = trimmed.match(/^INSERT INTO `([^`]+)`/);
            if (tableMatch) currentTable = tableMatch[1];
        } else if (trimmed.startsWith("(")) {
            const match = trimmed.match(/^\((.*)\)[,;]$/);
            if (match) {
                const parts = match[1].split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map(s => {
                    let c = s.trim();
                    if (c.startsWith("'") && c.endsWith("'")) c = c.slice(1, -1).replace(/\\'/g, "'");
                    return c;
                });

                if (currentTable === "claimdata" || currentTable === "specialclaimdata") {
                    // CustCode is 1, Customer is 2, City is 4
                    if (parts.length > 4) {
                        const custCode = parts[1];
                        const customer = parts[2];
                        const city = parts[4];
                        if (custCode && custCode !== "NULL" && custCode !== "0") {
                            customersMap.set(custCode, { name: customer, city: city });
                        }
                    }
                } else if (currentTable === "customerbillitemwisesalespara") {
                    // LoginUser, FromDt, ToDt, CustID, Customer...
                    if (parts.length > 4) {
                        const custCode = parts[3];
                        const customer = parts[4];
                        if (custCode && custCode !== "NULL" && custCode !== "0") {
                            customersMap.set(custCode, { name: customer, city: "" });
                        }
                    }
                } else if (currentTable === "customercompanyitemwisesalespara" || currentTable === "customer_company_itemwise_sales_para") {
                    // LoginUser, FromDt, ToDt, PartyType, CustIds, Customer  OR LoginUser, FromDt, ToDt, CustIds, Customer
                    let custCode, customer;
                    if (currentTable === "customercompanyitemwisesalespara") {
                        custCode = parts[4];
                        customer = parts[5];
                    } else {
                        custCode = parts[3];
                        customer = parts[4];
                    }
                    if (custCode && custCode !== "NULL" && custCode !== "0") {
                        // CustIds could be comma separated, but usually it's single in para if it's one party
                        if (!custCode.includes(",")) {
                            customersMap.set(custCode, { name: customer, city: "" });
                        }
                    }
                } else if (currentTable === "m_ledgerpara") {
                    // LoginUser, FromDt, ToDt, PartyType, CustIds, Customer
                    const custCode = parts[4];
                    const customer = parts[5];
                    if (custCode && custCode !== "NULL" && custCode !== "0" && !custCode.includes(",")) {
                        customersMap.set(custCode, { name: customer, city: "" });
                    }
                } else if (currentTable === "enveloppara") {
                    // LoginUser, CustIds, Customer
                    const custCode = parts[1];
                    const customer = parts[2];
                    if (custCode && custCode !== "NULL" && custCode !== "0" && !custCode.includes(",")) {
                        customersMap.set(custCode, { name: customer, city: "" });
                    }
                } else if (currentTable === "sprate_claim_para") {
                    // LoginUser, FromDt, ToDt, MktByID, MktBy, DivID, Division, ItemID, Item, CustID, Customer
                    const custCode = parts[9];
                    const customer = parts[10];
                    if (custCode && custCode !== "NULL" && custCode !== "0" && !custCode.includes(",")) {
                        customersMap.set(custCode, { name: customer, city: "" });
                    }
                }
            }
        }
    }

    console.log(`Extracted ${customersMap.size} unique customers from various tables.`);

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
