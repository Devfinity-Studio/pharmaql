import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { hashPassword } from "better-auth/crypto";
import { sql, ne, eq } from "drizzle-orm";
import { db } from "./src/server/db";
import {
	account,
	invoices,
	mrInventory,
	mrManufacturers,
	outstanding,
	products,
	sales,
	user,
} from "./src/server/db/schema";

const BATCH_SIZE = 2000;

async function flushBatch<T extends { id?: any }>(
	table: any,
	batch: T[],
	conflictTarget?: any,
	setObj?: any,
) {
	if (batch.length === 0) return;

	// Deduplicate by ID to prevent ON CONFLICT errors
	const map = new Map<any, T>();
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
			console.error(`Error inserting chunk into ${table.key || 'table'}:`, e);
		}
	}
}

async function main() {
	const files = [
		"demo data/APBARODA-APRIL2026.sql",
		"demo data/APBARODA-MAY2026.sql",
		"demo data/APBARODA-JUNE2026.sql"
	];

	console.log("Starting master migration scan...");

	// 1. Gather all unique MRs and unique locNo-code pairs in transactions
	const mrSpecs = new Map<string, {
		firmNo: string;
		locNo: string;
		code: string;
		division: string;
		company: string;
		name: string;
		loginId: string;
		loginPassword?: string;
	}>();

	const transactionKeys = new Set<string>();

	for (const file of files) {
		const filePath = path.join(process.cwd(), file);
		if (!fs.existsSync(filePath)) {
			console.log(`File not found: ${filePath}`);
			continue;
		}
		console.log(`Scanning metadata from ${file}...`);
		const fileStream = fs.createReadStream(filePath);
		const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

		let currentTable = "";
		for await (const line of rl) {
			const trimmed = line.trim();
			const insertMatch = trimmed.match(/^INSERT INTO `(.*?)`/i);
			if (insertMatch && insertMatch[1]) {
				currentTable = insertMatch[1].toLowerCase();
				continue;
			}
			
			if (trimmed.startsWith("(")) {
				const match = trimmed.match(/^\((.*)\)[,;]$/);
				if (!match) continue;
				const valuesStr = match[1];
				if (!valuesStr) continue;

				const parts = valuesStr.split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map(s => {
					let clean = s.trim();
					if (clean.startsWith("'") && clean.endsWith("'")) {
						clean = clean.slice(1, -1).replace(/\\'/g, "'");
					}
					return clean;
				});

				if (currentTable === "m_mr") {
					const [firmNo, locno, code, division, company, mrName, loginId, loginPassword, rank] = parts;
					if (loginId && mrName && locno && code) {
						const key = `${locno.trim()}-${code.trim()}`;
						mrSpecs.set(key, {
							firmNo: firmNo || "11",
							locNo: locno.trim(),
							code: code.trim(),
							division: division || "",
							company: company || "",
							name: mrName,
							loginId: loginId.trim(),
							loginPassword: loginPassword || undefined
						});
					}
				} else if (["t_dailyss", "t_item_sales", "t_invoices", "t_outstanding"].includes(currentTable)) {
					const locNo = parts[1];
					const code = parts[2];
					if (locNo && code) {
						transactionKeys.add(`${locNo.trim()}-${code.trim()}`);
					}
				}
			}

			if (trimmed.endsWith(";")) {
				currentTable = "";
			}
		}
	}

	console.log(`Found ${mrSpecs.size} MR definitions in m_mr.`);
	console.log(`Found ${transactionKeys.size} unique locNo-code keys in transactions.`);

	// 2. Identify unmapped keys and create dummy representative users
	const mrMap = new Map<string, string>(); // key -> userId (email)
	const userInsertBatch: any[] = [];
	const accountInsertBatch: any[] = [];
	const mfgInsertBatch: any[] = [];

	// Process defined MRs
	for (const [key, spec] of mrSpecs.entries()) {
		const email = spec.loginId.includes("@") ? spec.loginId.toLowerCase() : `${spec.loginId.toLowerCase()}@demo.com`;
		mrMap.set(key, spec.loginId);

		userInsertBatch.push({
			id: spec.loginId,
			name: spec.name,
			email: email,
			role: "MR",
			locNo: spec.locNo,
			rank: "1",
			canViewFreeScheme: true,
			canViewStock: true,
			canViewSales: true,
			canViewPartyWise: true,
			canViewProductWise: true,
		});

		const passwordToUse = spec.loginPassword || "123";
		const hashedPassword = await hashPassword(passwordToUse);
		accountInsertBatch.push({
			id: `credential-${email}`,
			accountId: email,
			providerId: "credential",
			userId: spec.loginId,
			password: hashedPassword,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		mfgInsertBatch.push({
			id: `${spec.loginId}-${spec.code}-${spec.division}`,
			mrId: spec.loginId,
			manufacturer: spec.code,
			firmNo: spec.firmNo,
			division: spec.division,
			company: spec.company,
		});
	}

	// Process unmapped transaction keys
	let dummyCount = 0;
	for (const key of transactionKeys) {
		if (!mrSpecs.has(key)) {
			const [locNo, code] = key.split("-");
			if (!locNo || !code) continue;

			dummyCount++;
			const userId = `${code.toLowerCase()}_rep`;
			const email = `${code.toLowerCase()}@demo.com`;
			mrMap.set(key, userId);

			userInsertBatch.push({
				id: userId,
				name: `${code} Representative`,
				email: email,
				role: "MR",
				locNo: locNo,
				rank: "1",
				canViewFreeScheme: true,
				canViewStock: true,
				canViewSales: true,
				canViewPartyWise: true,
				canViewProductWise: true,
			});

			const hashedPassword = await hashPassword("123");
			accountInsertBatch.push({
				id: `credential-${email}`,
				accountId: email,
				providerId: "credential",
				userId: userId,
				password: hashedPassword,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			mfgInsertBatch.push({
				id: `${userId}-${code}-ALL`,
				mrId: userId,
				manufacturer: code,
				firmNo: "11",
				division: code,
				company: `${code} Pharmaceuticals`,
			});
		}
	}

	console.log(`Created ${dummyCount} dummy representative users for unmapped transaction keys.`);

	// 3. Wipe old tables to start fresh (excluding Admin user)
	console.log("Wiping existing transaction and MR data...");
	await db.delete(sales);
	await db.delete(mrInventory);
	await db.delete(invoices);
	await db.delete(outstanding);
	await db.delete(mrManufacturers);

	// Get all MR user IDs to wipe their credentials
	const mrUsers = await db.select({ id: user.id }).from(user).where(eq(user.role, "MR"));
	const mrUserIds = mrUsers.map((u) => u.id);
	
	if (mrUserIds.length > 0) {
		const { inArray } = await import("drizzle-orm");
		await db.delete(account).where(inArray(account.userId, mrUserIds));
		await db.delete(user).where(inArray(user.id, mrUserIds));
	}
	
	await db.delete(products);

	console.log("Database cleared successfully.");

	// 4. Load all users, accounts, and manufacturer mappings
	console.log("Inserting users...");
	await flushBatch(user, userInsertBatch);
	console.log("Inserting accounts...");
	await flushBatch(account, accountInsertBatch);
	console.log("Inserting manufacturer mappings...");
	await flushBatch(mrManufacturers, mfgInsertBatch);

	// 5. Parse and load all products and transaction data
	let productsBatch: any[] = [];
	let inventoryBatch: any[] = [];
	let salesBatch: any[] = [];
	let invoicesBatch: any[] = [];
	let outstandingBatch: any[] = [];

	for (const file of files) {
		const filePath = path.join(process.cwd(), file);
		if (!fs.existsSync(filePath)) continue;
		console.log(`Importing data from ${file}...`);
		const fileStream = fs.createReadStream(filePath);
		const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

		let currentTable = "";
		let linesRead = 0;

		for await (const line of rl) {
			linesRead++;
			const trimmed = line.trim();
			const insertMatch = trimmed.match(/^INSERT INTO `(.*?)`/i);
			if (insertMatch && insertMatch[1]) {
				currentTable = insertMatch[1].toLowerCase();
				continue;
			}

			if (currentTable && trimmed.startsWith("(")) {
				const match = trimmed.match(/^\((.*)\)[,;]$/);
				if (!match) continue;
				const valuesStr = match[1];
				if (!valuesStr) continue;

				const parts = valuesStr.split(/,(?=(?:(?:[^']*'){2})*[^']*$)/).map(s => {
					let clean = s.trim();
					if (clean.startsWith("'") && clean.endsWith("'")) {
						clean = clean.slice(1, -1).replace(/\\'/g, "'");
					}
					return clean;
				});

				if (currentTable === "m_item") {
					const [firmNo, itemId, itemName, packing, code, division] = parts;
					if (itemId && itemName) {
						productsBatch.push({
							id: itemId,
							name: itemName,
							freeScheme: packing || null,
							manufacturer: code || "Unknown",
							firmNo: firmNo || null,
							code: code || null,
							division: division || null,
						});
					}
				} else if (currentTable === "t_dailyss") {
					const [firmno, locNo, code, division, t_date, itemid, opening, inward, outward, prate, ptr, mrp] = parts;
					if (locNo && code) {
						const mappedMrId = mrMap.get(`${locNo.trim()}-${code.trim()}`);
						if (mappedMrId && itemid) {
							inventoryBatch.push({
								id: `${mappedMrId}-${itemid}-${t_date || Date.now()}-${Math.random().toString(36).substring(7)}`,
								mrId: mappedMrId,
								productId: itemid,
								stock: parseInt(opening || "0") + parseInt(inward || "0") - parseInt(outward || "0"),
								date: t_date ? new Date(t_date) : null,
								opening: parseInt(opening || "0"),
								inward: parseInt(inward || "0"),
								outward: parseInt(outward || "0"),
								ptr: parseFloat(ptr || "0"),
								mrp: parseFloat(mrp || "0"),
								prate: parseFloat(prate || "0"),
							});
						}
					}
				} else if (currentTable === "t_item_sales") {
					const [firmno, locNo, code, division, t_date, dealer, area, itemId, salesQty, fQty, amount] = parts;
					if (locNo && code) {
						const mappedMrId = mrMap.get(`${locNo.trim()}-${code.trim()}`);
						if (mappedMrId && itemId) {
							salesBatch.push({
								id: `${mappedMrId}-${itemId}-${t_date || Date.now()}-${Math.random().toString(36).substring(7)}`,
								mrId: mappedMrId,
								productId: itemId,
								quantity: parseInt(salesQty || "0"),
								date: t_date ? new Date(t_date) : null,
								dealer: dealer || null,
								area: area || null,
								freeQty: parseInt(fQty || "0"),
								amount: parseFloat(amount || "0"),
							});
						}
					}
				} else if (currentTable === "t_invoices") {
					const [firmNo, locNo, code, t_date, inwDt, invno, invAmt, invType] = parts;
					if (locNo && code) {
						const mappedMrId = mrMap.get(`${locNo.trim()}-${code.trim()}`);
						if (mappedMrId && invno) {
							invoicesBatch.push({
								id: `${invno}-${mappedMrId}-${Math.random().toString(36).substring(7)}`,
								mrId: mappedMrId,
								date: t_date ? new Date(t_date) : null,
								inwDt: inwDt ? new Date(inwDt) : null,
								invNo: invno,
								invAmt: parseFloat(invAmt || "0"),
								invType: invType || null,
								manufacturerCode: code || null,
							});
						}
					}
				} else if (currentTable === "t_outstanding") {
					const [firmNo, locNo, code, division, t_date, doctor, city, invNo, invDt, invAmt] = parts;
					if (locNo && code) {
						const mappedMrId = mrMap.get(`${locNo.trim()}-${code.trim()}`);
						if (mappedMrId && invNo) {
							outstandingBatch.push({
								id: `${invNo}-${mappedMrId}-${doctor || "doc"}-${Math.random().toString(36).substring(7)}`,
								mrId: mappedMrId,
								doctor: doctor || null,
								city: city || null,
								invNo: invNo,
								invDt: invDt ? new Date(invDt) : null,
								invAmt: parseFloat(invAmt || "0"),
								manufacturerCode: code || null,
								division: division || null,
							});
						}
					}
				}
			}

			if (trimmed.endsWith(";")) {
				currentTable = "";
			}
		}

		console.log(`Finished scanning ${file} (${linesRead} lines). Flashing batches to database...`);
		
		await flushBatch(products, productsBatch, products.id, {
			name: sql`EXCLUDED.name`,
			freeScheme: sql`EXCLUDED.free_scheme`,
			manufacturer: sql`EXCLUDED.manufacturer`,
			firmNo: sql`EXCLUDED.firm_no`,
			code: sql`EXCLUDED.code`,
			division: sql`EXCLUDED.division`,
			updatedAt: new Date(),
		});

		await flushBatch(mrInventory, inventoryBatch);
		await flushBatch(sales, salesBatch);
		await flushBatch(invoices, invoicesBatch);
		await flushBatch(outstanding, outstandingBatch);

		productsBatch = [];
		inventoryBatch = [];
		salesBatch = [];
		invoicesBatch = [];
		outstandingBatch = [];
	}

	console.log("Master migration completed successfully! All data loaded with zero leftover transaction rows.");
	process.exit(0);
}

main().catch((err) => {
	console.error("Master migration failed:", err);
	process.exit(1);
});
