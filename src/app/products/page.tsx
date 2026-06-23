"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ProductsDirectory() {
	const [companies, setCompanies] = useState<string[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoading, setIsLoading] = useState(true);

	// Fetch manufacturers via the query parameter parameter
	useEffect(() => {
		async function fetchCompanies() {
			try {
				const res = await fetch("/api/products?type=companies");
				if (res.ok) {
					const data = await res.json();
					// Accessing the 'companies' key array returned by our updated route
					setCompanies(data.companies || []);
				}
			} catch (error) {
				console.error("Failed fetching manufacturer data:", error);
			} finally {
				setIsLoading(false);
			}
		}
		fetchCompanies();
	}, []);

	// Filter companies live based on search input (case-insensitive)
	const filteredCompanies = companies.filter((company) =>
		company.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	return (
		<main className="relative min-h-screen overflow-x-hidden bg-[#F4F7F9] px-4 pt-12 pb-12 text-[#0B2545] sm:px-6 lg:px-8">
			{/* Still/Fixed Minimalist Medical Grid Pattern Background */}
			<div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#0071BC_1px,transparent_1px)] bg-fixed opacity-[0.4] [background-size:24px_24px]"></div>

			<div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center">
				<h1 className="mb-4 text-center font-extrabold text-4xl text-[#0B2545] tracking-tight md:text-5xl">
					Partner Companies
				</h1>
				<p className="mb-8 max-w-2xl text-center text-gray-500 text-xl">
					Select a company to explore their full catalog of medicines and
					products.
				</p>

				{/* Minimal & High-Contrast Search Bar */}
				<div className="relative mb-12 w-full max-w-md rounded-xl shadow-sm">
					<input
						className="w-full rounded-xl border-2 border-gray-300 bg-white px-5 py-4 pl-12 font-medium text-[#0B2545] text-lg placeholder-gray-400 transition-colors focus:border-[#0071BC] focus:outline-none"
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search companies..."
						type="text"
						value={searchQuery}
					/>

					{/* Search Magnifying Glass Icon Overlay */}
					<div className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-gray-400">
						<svg
							className="h-5 w-5"
							fill="none"
							stroke="currentColor"
							strokeWidth={2.5}
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.603 10.603Z"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>

					{/* Quick Clear Action Button for Elderly Typing Assistance */}
					{searchQuery && (
						<button
							className="absolute top-1/2 right-4 -translate-y-1/2 rounded bg-gray-100 px-2 py-1 font-bold text-gray-400 text-sm transition-colors hover:bg-gray-200 hover:text-gray-600"
							onClick={() => setSearchQuery("")}
						>
							Clear
						</button>
					)}
				</div>

				{/* Dynamic Layout Presentation States */}
				{isLoading ? (
					<div className="text-center font-medium text-gray-500 text-lg">
						Loading companies...
					</div>
				) : filteredCompanies.length === 0 ? (
					<div className="w-full max-w-2xl rounded-xl border border-gray-200/60 bg-white p-12 text-center font-medium text-gray-500 text-lg shadow-sm">
						{companies.length === 0
							? "No companies found in the database."
							: `No companies match "${searchQuery}"`}
					</div>
				) : (
					<div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
						{filteredCompanies.map((company, idx) => (
							<Link
								className="flex transform items-center justify-center rounded-xl border border-gray-200/60 bg-white p-8 text-center font-bold text-[#0B2545] text-xl tracking-wide shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0071BC]/30 hover:text-[#0071BC] hover:shadow-md"
								href={`/products/${encodeURIComponent(company)}`}
								key={idx}
							>
								<span>{company}</span>
							</Link>
						))}
					</div>
				)}
			</div>
		</main>
	);
}
