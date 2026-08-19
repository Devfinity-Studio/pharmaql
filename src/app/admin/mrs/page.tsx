import { eq, ilike, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
	assignManufacturer,
	toggleMRBlockStatus,
	unassignManufacturer,
	updateMRPermissions,
} from "@/server/actions/mrs";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { mrManufacturers, products, user } from "@/server/db/schema";
import { AddMRButton } from "./add-mr-button";

export default async function AdminMRsPage({
	searchParams,
}: {
	searchParams: Promise<{ search?: string }>;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "ADMIN") {
		redirect("/login");
	}

	const awaitedParams = await searchParams;
	const searchQuery = awaitedParams.search || "";

	// Get MRs with search filter
	let allMRs;
	if (searchQuery) {
		allMRs = await db
			.select()
			.from(user)
			.where(
				or(
					ilike(user.name, `%${searchQuery}%`),
					ilike(user.email, `%${searchQuery}%`),
				),
			);
	} else {
		allMRs = await db.select().from(user).where(eq(user.role, "MR"));
	}

	// Filter out non-MRs if search hit an admin
	allMRs = allMRs.filter((u) => u.role === "MR");

	// Get all unique manufacturers and divisions currently in products table
	const allManufacturers = await db
		.selectDistinct({
			manufacturer: products.manufacturer,
			division: products.division,
		})
		.from(products)
		.where(sql`${products.manufacturer} IS NOT NULL`);

	allManufacturers.sort((a, b) => {
		if (a.manufacturer === b.manufacturer) {
			return (a.division || "").localeCompare(b.division || "");
		}
		return (a.manufacturer || "").localeCompare(b.manufacturer || "");
	});

	// Get all assignments
	const allAssignments = await db.select().from(mrManufacturers);

	return (
		<div className="mt-4 space-y-8">
			<div>
				<h1 className="font-extrabold text-3xl text-gray-900">
					MR Data Access Management
				</h1>
				<p className="mt-2 font-medium text-gray-500">
					Assign specific Manufacturers to Medical Representatives and view
					their data.
				</p>
			</div>

			{/* Search Bar */}
			<div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm xl:flex-row xl:items-center">
				<form className="flex flex-grow flex-col gap-4 sm:flex-row" method="GET">
					<input
						className="block w-full flex-grow rounded-xl border border-gray-200 bg-gray-50 p-3 font-medium text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-blue-500"
						defaultValue={searchQuery}
						name="search"
						placeholder="Search MRs by name or email..."
						type="text"
					/>
					<button
						className="rounded-xl bg-gray-900 px-6 py-3 font-bold text-white shadow-sm transition hover:bg-gray-800"
						type="submit"
					>
						Search
					</button>
					{searchQuery && (
						<Link
							className="flex items-center justify-center rounded-xl bg-gray-100 px-6 py-3 font-bold text-gray-700 shadow-sm transition hover:bg-gray-200"
							href="/admin/mrs"
						>
							Clear
						</Link>
					)}
				</form>
				<AddMRButton manufacturers={allManufacturers} />
			</div>

			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{allMRs.map((mr) => {
					const assignments = allAssignments.filter((a) => a.mrId === mr.id);
					const unassignedManufacturers = allManufacturers.filter(
						(m) =>
							!assignments.some(
								(a) =>
									a.manufacturer === m.manufacturer &&
									a.division === m.division,
							),
					);

					return (
						<div
							className="relative flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
							key={mr.id}
						>
							<div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row">
								<div>
									<h3 className="font-bold text-gray-900 text-xl">{mr.name}</h3>
									<p className="text-gray-500 text-sm">{mr.email}</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<form
										action={async () => {
											"use server";
											await toggleMRBlockStatus(mr.id, !mr.isBlocked);
										}}
									>
										<button
											className={`whitespace-nowrap rounded-lg px-3 py-1 font-bold text-xs transition ${
												mr.isBlocked
													? "bg-red-100 text-red-700 hover:bg-red-200"
													: "bg-gray-100 text-gray-700 hover:bg-gray-200"
											}`}
											type="submit"
										>
											{mr.isBlocked ? "Unblock" : "Block"}
										</button>
									</form>
									<Link
										className="whitespace-nowrap rounded-lg bg-blue-50 px-3 py-1 font-bold text-blue-700 text-xs transition hover:bg-blue-100"
										href={`/admin/mrs/${mr.id}`}
									>
										View Data &rarr;
									</Link>
								</div>
							</div>

							<div className="flex-grow space-y-4">
								<h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">
									Assigned Data
								</h4>
								{assignments.length === 0 ? (
									<div className="text-gray-400 text-sm italic">
										No manufacturers assigned.
									</div>
								) : (
									<ul className="space-y-2">
										{assignments.map((a) => (
											<li
												className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2"
												key={a.id}
											>
												<span className="truncate font-semibold text-blue-900 text-sm">
													{a.manufacturer}
													{a.division ? ` - ${a.division}` : ""}
												</span>
												<form
													action={async () => {
														"use server";
														await unassignManufacturer(a.id);
													}}
												>
													<button
														className="p-1 font-bold text-red-500 text-xs hover:text-red-700"
														type="submit"
													>
														Remove
													</button>
												</form>
											</li>
										))}
									</ul>
								)}
							</div>

							<div className="mt-6 space-y-4 border-gray-100 border-t pt-4">
								<h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">
									Permissions
								</h4>
								<form
									action={async (formData) => {
										"use server";
										await updateMRPermissions(mr.id, {
											canViewFreeScheme:
												formData.get("canViewFreeScheme") === "on",
											canViewStock: formData.get("canViewStock") === "on",
											canViewSales: formData.get("canViewSales") === "on",
											canViewPartyWise:
												formData.get("canViewPartyWise") === "on",
											canViewProductWise:
												formData.get("canViewProductWise") === "on",
										});
									}}
									className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3"
								>
									<label className="flex cursor-pointer items-center gap-2 font-medium text-gray-700 text-sm">
										<input
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											defaultChecked={mr.canViewFreeScheme ?? true}
											name="canViewFreeScheme"
											type="checkbox"
										/>
										Free Scheme
									</label>
									<label className="flex cursor-pointer items-center gap-2 font-medium text-gray-700 text-sm">
										<input
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											defaultChecked={mr.canViewStock ?? true}
											name="canViewStock"
											type="checkbox"
										/>
										Stock Reports
									</label>
									<label className="flex cursor-pointer items-center gap-2 font-medium text-gray-700 text-sm">
										<input
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											defaultChecked={mr.canViewSales ?? true}
											name="canViewSales"
											type="checkbox"
										/>
										Sales Reports
									</label>
									<label className="flex cursor-pointer items-center gap-2 font-medium text-gray-700 text-sm">
										<input
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											defaultChecked={mr.canViewProductWise ?? true}
											name="canViewProductWise"
											type="checkbox"
										/>
										Product Wise
									</label>
									<label className="flex cursor-pointer items-center gap-2 font-medium text-gray-700 text-sm">
										<input
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											defaultChecked={mr.canViewPartyWise ?? true}
											name="canViewPartyWise"
											type="checkbox"
										/>
										Party Wise
									</label>
									<button
										className="mt-2 font-bold text-blue-600 text-xs underline hover:text-blue-800"
										type="submit"
									>
										Save Permissions
									</button>
								</form>
							</div>

							<div className="mt-6 border-gray-100 border-t pt-4">
								<form
									action={async (formData) => {
										"use server";
										const val = formData.get("manufacturer") as string;
										if (val) {
											const [mfg, div] = val.split("::");
											await assignManufacturer(mr.id, mfg!, div || null);
										}
									}}
									className="flex gap-2"
								>
									<select
										className="block w-full flex-grow rounded-xl border border-gray-200 bg-gray-50 p-2.5 font-medium text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-blue-500"
										defaultValue=""
										name="manufacturer"
										required
									>
										<option disabled value="">
											Select Manufacturer / Division
										</option>
										{unassignedManufacturers.map((m) => {
											const val = `${m.manufacturer}::${m.division || ""}`;
											const label = m.division
												? `${m.manufacturer} - ${m.division}`
												: m.manufacturer;
											return (
												<option key={val} value={val}>
													{label}
												</option>
											);
										})}
									</select>
									<button
										className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-blue-700"
										type="submit"
									>
										Assign
									</button>
								</form>
							</div>
						</div>
					);
				})}

				{allMRs.length === 0 && (
					<div className="col-span-full rounded-2xl border border-gray-100 border-dashed bg-white py-12 text-center text-gray-500">
						{searchQuery
							? "No MRs found matching your search."
							: "No Medical Representatives found."}
					</div>
				)}
			</div>
		</div>
	);
}
