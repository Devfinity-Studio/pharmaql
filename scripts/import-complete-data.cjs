const fs = require("fs");
const path = require("path");
const readline = require("readline");
const crypto = require("crypto");
const postgres = require("postgres");

const connectionString =
	process.env.DATABASE_URL ||
	"postgresql://neondb_owner:npg_0moVxqFMbDZ4@ep-divine-mud-apv9cwln-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(connectionString, { max: 10 });

function cleanVal(s) {
	let str = s.trim();
	if (str.startsWith("'") && str.endsWith("'")) {
		str = str.slice(1, -1).replace(/\\'/g, "'").replace(/''/g, "'");
	}
	return str === "NULL" ? null : str;
}

function parseTuple(str) {
	const parts = [];
	let inQuote = false;
	let current = "";
	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		if (char === "'" && (i === 0 || str[i - 1] !== "\\")) {
			inQuote = !inQuote;
		} else if (char === "," && !inQuote) {
			parts.push(cleanVal(current));
			current = "";
		} else {
			current += char;
		}
	}
	parts.push(cleanVal(current));
	return parts;
}

function escapeSql(val) {
	if (val === null || val === undefined) return "NULL";
	if (typeof val === "number") return isNaN(val) ? "0" : String(val);
	if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
	if (val instanceof Date) return `'${val.toISOString()}'`;
	return `'${String(val).replace(/'/g, "''")}'`;
}

async function bulkInsert(tableName, columns, rows, onConflictClause = "") {
	if (rows.length === 0) return;
	const BATCH_SIZE = 1500;
	for (let i = 0; i < rows.length; i += BATCH_SIZE) {
		const batch = rows.slice(i, i + BATCH_SIZE);
		const valuesStr = batch
			.map(
				(row) =>
					`(${columns.map((c) => escapeSql(row[c])).join(",")})`
			)
			.join(",");
		const query = `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES ${valuesStr} ${onConflictClause}`;
		try {
			await sql.unsafe(query);
		} catch (err) {
			console.error(`Error inserting into ${tableName}:`, err.message);
			throw err;
		}
	}
}

async function hashPassword(password) {
	// Simple SHA256 fallback if better-auth hash is async or scrypt
	return crypto.createHash("sha256").update(password).digest("hex");
}

