import { isNotNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { companies, products } from "@/server/db/schema";
import { getAllMarketingCompaniesWithDivisions } from "@/server/actions/mrInfo";
import ClientCompanyList from "./ClientCompanyList";

export default async function AdminCompaniesPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		redirect("/login");
	}

	// Fetch all distinct manufacturers from products and m_mktcompany
	const allProducts = await db
		.selectDistinct({
			manufacturer: products.manufacturer,
		})
		.from(products)
		.where(isNotNull(products.manufacturer));

	const mktCompanies = await getAllMarketingCompaniesWithDivisions();
	const mktCompanyNames = Array.from(new Set(mktCompanies.map((c) => c.companyName || c.companyCode)));
	const productCompanyNames = allProducts.map((p) => p.manufacturer);
	const allCompanyNames = Array.from(new Set([...mktCompanyNames, ...productCompanyNames])).filter(Boolean);

	// Fetch existing company settings
	const allCompanies = await db.select().from(companies);
	const companyStatusMap = new Map(
		allCompanies.map((c) => [c.name, c.isActive]),
	);

	const companyInfoList = allCompanyNames
		.map((name) => ({
			name,
			isActive: companyStatusMap.has(name)
				? companyStatusMap.get(name)!
				: true, // active by default
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	return (
		<div className="mt-4 space-y-8">
			<div>
				<h1 className="font-extrabold text-3xl text-gray-900">
					Company Display Management
				</h1>
				<p className="mt-2 font-medium text-gray-500">
					Toggle which companies are visible on the products page.
				</p>
			</div>

			<ClientCompanyList companies={companyInfoList} />
		</div>
	);
}
