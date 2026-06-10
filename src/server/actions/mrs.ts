"use server";

import { db } from "@/server/db";
import { mrManufacturers } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function assignManufacturer(mrId: string, manufacturer: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const existing = await db.select().from(mrManufacturers).where(and(eq(mrManufacturers.mrId, mrId), eq(mrManufacturers.manufacturer, manufacturer))).limit(1);
    
    if (existing.length === 0) {
      await db.insert(mrManufacturers).values({
        id: crypto.randomUUID(),
        mrId,
        manufacturer,
      });
    }
    
    revalidatePath("/admin/mrs");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to assign manufacturer" };
  }
}

export async function unassignManufacturer(id: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.delete(mrManufacturers).where(eq(mrManufacturers.id, id));
    revalidatePath("/admin/mrs");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to unassign manufacturer" };
  }
}
