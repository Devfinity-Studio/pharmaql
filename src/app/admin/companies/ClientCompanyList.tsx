"use client";

import { useState } from "react";
import { toggleCompanyStatus } from "@/server/actions/companies";

type CompanyInfo = {
	name: string;
	isActive: boolean;
};

export default function ClientCompanyList({
	companies,
}: {
	companies: CompanyInfo[];
}) {
	const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
	const [search, setSearch] = useState("");

	const filteredCompanies = companies.filter((c) => {
		const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
		if (!matchesSearch) return false;
		
		if (filter === "ACTIVE") return c.isActive;
		if (filter === "INACTIVE") return !c.isActive;
		return true;
	});

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
				<div className="flex gap-4">
					<button
						onClick={() => setFilter("ALL")}
						className={`px-4 py-2 rounded-lg font-bold ${filter === "ALL" ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
					>
						All
					</button>
					<button
						onClick={() => setFilter("ACTIVE")}
						className={`px-4 py-2 rounded-lg font-bold ${filter === "ACTIVE" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
					>
						Active
					</button>
					<button
						onClick={() => setFilter("INACTIVE")}
						className={`px-4 py-2 rounded-lg font-bold ${filter === "INACTIVE" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
					>
						Inactive
					</button>
				</div>
				<div className="relative w-full sm:w-64">
					<input
						type="text"
						placeholder="Search companies..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					{search && (
						<button
							onClick={() => setSearch("")}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold"
						>
							&times;
						</button>
					)}
				</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{filteredCompanies.map((c) => (
					<div
						key={c.name}
						className={`p-4 rounded-xl shadow-sm border ${c.isActive ? "border-blue-100 bg-white" : "border-red-100 bg-red-50"}`}
					>
						<div className="flex justify-between items-center">
							<h3 className="font-bold text-lg text-gray-900">{c.name}</h3>
							<button
								onClick={async () => {
									await toggleCompanyStatus(c.name, !c.isActive);
								}}
								className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
									c.isActive
										? "bg-red-100 text-red-700 hover:bg-red-200"
										: "bg-green-100 text-green-700 hover:bg-green-200"
								}`}
							>
								{c.isActive ? "Deactivate" : "Activate"}
							</button>
						</div>
					</div>
				))}
			</div>
			{filteredCompanies.length === 0 && (
				<p className="text-gray-500 font-medium">No companies match this filter.</p>
			)}
		</div>
	);
}
