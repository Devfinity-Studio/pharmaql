import fs from "node:fs";
import readline from "node:readline";
import { db } from "./src/server/db";
import { products } from "./src/server/db/schema";
import { sql } from "drizzle-orm";
import path from "node:path";

const BATCH_SIZE = 2000;

async function processBatch(
  batch: {
    id: string;
    name: string;
    freeScheme: string | null;
    manufacturer: string;
  }[],
) {
  if (batch.length === 0) return;

  // Insert in chunks to avoid parameter limits in Postgres (max ~65k params per query)
  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const chunk = batch.slice(i, i + BATCH_SIZE);

    await db
      .insert(products)
      .values(chunk)
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: sql`EXCLUDED.name`,
          freeScheme: sql`EXCLUDED.free_scheme`,
          manufacturer: sql`EXCLUDED.manufacturer`,
          updatedAt: new Date(),
        },
      });
  }
}

async function migrateSql() {
  const filePath = path.join(process.cwd(), "demo data", "APBARODA.sql");
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

  let isReadingValues = false;
  let batch: {
    id: string;
    name: string;
    freeScheme: string | null;
    manufacturer: string;
  }[] = [];

  let totalProcessed = 0;
  let blocksProcessed = 0;

  for await (const line of rl) {
    const trimmed = line.trim();

    if (trimmed.toUpperCase().startsWith("INSERT INTO")) {
      isReadingValues = true;
      continue;
    }

    if (isReadingValues && trimmed.startsWith("(")) {
      const match = trimmed.match(/^\((.*)\)[,;]$/);
      if (match) {
        const valuesStr = match[1];

        // Basic parser to handle quoted commas
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

        // Strip quotes
        const cleanParts = parts.map((p) => {
          let clean = p.trim();
          if (clean.startsWith("'") && clean.endsWith("'")) {
            clean = clean.slice(1, -1).replace(/\\'/g, "'");
          }
          return clean;
        });

        const [, itemId, itemName, packing, code] = cleanParts;

        if (itemId && itemName) {
          batch.push({
            id: itemId,
            name: itemName,
            freeScheme: packing || null,
            manufacturer: code || "Unknown",
          });
        }
      }

      if (trimmed.endsWith(";")) {
        isReadingValues = false;
        blocksProcessed++;

        console.log(
          `Processing block ${blocksProcessed}... (Batch size: ${batch.length})`,
        );
        await processBatch(batch);
        totalProcessed += batch.length;
        batch = [];
      }
    }
  }

  // Process any remaining items if the file didn't cleanly end with a semicolon on the last insert block
  if (batch.length > 0) {
    blocksProcessed++;
    console.log(
      `Processing final block ${blocksProcessed}... (Batch size: ${batch.length})`,
    );
    await processBatch(batch);
    totalProcessed += batch.length;
  }

  console.log(
    `Migration complete! Successfully processed ${totalProcessed} products across ${blocksProcessed} insert blocks.`,
  );
}

migrateSql().catch((err) => {
  console.error("Error during migration:", err);
  process.exit(1);
});
