import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { products } from "@/server/db/schema";

export async function GET() {
	try {
		const allProducts = await db.select().from(products);
		return NextResponse.json({ products: allProducts });
	} catch (e) {
		return NextResponse.json(
			{ error: "Failed to fetch products" },
			{ status: 500 },
		);
	}
}
