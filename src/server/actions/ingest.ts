"use server";

import { db } from "@/server/db";
import { products, sales } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function ingestCSV(formData: FormData) {
  // 1. Verify Admin Role
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized. Admin access required." };
  }

  // 2. Extract Data
  const file = formData.get("file") as File;
  
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  try {
    const text = await file.text();
    const rows = text.split("\n").map(r => r.trim()).filter(Boolean);
    
    // Assume columns: Manufacturer, Product Name, Stock
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const columns = row.split(",");
      if (columns.length < 3) continue;

      const manufacturer = columns[0]?.trim() || "Unknown";
      const productName = columns[1]?.trim() || "";
      const stockStr = columns[2]?.trim() || "0";
      
      const newStock = parseInt(stockStr, 10) || 0;

      if (!productName) continue;

      // Find existing product
      let productId = "";
      const existingProducts = await db.select().from(products).where(eq(products.name, productName)).limit(1);
      
      const existing = existingProducts[0];
      if (existing) {
        productId = existing.id;
        
        // Calculate Sales based on stock reduction
        if (newStock < existing.stock) {
          const soldQuantity = existing.stock - newStock;
          await db.insert(sales).values({
            id: crypto.randomUUID(),
            productId,
            quantity: soldQuantity,
            notes: "Auto-calculated from stock ingestion",
          });
        }
        
        // Update product
        await db.update(products).set({ stock: newStock, manufacturer }).where(eq(products.id, productId));
      } else {
        productId = crypto.randomUUID();
        await db.insert(products).values({
          id: productId,
          name: productName,
          stock: newStock,
          manufacturer,
          freeScheme: "N/A" // Removed from CSV
        });
      }
    }

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/mrs");
    return { success: true, message: "CSV stock data ingested successfully" };
  } catch (error) {
    console.error("Ingestion error:", error);
    return { success: false, error: "Failed to parse and ingest CSV" };
  }
}
