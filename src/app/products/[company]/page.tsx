import Link from "next/link";
import { notFound } from "next/navigation";
import { getItemCatalog } from "@/server/actions/itemCatalog";
import { getAllMarketingCompaniesWithDivisions } from "@/server/actions/mrInfo";
import { ProductListClient } from "./product-list-client";

export default async function CompanyProductsPage({
	params,
}: {
	params: Promise<{ company: string }>;
}) {
	const awaitedParams = await params;
	const companyName = decodeURIComponent(awaitedParams.company);

	// Fetch all companies from API server
	const compList = await getAllMarketingCompaniesWithDivisions();
	const allCompanies = Array.from(
		new Set(
			compList.map((c) => c.companyName || c.companyCode).filter(Boolean),
		),
	);

	// Fetch products for this company/division
	const rawProducts = await getItemCatalog({
		division: companyName,
		limit: 500,
	});

	// Normalize to ProductListClient expected shape
	const companyProducts = rawProducts.map((p) => ({
		id: String(p.ID),
		name: p.ItemName || p.ItemCode,
		code: p.ItemCode,
		division: p.Division || companyName,
		manufacturer: p.MktBy || companyName,
		freeScheme: p.MinNetQty ? `${p.MinNetQty}+${p.MultipleOfQty || 0}` : null,
		firmNo: String(p.CompNo || ""),
		ingredients: null,
		createdAt: p.CreatedDate || new Date(),
		updatedAt: p.EditedDate || new Date(),
	}));

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
					products={companyProducts as any}
				/>
			</div>
		</main>
	);
}
