import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { products } from "@/server/db/schema";
import { ProductListClient } from "./product-list-client";

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
    <main className="flex flex-col">
      <div className="border-gray-200 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            className="flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800"
            href="/products"
          >
            &larr; Back to Companies
          </Link>
          <div className="font-bold text-gray-900 text-xl">{companyName}</div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <ProductListClient
          allCompanies={allCompanies}
          initialCompany={companyName}
          products={companyProducts}
        />
      </div>
    </main>
  );
}
