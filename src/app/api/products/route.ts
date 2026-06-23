import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { products } from "@/server/db/schema";

export async function GET(request: NextRequest) {
  try {
    // 1. Look at the incoming URL to see if a specific filter is requested
    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get("type");

    // 2. If the user explicitly asks for companies, execute the grouped query
    if (filterType === "companies") {
      const companiesData = await db
        .select({ name: products.manufacturer })
        .from(products)
        .groupBy(products.manufacturer);

      const companies = companiesData
        .map((c) => c.name)
        .filter((n): n is string => Boolean(n && n !== "Unknown"))
        .sort();

      return NextResponse.json({ companies });
    }

    // 3. DEFAULT EXISTING BEHAVIOR: Keep your original code untouched here
    const allProducts = await db.select().from(products);
    return NextResponse.json({ products: allProducts });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}
