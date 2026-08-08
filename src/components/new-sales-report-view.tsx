import React from "react";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { mrManufacturers, products, sales, user } from "@/server/db/schema";

export async function NewSalesReportView({
	mrId,
	searchParams,
}: {
	mrId: string;
	searchParams?: {
		division?: string;
		from?: string;
		to?: string;
		q?: string;
	};
}) {
	// 1. Validate MR
	const mrInfoArr = await db.select().from(user).where(eq(user.id, mrId)).limit(1);
	const mrInfo = mrInfoArr[0];
	if (!mrInfo || (!mrInfo.canViewSales && mrInfo.role !== "ADMIN")) {
		return <div>No access to sales data.</div>;
	}

	// 2. Fetch MR's assigned companies
	const selectedDivision = searchParams?.division || "All";
	const assigned = await db
		.select()
		.from(mrManufacturers)
		.where(eq(mrManufacturers.mrId, mrId));
	
	const selectedAssignments =
		selectedDivision === "All"
			? assigned
			: assigned.filter(
					(a) => (a.division || a.manufacturer) === selectedDivision,
			  );

	if (selectedAssignments.length === 0) return <div>No data assigned</div>;

	// 3. Get products for those companies
	const productConditionList = selectedAssignments.map((d) => {
		const conditions: any[] = [eq(products.manufacturer, d.manufacturer)];
		if (d.division) {
			conditions.push(eq(products.division, d.division));
		}
		return and(...conditions);
	});

	const { or } = await import("drizzle-orm");

	const accessibleProducts = productConditionList.length > 0 
		? await db
			.select()
			.from(products)
			.where(or(...productConditionList))
		: [];
	
	const productIds = accessibleProducts.map((p) => p.id);

	if (productIds.length === 0) return <div>No products found</div>;

	// 4. Fetch Sales within date range
	let salesCondition = and(inArray(sales.productId, productIds), eq(sales.mrId, mrId));
	
	if (searchParams?.from) {
		const fromDate = new Date(searchParams.from);
		if (!isNaN(fromDate.getTime())) {
			salesCondition = and(salesCondition, gte(sales.date, fromDate));
		}
	}
	if (searchParams?.to) {
		const toDate = new Date(searchParams.to);
		if (!isNaN(toDate.getTime())) {
			toDate.setUTCHours(23, 59, 59, 999);
			salesCondition = and(salesCondition, lte(sales.date, toDate));
		}
	}

	const allSales = await db
		.select({
			dealer: sales.dealer,
			area: sales.area,
			amount: sales.amount,
			manufacturer: products.manufacturer,
			division: products.division
		})
		.from(sales)
		.innerJoin(products, eq(sales.productId, products.id))
		.where(salesCondition);

	// 5. Group by Dealer, Area, Manufacturer, Division
	const groupedSalesMap = new Map<string, {
		dealer: string;
		area: string;
		manufacturer: string;
		division: string;
		totalSales: number;
	}>();

	allSales.forEach(s => {
		const dealer = s.dealer || "Unknown";
		const area = s.area || "";
		const manufacturer = s.manufacturer || "Unknown";
		const division = s.division || manufacturer;
		
		const key = `${dealer}|${area}|${manufacturer}|${division}`;
		
		if (!groupedSalesMap.has(key)) {
			groupedSalesMap.set(key, {
				dealer,
				area,
				manufacturer,
				division,
				totalSales: 0
			});
		}
		
		const existing = groupedSalesMap.get(key)!;
		existing.totalSales += Number(s.amount || 0);
	});

	const groupedSales = Array.from(groupedSalesMap.values()).sort((a, b) => {
		if (a.dealer !== b.dealer) return a.dealer.localeCompare(b.dealer);
		return a.manufacturer.localeCompare(b.manufacturer);
	});

	let totalOverallAmount = 0;
	let finalSales = groupedSales;

	if (searchParams?.q) {
		const query = searchParams.q.toLowerCase();
		finalSales = groupedSales.filter(g => 
			g.dealer.toLowerCase().includes(query) || 
			g.manufacturer.toLowerCase().includes(query)
		);
	}

	finalSales.forEach(g => {
		totalOverallAmount += g.totalSales;
	});

	return (
		<div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<div className="overflow-x-auto">
				<table className="min-w-full divide-y divide-gray-200">
					<thead className="bg-[#0B2545]">
						<tr>
							<th className="px-6 py-4 text-left font-bold text-white text-xs uppercase tracking-wider">
								Customer Name (Dealer)
							</th>
							<th className="px-6 py-4 text-left font-bold text-white text-xs uppercase tracking-wider">
								Area
							</th>
							<th className="px-6 py-4 text-left font-bold text-white text-xs uppercase tracking-wider">
								Company
							</th>
							<th className="px-6 py-4 text-left font-bold text-white text-xs uppercase tracking-wider">
								Division
							</th>
							<th className="px-6 py-4 text-right font-bold text-white text-xs uppercase tracking-wider">
								Total Sales Amount
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200 bg-white">
						{finalSales.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">
									No sales data found for the selected criteria.
								</td>
							</tr>
						) : (
							finalSales.map((row, idx) => (
								<tr key={idx} className="transition-colors hover:bg-blue-50/50">
									<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#0B2545]">
										{row.dealer}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
										{row.area}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#0071BC]">
										{row.manufacturer}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
										{row.division}
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#0B2545] text-right">
										₹{row.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
									</td>
								</tr>
							))
						)}
					</tbody>
					{finalSales.length > 0 && (
						<tfoot className="bg-gray-50 border-t-2 border-gray-200">
							<tr>
								<td colSpan={4} className="px-6 py-4 text-right font-black text-[#0B2545] uppercase text-sm">
									Grand Total
								</td>
								<td className="px-6 py-4 text-right font-black text-[#0071BC] text-lg">
									₹{totalOverallAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</td>
							</tr>
						</tfoot>
					)}
				</table>
			</div>
		</div>
	);
}
