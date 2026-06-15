import { db } from "@/server/db";
import { products } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { ProductListClient } from "./product-list-client";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function CompanyProductsPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const awaitedParams = await params;
  const companyName = decodeURIComponent(awaitedParams.company);

  // Fetch all companies for the dropdown
  const companiesData = await db
    .select({ name: products.manufacturer })
    .from(products)
    .groupBy(products.manufacturer);

  const allCompanies = companiesData
    .map((c) => c.name)
    .filter((n) => n && n !== "Unknown")
    .sort();

  if (!allCompanies.includes(companyName)) {
    notFound();
  }

  // Fetch products for this company
  const companyProducts = await db
    .select()
    .from(products)
    .where(eq(products.manufacturer, companyName));

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            href="/products"
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            &larr; Back to Companies
          </Link>
          <div className="text-xl font-bold text-gray-900">{companyName}</div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <ProductListClient
          initialCompany={companyName}
          allCompanies={allCompanies}
          products={companyProducts}
        />
      </div>
    </main>
  );
}
