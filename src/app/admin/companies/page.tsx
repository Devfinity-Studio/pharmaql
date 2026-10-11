import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCompanyOverrides } from "@/server/actions/companies";
import { getAllMarketingCompaniesWithDivisions } from "@/server/actions/mrInfo";
import { auth } from "@/server/auth";
import ClientCompanyList from "./ClientCompanyList";

export default async function AdminCompaniesPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		redirect("/login");
	}

	const overrides = await getCompanyOverrides();
	const mktCompanies = await getAllMarketingCompaniesWithDivisions();
	const allCompanyNames = Array.from(
		new Set(mktCompanies.map((c) => c.companyName || c.companyCode)),
	).filter((name): name is string => Boolean(name));

	const companyInfoList = allCompanyNames
		.map((name) => ({
			name,
			isActive: overrides[name] ?? true, // active by default unless explicitly disabled
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	return (
		<div className="mt-4 space-y-8">
			<div>
				<h1 className="font-extrabold text-3xl text-gray-900">
					Company Display Management
				</h1>
				<p className="mt-2 font-medium text-gray-500">
					All active marketing companies and divisions loaded directly from
					legacy ERP master.
				</p>
			</div>

			<ClientCompanyList companies={companyInfoList} />
		</div>
	);
}
