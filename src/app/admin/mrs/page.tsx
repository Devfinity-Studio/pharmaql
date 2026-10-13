import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
	fetchMRsPage,
	getAllMarketingCompaniesWithDivisions,
} from "@/server/actions/mrInfo";
import { auth } from "@/server/auth";
import { MRListInfiniteScroll } from "./MRListInfiniteScroll";
import { MRSearchForm } from "./MRSearchForm";
import { OverdueMRsSection } from "./overdue-mrs-section";

export default async function AdminMRsPage({
	searchParams,
}: {
	searchParams: Promise<{ search?: string; sort?: string }>;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		redirect("/login");
	}

	const awaitedParams = await searchParams;
	const searchQuery = (awaitedParams.search || "").trim();
	const sortQuery = awaitedParams.sort || "name_asc";

	// 1. Fetch first batch of 10 MRs paginated (Instant initial load)
	const initialPageData = await fetchMRsPage({
		page: 1,
		limit: 10,
		search: searchQuery,
		sort: sortQuery,
	});

	// 2. Fetch marketing companies & divisions for assignment dropdown
	const mktCompanies = await getAllMarketingCompaniesWithDivisions();
	const allManufacturers = mktCompanies.map((c) => ({
		manufacturer: c.companyName || c.companyCode,
		division: c.divisionName ? c.divisionName.trim() : null,
	}));

	allManufacturers.sort((a, b) => {
		if (a.manufacturer === b.manufacturer) {
			return (a.division || "").localeCompare(b.division || "");
		}
		return (a.manufacturer || "").localeCompare(b.manufacturer || "");
	});

	return (
		<div className="mt-4 space-y-8">
			<div>
				<h1 className="font-extrabold text-3xl text-gray-900">
					MR Data Access Management
				</h1>
				<p className="mt-2 font-medium text-gray-500">
					View Medical Representatives, manage block status, verify ERP division assignments, and check ranking-based report access.
				</p>
			</div>

			{/* Live Overdue & Cascading Blocking Control Center (scanned on demand) */}
			<OverdueMRsSection />

			{/* Search Bar */}
			<div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm xl:flex-row xl:items-center">
				<div className="flex flex-grow items-center">
					<MRSearchForm />
				</div>
			</div>

			{/* Paginated Infinite Scroll MR List */}
			<MRListInfiniteScroll
				allManufacturers={allManufacturers}
				initialHasMore={initialPageData.hasMore}
				initialItems={initialPageData.items}
				initialTotal={initialPageData.total}
				searchQuery={searchQuery}
				sortQuery={sortQuery}
			/>
		</div>
	);
}