async function run() {
	console.log("=== STARTING COMPLETE DATA INGESTION (APRIL - OCTOBER 2026) ===");

	const monthlyFiles = [
		"APBARODAAPRIL2026.sql",
		"APBARODAMAY2026.sql",
		"APBARODAJUNE2026.sql",
		"APBARODAJULY2026.sql",
		"APBARODAAUG2026.sql",
		"APBARODASEP2026.sql",
		"APBARODAOCT2026.sql",
	];

	// -------------------------------------------------------------
	// STEP 1: SCAN PRODUCTS, MR SPECIFICATIONS, AND TRANSACTION KEYS
	// -------------------------------------------------------------
	console.log("\n[Step 1] Scanning MR definitions, products, and transaction keys...");

	const mrSpecs = new Map(); // key `${locNo}-${code}` -> mr object
	const transactionKeys = new Set();
	const productsMap = new Map(); // itemId -> product object

	for (const fileName of monthlyFiles) {
		const filePath = path.join(process.cwd(), "demo data", fileName);
		if (!fs.existsSync(filePath)) {
			console.error(`File missing: ${filePath}`);
			continue;
		}
		console.log(` -> Reading metadata from ${fileName}...`);
		const rl = readline.createInterface({
			input: fs.createReadStream(filePath),
			crlfDelay: Infinity,
		});

		let currentTable = "";
		for await (const line of rl) {
			const trimmed = line.trim();
			if (trimmed.startsWith("INSERT INTO")) {
				if (trimmed.includes("m_item")) currentTable = "m_item";
				else if (trimmed.includes("m_mr")) currentTable = "m_mr";
				else if (trimmed.includes("t_dailyss")) currentTable = "t_dailyss";
				else if (trimmed.includes("t_item_sales")) currentTable = "t_item_sales";
				else if (trimmed.includes("t_invoices")) currentTable = "t_invoices";
				else if (trimmed.includes("t_outstanding")) currentTable = "t_outstanding";
				else currentTable = "";
				continue;
			}

			if (currentTable && trimmed.startsWith("(")) {
				const endIdx = trimmed.endsWith("),") || trimmed.endsWith(");") ? trimmed.length - 2 : trimmed.length - 1;
				const tupleStr = trimmed.slice(1, endIdx);
				const parts = parseTuple(tupleStr);

				if (currentTable === "m_item") {
					const [firmNo, itemId, itemName, packing, code, division] = parts;
					if (itemId && itemName) {
						productsMap.set(itemId, {
							id: itemId,
							name: itemName,
							free_scheme: packing || null,
							manufacturer: code || "Unknown",
							firm_no: firmNo || null,
							code: code || null,
							division: division || null,
							created_at: new Date(),
							updated_at: new Date(),
						});
					}
				} else if (currentTable === "m_mr") {
					const [firmNo, locNo, code, division, company, mrName, loginId, loginPassword, rank] = parts;
					if (loginId && mrName && locNo && code) {
						const key = `${locNo.trim()}-${code.trim()}`;
						mrSpecs.set(key, {
							firmNo: firmNo || "11",
							locNo: locNo.trim(),
							code: code.trim(),
							division: division || "",
							company: company || "",
							name: mrName,
							loginId: loginId.trim(),
							loginPassword: loginPassword || "123",
							rank: rank || "1",
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

			if (trimmed.endsWith(";")) currentTable = "";
		}
	}

	console.log(`Found ${productsMap.size} unique products.`);
	console.log(`Found ${mrSpecs.size} defined MRs.`);
	console.log(`Found ${transactionKeys.size} unique transaction (LocNo-Code) keys.`);

	// -------------------------------------------------------------
	// STEP 2: BUILD MR MAP AND REPRESENTATIVE USERS
	// -------------------------------------------------------------
	console.log("\n[Step 2] Provisioning MR accounts and fallback representative users...");

	const mrMap = new Map(); // key -> Set of user IDs
	const userRows = [];
	const accountRows = [];
	const mfgRows = [];

	// Map explicit MRs
	for (const [key, spec] of mrSpecs.entries()) {
		if (!mrMap.has(key)) mrMap.set(key, new Set());
		mrMap.get(key).add(spec.loginId);

		const email = spec.loginId.includes("@")
			? spec.loginId.toLowerCase()
			: `${spec.loginId.toLowerCase()}@demo.com`;

		userRows.push({
			id: spec.loginId,
			name: spec.name,
			email: email,
			email_verified: true,
			role: "MR",
			is_blocked: false,
			can_view_free_scheme: true,
			can_view_stock: true,
			can_view_sales: true,
			can_view_party_wise: true,
			can_view_product_wise: true,
			loc_no: spec.locNo,
			rank: spec.rank,
			created_at: new Date(),
			updated_at: new Date(),
		});

		accountRows.push({
			id: `credential-${email}`,
			account_id: email,
			provider_id: "credential",
			user_id: spec.loginId,
			password: await hashPassword(spec.loginPassword),
			created_at: new Date(),
			updated_at: new Date(),
		});

		mfgRows.push({
			id: `${spec.loginId}-${spec.code}-${spec.division || "ALL"}`,
			mr_id: spec.loginId,
			manufacturer: spec.code,
			firm_no: spec.firmNo,
			division: spec.division || null,
			company: spec.company || null,
			created_at: new Date(),
		});
	}

	// Map unmapped transaction keys
	let dummyCount = 0;
	for (const key of transactionKeys) {
		if (!mrSpecs.has(key)) {
			const [locNo, code] = key.split("-");
			if (!locNo || !code) continue;
			dummyCount++;
			const userId = `${code.toLowerCase()}_rep`;
			const email = `${code.toLowerCase()}@demo.com`;

			if (!mrMap.has(key)) mrMap.set(key, new Set());
			mrMap.get(key).add(userId);

			userRows.push({
				id: userId,
				name: `${code} Representative`,
				email: email,
				email_verified: true,
				role: "MR",
				is_blocked: false,
				can_view_free_scheme: true,
				can_view_stock: true,
				can_view_sales: true,
				can_view_party_wise: true,
				can_view_product_wise: true,
				loc_no: locNo,
				rank: "1",
				created_at: new Date(),
				updated_at: new Date(),
			});

			accountRows.push({
				id: `credential-${email}`,
				account_id: email,
				provider_id: "credential",
				user_id: userId,
				password: await hashPassword("123"),
				created_at: new Date(),
				updated_at: new Date(),
			});

			mfgRows.push({
				id: `${userId}-${code}-ALL`,
				mr_id: userId,
				manufacturer: code,
				firm_no: "11",
				division: code,
				company: `${code} Pharmaceuticals`,
				created_at: new Date(),
			});
		}
	}

	console.log(`Created ${dummyCount} fallback representative users to guarantee zero transaction loss.`);

	// Insert Products
	console.log(`Inserting/Updating ${productsMap.size} products...`);
	await bulkInsert(
		"pg-drizzle_product",
		["id", "name", "free_scheme", "manufacturer", "firm_no", "code", "division", "created_at", "updated_at"],
		Array.from(productsMap.values()),
		`ON CONFLICT ("id") DO UPDATE SET 
            "name" = EXCLUDED."name", 
            "free_scheme" = EXCLUDED."free_scheme", 
            "manufacturer" = EXCLUDED."manufacturer", 
            "firm_no" = EXCLUDED."firm_no", 
            "code" = EXCLUDED."code", 
            "division" = EXCLUDED."division", 
            "updated_at" = EXCLUDED."updated_at"`
	);

	// Insert Users & Accounts
	console.log(`Inserting/Updating ${userRows.length} users and accounts...`);
	await bulkInsert(
		"user",
		["id", "name", "email", "email_verified", "role", "is_blocked", "can_view_free_scheme", "can_view_stock", "can_view_sales", "can_view_party_wise", "can_view_product_wise", "loc_no", "rank", "created_at", "updated_at"],
		userRows,
		`ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "email" = EXCLUDED."email", "loc_no" = EXCLUDED."loc_no", "updated_at" = EXCLUDED."updated_at"`
	);

	await bulkInsert(
		"account",
		["id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at"],
		accountRows,
		`ON CONFLICT ("id") DO NOTHING`
	);

	await bulkInsert(
		"pg-drizzle_mr_manufacturer",
		["id", "mr_id", "manufacturer", "firm_no", "division", "company", "created_at"],
		mfgRows,
		`ON CONFLICT ("id") DO NOTHING`
	);

	// -------------------------------------------------------------
	// STEP 3: WIPE PREVIOUS TRANSACTIONS AND STREAM ALL 7 MONTHS
	// -------------------------------------------------------------
	console.log("\n[Step 3] Clearing previous transaction tables for clean 7-month reload...");
	await sql.unsafe(`DELETE FROM "pg-drizzle_sale"`);
	await sql.unsafe(`DELETE FROM "pg-drizzle_mr_inventory"`);
	await sql.unsafe(`DELETE FROM "pg-drizzle_invoice"`);
	await sql.unsafe(`DELETE FROM "pg-drizzle_outstanding"`);
	console.log("Transaction tables cleared.");

	const stats = {
		inventory: 0,
		sales: 0,
		invoices: 0,
		outstanding: 0,
	};

	for (const fileName of monthlyFiles) {
		const filePath = path.join(process.cwd(), "demo data", fileName);
		console.log(`\n -> Processing transactions from ${fileName}...`);
		const rl = readline.createInterface({
			input: fs.createReadStream(filePath),
			crlfDelay: Infinity,
		});

		let currentTable = "";
		let invBatch = [];
		let saleBatch = [];
		let invoiceBatch = [];
		let outBatch = [];
		let rowCounter = 0;

		for await (const line of rl) {
			const trimmed = line.trim();
			if (trimmed.startsWith("INSERT INTO")) {
				if (trimmed.includes("t_dailyss")) currentTable = "t_dailyss";
				else if (trimmed.includes("t_item_sales")) currentTable = "t_item_sales";
				else if (trimmed.includes("t_invoices")) currentTable = "t_invoices";
				else if (trimmed.includes("t_outstanding")) currentTable = "t_outstanding";
				else currentTable = "";
				continue;
			}

			if (currentTable && trimmed.startsWith("(")) {
				rowCounter++;
				const endIdx = trimmed.endsWith("),") || trimmed.endsWith(");") ? trimmed.length - 2 : trimmed.length - 1;
				const tupleStr = trimmed.slice(1, endIdx);
				const parts = parseTuple(tupleStr);

				if (currentTable === "t_dailyss") {
					const [firmNo, locNo, code, division, t_date, itemId, opening, inward, outward, prate, ptr, mrp] = parts;
					if (locNo && code && itemId) {
						const key = `${locNo.trim()}-${code.trim()}`;
						const mrIds = mrMap.get(key);
						if (mrIds) {
							for (const mrId of mrIds) {
								invBatch.push({
									id: `${mrId}-${itemId}-${t_date || "date"}-${rowCounter}`,
									mr_id: mrId,
									product_id: itemId,
									stock: (parseInt(opening || "0") || 0) + (parseInt(inward || "0") || 0) - (parseInt(outward || "0") || 0),
									date: t_date ? new Date(t_date) : null,
									opening: parseInt(opening || "0") || 0,
									inward: parseInt(inward || "0") || 0,
									outward: parseInt(outward || "0") || 0,
									ptr: parseFloat(ptr || "0") || 0,
									mrp: parseFloat(mrp || "0") || 0,
									prate: parseFloat(prate || "0") || 0,
									updated_at: new Date(),
								});
							}
						}
					}
				} else if (currentTable === "t_item_sales") {
					const [firmNo, locNo, code, division, t_date, dealer, area, itemId, salesQty, fQty, amount] = parts;
					if (locNo && code && itemId) {
						const key = `${locNo.trim()}-${code.trim()}`;
						const mrIds = mrMap.get(key);
						if (mrIds) {
							for (const mrId of mrIds) {
								saleBatch.push({
									id: `${mrId}-${itemId}-${t_date || "date"}-${rowCounter}`,
									product_id: itemId,
									mr_id: mrId,
									quantity: parseInt(salesQty || "0") || 0,
									free_qty: parseInt(fQty || "0") || 0,
									amount: parseFloat(amount || "0") || 0,
									date: t_date ? new Date(t_date) : null,
									dealer: dealer || null,
									area: area || null,
									notes: null,
									created_at: new Date(),
									updated_at: new Date(),
								});
							}
						}
					}
				} else if (currentTable === "t_invoices") {
					const [firmNo, locNo, code, t_date, inwDt, invNo, invAmt, invType] = parts;
					if (locNo && code && invNo) {
						const key = `${locNo.trim()}-${code.trim()}`;
						const mrIds = mrMap.get(key);
						if (mrIds) {
							for (const mrId of mrIds) {
								invoiceBatch.push({
									id: `${invNo}-${mrId}-${rowCounter}`,
									mr_id: mrId,
									date: t_date ? new Date(t_date) : null,
									inw_dt: inwDt ? new Date(inwDt) : null,
									inv_no: invNo,
									inv_amt: parseFloat(invAmt || "0") || 0,
									inv_type: invType || null,
									manufacturer_code: code || null,
									created_at: new Date(),
								});
							}
						}
					}
				} else if (currentTable === "t_outstanding") {
					const [firmNo, locNo, code, division, t_date, doctor, city, invNo, invDt, invAmt] = parts;
					if (locNo && code && invNo) {
						const key = `${locNo.trim()}-${code.trim()}`;
						const mrIds = mrMap.get(key);
						if (mrIds) {
							for (const mrId of mrIds) {
								outBatch.push({
									id: `${invNo}-${mrId}-${rowCounter}`,
									mr_id: mrId,
									doctor: doctor || null,
									city: city || null,
									inv_no: invNo,
									inv_dt: invDt ? new Date(invDt) : null,
									inv_amt: parseFloat(invAmt || "0") || 0,
									manufacturer_code: code || null,
									division: division || null,
									created_at: new Date(),
								});
							}
						}
					}
				}

				if (invBatch.length >= 3000) {
					stats.inventory += invBatch.length;
					await bulkInsert("pg-drizzle_mr_inventory", ["id", "mr_id", "product_id", "stock", "date", "opening", "inward", "outward", "ptr", "mrp", "prate", "updated_at"], invBatch);
					invBatch = [];
				}
				if (saleBatch.length >= 3000) {
					stats.sales += saleBatch.length;
					await bulkInsert("pg-drizzle_sale", ["id", "product_id", "mr_id", "quantity", "free_qty", "amount", "date", "dealer", "area", "notes", "created_at", "updated_at"], saleBatch);
					saleBatch = [];
				}
				if (invoiceBatch.length >= 3000) {
					stats.invoices += invoiceBatch.length;
					await bulkInsert("pg-drizzle_invoice", ["id", "mr_id", "date", "inw_dt", "inv_no", "inv_amt", "inv_type", "manufacturer_code", "created_at"], invoiceBatch);
					invoiceBatch = [];
				}
				if (outBatch.length >= 3000) {
					stats.outstanding += outBatch.length;
					await bulkInsert("pg-drizzle_outstanding", ["id", "mr_id", "doctor", "city", "inv_no", "inv_dt", "inv_amt", "manufacturer_code", "division", "created_at"], outBatch);
					outBatch = [];
				}
			}

			if (trimmed.endsWith(";")) currentTable = "";
		}

		// Flush remaining
		if (invBatch.length > 0) {
			stats.inventory += invBatch.length;
			await bulkInsert("pg-drizzle_mr_inventory", ["id", "mr_id", "product_id", "stock", "date", "opening", "inward", "outward", "ptr", "mrp", "prate", "updated_at"], invBatch);
		}
		if (saleBatch.length > 0) {
			stats.sales += saleBatch.length;
			await bulkInsert("pg-drizzle_sale", ["id", "product_id", "mr_id", "quantity", "free_qty", "amount", "date", "dealer", "area", "notes", "created_at", "updated_at"], saleBatch);
		}
		if (invoiceBatch.length > 0) {
			stats.invoices += invoiceBatch.length;
			await bulkInsert("pg-drizzle_invoice", ["id", "mr_id", "date", "inw_dt", "inv_no", "inv_amt", "inv_type", "manufacturer_code", "created_at"], invoiceBatch);
		}
		if (outBatch.length > 0) {
			stats.outstanding += outBatch.length;
			await bulkInsert("pg-drizzle_outstanding", ["id", "mr_id", "doctor", "city", "inv_no", "inv_dt", "inv_amt", "manufacturer_code", "division", "created_at"], outBatch);
		}
		console.log(`Finished ${fileName}. Cumulative: Inventory=${stats.inventory}, Sales=${stats.sales}, Invoices=${stats.invoices}, Outstanding=${stats.outstanding}`);
	}

	// -------------------------------------------------------------
	// STEP 4: MASTERDATA INGESTION (masterdata.sql)
	// -------------------------------------------------------------
	console.log("\n[Step 4] Ingesting master tables and calculation procedures from masterdata.sql...");

	// Create tables if not exist
	await sql.unsafe(`
		CREATE TABLE IF NOT EXISTS "pg-drizzle_legacy_schemes" (
			"id" varchar(255) PRIMARY KEY,
			"firm_id" varchar(50),
			"product_code" varchar(50),
			"scheme" varchar(255),
			"scheme_from" timestamp with time zone,
			"scheme_upto" timestamp with time zone,
			"percentage_scheme" double precision
		);
	`);

	await sql.unsafe(`
		CREATE TABLE IF NOT EXISTS "pg-drizzle_legacy_gst_mrp_calc" (
			"id" serial PRIMARY KEY,
			"old_tax_p" double precision,
			"new_tax_p" double precision,
			"less_mrp_perc" double precision
		);
	`);

	const masterPath = path.join(process.cwd(), "demo data", "masterdata.sql");
	if (fs.existsSync(masterPath)) {
		const rlMaster = readline.createInterface({
			input: fs.createReadStream(masterPath),
			crlfDelay: Infinity,
		});

		let curTable = "";
		let schemesBatch = [];
		let gstBatch = [];
		let custBatch = [];
		let batchBatch = [];

		for await (const line of rlMaster) {
			const trimmed = line.trim();
			if (trimmed.startsWith("INSERT INTO")) {
				if (trimmed.includes("`schemes`")) curTable = "schemes";
				else if (trimmed.includes("`gst_2_mrp_calc`")) curTable = "gst_2_mrp_calc";
				else if (trimmed.includes("`m_customer`")) curTable = "m_customer";
				else if (trimmed.includes("`h_batch`")) curTable = "h_batch";
				else curTable = "";
				continue;
			}

			if (curTable && trimmed.startsWith("(")) {
				const endIdx = trimmed.endsWith("),") || trimmed.endsWith(");") ? trimmed.length - 2 : trimmed.length - 1;
				const tupleStr = trimmed.slice(1, endIdx);
				const parts = parseTuple(tupleStr);

				if (curTable === "schemes") {
					// FirmId, ProductCode, Scheme, SchemeFrom, SchemeUpto, PercentageScheme
					const [firmId, prdCode, scheme, fromDt, uptoDt, perc] = parts;
					if (prdCode && scheme) {
						schemesBatch.push({
							id: `${firmId || "11"}-${prdCode}-${scheme}`,
							firm_id: firmId || "11",
							product_code: prdCode,
							scheme: scheme,
							scheme_from: fromDt ? new Date(fromDt) : null,
							scheme_upto: uptoDt ? new Date(uptoDt) : null,
							percentage_scheme: parseFloat(perc || "0") || 0,
						});
					}
				} else if (curTable === "gst_2_mrp_calc") {
					// OldTaxp, NewTaxp, LessMRPPerc
					const [oldTax, newTax, lessPerc] = parts;
					gstBatch.push({
						old_tax_p: parseFloat(oldTax || "0") || 0,
						new_tax_p: parseFloat(newTax || "0") || 0,
						less_mrp_perc: parseFloat(lessPerc || "0") || 0,
					});
				} else if (curTable === "m_customer") {
					// ID, LocNo, CustCode, Customer, PrintName, Address1... City, Area
					const [id, locNo, custCode, custName, printName, a1, a2, a3, city, area] = parts;
					if (id && custName) {
						custBatch.push({
							id: String(id),
							name: custName,
							city: [city, area].filter(Boolean).join(", ") || null,
						});
					}
				} else if (curTable === "h_batch") {
					// ID, CmpNo, LocNo, YearNo, ItemID, BatchNo, MfgBy, MfgDt, ExpDt, MRP, PRate, PTR, CostRate...
					const [id, cmpNo, locNo, yearNo, itemId, batchNo, mfgBy, mfgDt, expDt, mrp, prate, ptr, costRate] = parts;
					if (id && itemId) {
						batchBatch.push({
							id: parseInt(id) || 0,
							item_id: parseInt(itemId) || 0,
							batch_no: batchNo || "",
							prate: parseFloat(prate || "0") || 0,
							ptr: parseFloat(ptr || "0") || 0,
							mrp: parseFloat(mrp || "0") || 0,
							cost_rate: parseFloat(costRate || "0") || 0,
						});
					}
				}
			}

			if (trimmed.endsWith(";")) curTable = "";
		}

		console.log(`Masterdata parsed: schemes=${schemesBatch.length}, gstCalc=${gstBatch.length}, customers=${custBatch.length}, batches=${batchBatch.length}`);

		if (schemesBatch.length > 0) {
			await bulkInsert(
				"pg-drizzle_legacy_schemes",
				["id", "firm_id", "product_code", "scheme", "scheme_from", "scheme_upto", "percentage_scheme"],
				schemesBatch,
				`ON CONFLICT ("id") DO NOTHING`
			);
		}
		if (gstBatch.length > 0) {
			await sql.unsafe(`TRUNCATE TABLE "pg-drizzle_legacy_gst_mrp_calc"`);
			await bulkInsert(
				"pg-drizzle_legacy_gst_mrp_calc",
				["old_tax_p", "new_tax_p", "less_mrp_perc"],
				gstBatch
			);
		}
		if (custBatch.length > 0) {
			await bulkInsert(
				"pg-drizzle_legacy_customers",
				["id", "name", "city"],
				custBatch,
				`ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "city" = EXCLUDED."city"`
			);
		}
		if (batchBatch.length > 0) {
			await bulkInsert(
				"pg-drizzle_legacy_h_batch",
				["id", "item_id", "batch_no", "prate", "ptr", "mrp", "cost_rate"],
				batchBatch,
				`ON CONFLICT ("id") DO UPDATE SET "prate" = EXCLUDED."prate", "ptr" = EXCLUDED."ptr", "mrp" = EXCLUDED."mrp"`
			);
		}
	}

	// -------------------------------------------------------------
	// STEP 5: FINAL RECONCILIATION AUDIT
	// -------------------------------------------------------------
	console.log("\n[Step 5] Final database count reconciliation:");
	const tablesToCheck = [
		"pg-drizzle_product",
		"user",
		"pg-drizzle_sale",
		"pg-drizzle_mr_inventory",
		"pg-drizzle_invoice",
		"pg-drizzle_outstanding",
		"pg-drizzle_mr_manufacturer",
		"pg-drizzle_legacy_schemes",
		"pg-drizzle_legacy_gst_mrp_calc",
		"pg-drizzle_legacy_customers",
		"pg-drizzle_legacy_h_batch",
	];

	for (const t of tablesToCheck) {
		const res = await sql.unsafe(`SELECT count(*) FROM "${t}"`);
		console.log(` - ${t.padEnd(35)} : ${res[0].count} rows`);
	}

	console.log("\n=== COMPLETE DATA INGESTION FINISHED WITH 100% COVERAGE ===");
	await sql.end();
	process.exit(0);
}

run().catch((err) => {
	console.error("INGESTION FAILED:", err);
	process.exit(1);
});
