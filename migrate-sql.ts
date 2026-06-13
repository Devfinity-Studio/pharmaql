import fs from "node:fs";
import readline from "node:readline";
import { db } from "./src/server/db";
import {
  products,
  user,
  mrManufacturers,
  mrInventory,
  sales,
  invoices,
  outstanding,
} from "./src/server/db/schema";
import { sql } from "drizzle-orm";
import path from "node:path";

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
      console.error(`Error inserting chunk:`, e);
    }
  }
}

async function migrateSql() {
  const filePath = path.join(process.cwd(), "demo data", "APBARODA_1.sql");
  console.log(`Starting migration from ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let currentTable = "";

  let productsBatch: any[] = [];
  let usersBatch: any[] = [];
  let mfgBatch: any[] = [];
  let inventoryBatch: any[] = [];
  let salesBatch: any[] = [];
  let invoicesBatch: any[] = [];
  let outstandingBatch: any[] = [];

  let blocksProcessed = 0;

  // Mapping to resolve LocNo + Code to the actual User ID (LoginId)
  const mrMap = new Map<string, string>();

  for await (const line of rl) {
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

      const parts: string[] = [];
      let currentPart = "";
      let inQuotes = false;
      for (let i = 0; i < valuesStr.length; i++) {
        const char = valuesStr[i];
        if (char === "'" && (i === 0 || valuesStr[i - 1] !== "\\")) {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          parts.push(currentPart);
          currentPart = "";
        } else {
          currentPart += char;
        }
      }
      parts.push(currentPart);

      const cleanParts = parts.map((p) => {
        let clean = p.trim();
        if (clean.startsWith("'") && clean.endsWith("'")) {
          clean = clean.slice(1, -1).replace(/\\'/g, "'");
        }
        if (clean.toUpperCase() === "NULL") return null;
        return clean;
      });

      if (currentTable === "m_item") {
        const [firmNo, itemId, itemName, packing, code, division] = cleanParts;
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
      } else if (currentTable === "m_mr") {
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
        ] = cleanParts;
        if (loginId && mrName) {
          usersBatch.push({
            id: loginId,
            name: mrName,
            email: loginId.includes("@")
              ? loginId.toLowerCase()
              : `${loginId.toLowerCase()}@demo.com`,
            role: "MR",
            locNo: locno || null,
            rank: rank || null,
          });

          if (locno && code) {
            mrMap.set(`${locno}-${code}`, loginId);
          }

          if (code || company) {
            mfgBatch.push({
              id: `${loginId}-${code}-${division}`,
              mrId: loginId,
              manufacturer: code || "Unknown",
              firmNo: firmNo || null,
              division: division || null,
              company: company || null,
            });
          }
        }
      } else if (currentTable === "t_dailyss") {
        const [
          firmno,
          locNo,
          code,
          division,
          t_date,
          itemid,
          opening,
          inward,
          outward,
          prate,
          ptr,
          mrp,
        ] = cleanParts;
        const mappedMrId = mrMap.get(`${locNo}-${code}`);
        if (mappedMrId && itemid) {
          inventoryBatch.push({
            id: `${mappedMrId}-${itemid}-${t_date || Date.now()}`,
            mrId: mappedMrId,
            productId: itemid,
            stock:
              parseInt(opening || "0") +
              parseInt(inward || "0") -
              parseInt(outward || "0"),
            date: t_date ? new Date(t_date) : null,
            opening: parseInt(opening || "0"),
            inward: parseInt(inward || "0"),
            outward: parseInt(outward || "0"),
            ptr: parseFloat(ptr || "0"),
            mrp: parseFloat(mrp || "0"),
          });
        }
      } else if (currentTable === "t_item_sales") {
        const [
          firmno,
          locNo,
          code,
          division,
          t_date,
          dealer,
          area,
          itemId,
          salesQty,
          fQty,
          amount,
        ] = cleanParts;
        const mappedMrId = mrMap.get(`${locNo}-${code}`);
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
      } else if (currentTable === "t_invoices") {
        const [firmNo, locNo, code, t_date, inwDt, invno, invAmt, invType] =
          cleanParts;
        const mappedMrId = mrMap.get(`${locNo}-${code}`);
        if (mappedMrId && invno) {
          invoicesBatch.push({
            id: invno,
            mrId: mappedMrId,
            date: t_date ? new Date(t_date) : null,
            inwDt: inwDt ? new Date(inwDt) : null,
            invNo: invno,
            invAmt: parseFloat(invAmt || "0"),
            invType: invType || null,
            manufacturerCode: code || null,
          });
        }
      } else if (currentTable === "t_outstanding") {
        const [
          firmNo,
          locNo,
          code,
          division,
          t_date,
          doctor,
          city,
          invNo,
          invDt,
          invAmt,
        ] = cleanParts;
        const mappedMrId = mrMap.get(`${locNo}-${code}`);
        if (mappedMrId && invNo) {
          outstandingBatch.push({
            id: `${invNo}-${mappedMrId}-${doctor || "doc"}`,
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

      if (trimmed.endsWith(";")) {
        currentTable = "";
        blocksProcessed++;
        console.log(`Processing block ${blocksProcessed}...`);

        await flushBatch(products, productsBatch, products.id, {
          name: sql`EXCLUDED.name`,
          freeScheme: sql`EXCLUDED.free_scheme`,
          manufacturer: sql`EXCLUDED.manufacturer`,
          firmNo: sql`EXCLUDED.firm_no`,
          code: sql`EXCLUDED.code`,
          division: sql`EXCLUDED.division`,
          updatedAt: new Date(),
        });

        await flushBatch(user, usersBatch, user.id, {
          name: sql`EXCLUDED.name`,
          locNo: sql`EXCLUDED.loc_no`,
          rank: sql`EXCLUDED.rank`,
          updatedAt: new Date(),
        });

        await flushBatch(mrManufacturers, mfgBatch, mrManufacturers.id, {
          manufacturer: sql`EXCLUDED.manufacturer`,
          firmNo: sql`EXCLUDED.firm_no`,
          division: sql`EXCLUDED.division`,
          company: sql`EXCLUDED.company`,
        });

        await flushBatch(mrInventory, inventoryBatch, mrInventory.id, {
          stock: sql`EXCLUDED.stock`,
          date: sql`EXCLUDED.date`,
          opening: sql`EXCLUDED.opening`,
          inward: sql`EXCLUDED.inward`,
          outward: sql`EXCLUDED.outward`,
          ptr: sql`EXCLUDED.ptr`,
          mrp: sql`EXCLUDED.mrp`,
          updatedAt: new Date(),
        });

        await flushBatch(sales, salesBatch, sales.id, {
          quantity: sql`EXCLUDED.quantity`,
          date: sql`EXCLUDED.date`,
          dealer: sql`EXCLUDED.dealer`,
          area: sql`EXCLUDED.area`,
          freeQty: sql`EXCLUDED.free_qty`,
          amount: sql`EXCLUDED.amount`,
          updatedAt: new Date(),
        });

        await flushBatch(invoices, invoicesBatch, invoices.id, {
          date: sql`EXCLUDED.date`,
          inwDt: sql`EXCLUDED.inw_dt`,
          invAmt: sql`EXCLUDED.inv_amt`,
          invType: sql`EXCLUDED.inv_type`,
          manufacturerCode: sql`EXCLUDED.manufacturer_code`,
        });

        await flushBatch(outstanding, outstandingBatch, outstanding.id, {
          doctor: sql`EXCLUDED.doctor`,
          city: sql`EXCLUDED.city`,
          invDt: sql`EXCLUDED.inv_dt`,
          invAmt: sql`EXCLUDED.inv_amt`,
          manufacturerCode: sql`EXCLUDED.manufacturer_code`,
          division: sql`EXCLUDED.division`,
        });

        productsBatch = [];
        usersBatch = [];
        mfgBatch = [];
        inventoryBatch = [];
        salesBatch = [];
        invoicesBatch = [];
        outstandingBatch = [];
      }
    }
  }

  // flush final
  await flushBatch(products, productsBatch, products.id, {
    name: sql`EXCLUDED.name`,
  });
  await flushBatch(user, usersBatch, user.id, { name: sql`EXCLUDED.name` });
  await flushBatch(mrManufacturers, mfgBatch, mrManufacturers.id, {
    manufacturer: sql`EXCLUDED.manufacturer`,
  });
  await flushBatch(mrInventory, inventoryBatch, mrInventory.id, {
    stock: sql`EXCLUDED.stock`,
  });
  await flushBatch(sales, salesBatch, sales.id, {
    quantity: sql`EXCLUDED.quantity`,
  });
  await flushBatch(invoices, invoicesBatch, invoices.id, {
    invAmt: sql`EXCLUDED.inv_amt`,
  });
  await flushBatch(outstanding, outstandingBatch, outstanding.id, {
    invAmt: sql`EXCLUDED.inv_amt`,
  });

  console.log(
    `Migration complete! Successfully processed ${blocksProcessed} blocks.`,
  );
  process.exit(0);
}

migrateSql().catch((err) => {
  console.error("Error during migration:", err);
  process.exit(1);
});
