import { db } from "./src/server/db";
import { mrManufacturers } from "./src/server/db/schema";
import { eq, and } from "drizzle-orm";

async function run() {
    const existing = await db
        .select()
        .from(mrManufacturers)
        .where(
            and(
                eq(mrManufacturers.mrId, "rajesh.giri6@gmail.com"),
                eq(mrManufacturers.manufacturer, "APICAL"),
                eq(mrManufacturers.division, "APICAL - INETA")
            )
        );

    if (existing.length === 0) {
        await db.insert(mrManufacturers).values({
            id: crypto.randomUUID(),
            mrId: "rajesh.giri6@gmail.com",
            manufacturer: "APICAL",
            division: "APICAL - INETA",
            firmNo: "11",
            company: "APICAL HEALTHCARE PVT LTD"
        });
        console.log("Assigned APICAL - INETA to Rajesh Giri");
    } else {
        console.log("Rajesh Giri already has APICAL - INETA assigned");
    }

    // Check if there's any APICAL assignment without division
    const nullDivs = await db
        .select()
        .from(mrManufacturers)
        .where(
            and(
                eq(mrManufacturers.mrId, "rajesh.giri6@gmail.com"),
                eq(mrManufacturers.manufacturer, "APICAL")
            )
        );
    for (const d of nullDivs) {
        if (!d.division) {
            await db.delete(mrManufacturers).where(eq(mrManufacturers.id, d.id));
            console.log("Removed rogue null division assignment");
        }
    }
}

run().catch(console.error).then(() => process.exit(0));
