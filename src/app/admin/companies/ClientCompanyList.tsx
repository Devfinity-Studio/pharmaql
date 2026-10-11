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
			<div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
				<div className="flex gap-4">
					<button
						className={`rounded-lg px-4 py-2 font-bold ${filter === "ALL" ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
						onClick={() => setFilter("ALL")}
					>
						All
					</button>
					<button
						className={`rounded-lg px-4 py-2 font-bold ${filter === "ACTIVE" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
						onClick={() => setFilter("ACTIVE")}
					>
						Active
					</button>
					<button
						className={`rounded-lg px-4 py-2 font-bold ${filter === "INACTIVE" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
						onClick={() => setFilter("INACTIVE")}
					>
						Inactive
					</button>
				</div>
				<div className="relative w-full sm:w-64">
					<input
						className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search companies..."
						type="text"
						value={search}
					/>
					{search && (
						<button
							className="absolute top-1/2 right-3 -translate-y-1/2 font-bold text-gray-400 hover:text-gray-600"
							onClick={() => setSearch("")}
						>
							&times;
						</button>
					)}
				</div>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{filteredCompanies.map((c) => (
					<div
						className={`rounded-xl border p-4 shadow-sm ${c.isActive ? "border-blue-100 bg-white" : "border-red-100 bg-red-50"}`}
						key={c.name}
					>
						<div className="flex items-center justify-between">
							<h3 className="font-bold text-gray-900 text-lg">{c.name}</h3>
							<button
								className={`rounded-full px-3 py-1 font-bold text-xs transition-colors ${
									c.isActive
										? "bg-red-100 text-red-700 hover:bg-red-200"
										: "bg-green-100 text-green-700 hover:bg-green-200"
								}`}
								onClick={async () => {
									await toggleCompanyStatus(c.name, !c.isActive);
								}}
							>
								{c.isActive ? "Deactivate" : "Activate"}
							</button>
						</div>
					</div>
				))}
			</div>
			{filteredCompanies.length === 0 && (
				<p className="font-medium text-gray-500">
					No companies match this filter.
				</p>
			)}
		</div>
	);
}
