import { db } from "@/server/db";
import { products } from "@/server/db/schema";
import Link from "next/link";

export default async function ProductsDirectory() {
  // Get all unique companies
  const companiesData = await db
    .select({ name: products.manufacturer })
    .from(products)
    .groupBy(products.manufacturer);

  // Filter out any "Unknown" or empties, and sort
  const companies = companiesData
    .map((c) => c.name)
    .filter((n) => n && n !== "Unknown")
    .sort();

  return (
    <main className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight text-center mb-4">
          Partner Companies
        </h1>
        <p className="text-xl text-gray-500 text-center max-w-2xl mb-12">
          Select a company to explore their full catalog of medicines and
          products.
        </p>

        {companies.length === 0 ? (
          <div className="text-center text-gray-500 p-12 bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-2xl">
            No companies found in the database.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
            {companies.map((company, idx) => (
              <Link
                key={idx}
                href={`/products/${encodeURIComponent(company)}`}
                className="group relative bg-white rounded-2xl p-8 flex items-center justify-center text-center shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-100 transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
                <span className="relative z-10 text-xl font-bold text-gray-800 group-hover:text-blue-700 transition-colors">
                  {company}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
