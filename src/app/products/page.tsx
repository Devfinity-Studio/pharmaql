import Link from "next/link";
import { db } from "@/server/db";
import { products } from "@/server/db/schema";

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
		<main className="px-4 pt-12 pb-12 sm:px-6 lg:px-8">
			<div className="mx-auto flex max-w-7xl flex-col items-center">
				<h1 className="mb-4 text-center font-extrabold text-4xl text-gray-900 tracking-tight">
					Partner Companies
				</h1>
				<p className="mb-12 max-w-2xl text-center text-gray-500 text-xl">
					Select a company to explore their full catalog of medicines and
					products.
				</p>

				{companies.length === 0 ? (
					<div className="w-full max-w-2xl rounded-2xl border border-gray-100 bg-white p-12 text-center text-gray-500 shadow-sm">
						No companies found in the database.
					</div>
				) : (
					<div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
						{companies.map((company, idx) => (
							<Link
								className="group relative flex transform items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl"
								href={`/products/${encodeURIComponent(company)}`}
								key={idx}
							>
								<div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 opacity-0 transition-opacity group-hover:opacity-100" />
								<span className="relative z-10 font-bold text-gray-800 text-xl transition-colors group-hover:text-blue-700">
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
