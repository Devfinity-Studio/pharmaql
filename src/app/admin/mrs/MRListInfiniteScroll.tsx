"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { MRDisplayItem } from "@/server/actions/mrInfo";
import { fetchMRsPage } from "@/server/actions/mrInfo";
import {
	assignManufacturer,
	toggleMRBlockStatus,
	unassignManufacturer,
	updateMRPermissions,
} from "@/server/actions/mrs";

interface Props {
	initialItems: MRDisplayItem[];
	initialTotal: number;
	initialHasMore: boolean;
	allManufacturers: Array<{
		manufacturer: string | null;
		division: string | null;
	}>;
	searchQuery: string;
	sortQuery: string;
}

export function MRListInfiniteScroll({
	initialItems,
	initialTotal,
	initialHasMore,
	allManufacturers,
	searchQuery,
	sortQuery,
}: Props) {
	const [items, setItems] = useState<MRDisplayItem[]>(initialItems);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(initialHasMore);
	const [total, setTotal] = useState(initialTotal);
	const [isLoading, setIsLoading] = useState(false);
	const [actionPendingId, setActionPendingId] = useState<string | null>(null);
	const [statusPills, setStatusPills] = useState<Record<string, string>>({});

	const observerRef = useRef<HTMLDivElement | null>(null);

	// Synchronize when search or sort query changes
	useEffect(() => {
		setItems(initialItems);
		setPage(1);
		setHasMore(initialHasMore);
		setTotal(initialTotal);
	}, [initialItems, initialHasMore, initialTotal]);

	const loadMore = useCallback(async () => {
		if (isLoading || !hasMore) return;
		setIsLoading(true);

		try {
			const nextPage = page + 1;
			const res = await fetchMRsPage({
				page: nextPage,
				limit: 10,
				search: searchQuery,
				sort: sortQuery,
			});

			if (res.items.length > 0) {
				setItems((prev) => {
					// Avoid duplicates
					const existingIds = new Set(prev.map((i) => i.id));
					const fresh = res.items.filter((i) => !existingIds.has(i.id));
					return [...prev, ...fresh];
				});
				setPage(nextPage);
				setHasMore(res.hasMore);
				setTotal(res.total);
			} else {
				setHasMore(false);
			}
		} catch (err) {
			console.error("Failed to load more MRs:", err);
		} finally {
			setIsLoading(false);
		}
	}, [isLoading, hasMore, page, searchQuery, sortQuery]);

	// IntersectionObserver for infinite scrolling
	useEffect(() => {
		const sentinel = observerRef.current;
		if (!sentinel || !hasMore) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const first = entries[0];
				if (first?.isIntersecting) {
					loadMore();
				}
			},
			{ threshold: 0.1, rootMargin: "300px" },
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [loadMore, hasMore]);

	// Card Action: Block / Unblock Toggle
	async function handleToggleBlock(mr: MRDisplayItem) {
		const nextState = !mr.isBlocked;
		setActionPendingId(mr.id);
		// Optimistic update
		setItems((prev) =>
			prev.map((i) => (i.id === mr.id ? { ...i, isBlocked: nextState } : i)),
		);

		try {
			const res = await toggleMRBlockStatus(mr.id, nextState);
			if (!res.success) {
				// Revert on error
				setItems((prev) =>
					prev.map((i) =>
						i.id === mr.id ? { ...i, isBlocked: !nextState } : i,
					),
				);
			}
		} catch (err) {
			console.error("Block toggle failed", err);
			setItems((prev) =>
				prev.map((i) => (i.id === mr.id ? { ...i, isBlocked: !nextState } : i)),
			);
		} finally {
			setActionPendingId(null);
		}
	}

	// Card Action: Save Permissions
	async function handleSavePermissions(
		mr: MRDisplayItem,
		e: React.FormEvent<HTMLFormElement>,
	) {
		e.preventDefault();
		const form = e.currentTarget;
		const formData = new FormData(form);

		const perms = {
			canViewFreeScheme: formData.get("canViewFreeScheme") === "on",
			canViewStock: formData.get("canViewStock") === "on",
			canViewSales: formData.get("canViewSales") === "on",
			canViewPartyWise: formData.get("canViewPartyWise") === "on",
			canViewProductWise: formData.get("canViewProductWise") === "on",
		};

		setActionPendingId(mr.id);
		try {
			await updateMRPermissions(mr.id, perms);
			setItems((prev) =>
				prev.map((i) => (i.id === mr.id ? { ...i, ...perms } : i)),
			);
			setStatusPills((prev) => ({ ...prev, [mr.id]: "Permissions Saved" }));
			setTimeout(() => {
				setStatusPills((prev) => {
					const next = { ...prev };
					delete next[mr.id];
					return next;
				});
			}, 2500);
		} catch (err) {
			console.error("Failed to update permissions", err);
		} finally {
			setActionPendingId(null);
		}
	}

	// Card Action: Assign Manufacturer
	async function handleAssignManufacturer(
		mr: MRDisplayItem,
		e: React.FormEvent<HTMLFormElement>,
	) {
		e.preventDefault();
		const form = e.currentTarget;
		const formData = new FormData(form);
		const val = formData.get("manufacturer") as string;
		if (!val) return;

		const [mfg, div] = val.split("::");
		if (!mfg) return;

		setActionPendingId(mr.id);
		try {
			const res = await assignManufacturer(mr.id, mfg, div || null);
			if (res.success) {
				const newAssignment = {
					id: `assign-${Date.now()}`,
					manufacturer: mfg,
					division: div || null,
				};
				setItems((prev) =>
					prev.map((i) =>
						i.id === mr.id
							? { ...i, assignments: [...i.assignments, newAssignment] }
							: i,
					),
				);
				form.reset();
			}
		} catch (err) {
			console.error("Failed to assign manufacturer", err);
		} finally {
			setActionPendingId(null);
		}
	}

	// Card Action: Remove Assignment
	async function handleRemoveAssignment(mr: MRDisplayItem, assignId: string) {
		setActionPendingId(mr.id);
		// Optimistic removal
		setItems((prev) =>
			prev.map((i) =>
				i.id === mr.id
					? {
							...i,
							assignments: i.assignments.filter((a) => a.id !== assignId),
						}
					: i,
			),
		);

		try {
			const res = await unassignManufacturer(assignId);
			if (!res.success) {
				// Refresh page on error
				console.error("Failed to unassign manufacturer", res.error);
			}
		} catch (err) {
			console.error("Failed to unassign manufacturer", err);
		} finally {
			setActionPendingId(null);
		}
	}

	return (
		<div className="space-y-6">
			{/* Counter bar */}
			<div className="flex items-center justify-between text-gray-500 text-xs">
				<span>
					Showing{" "}
					<span className="font-bold text-gray-900">{items.length}</span> of{" "}
					<span className="font-bold text-gray-900">{total}</span> Medical
					Representatives
				</span>
				{isLoading && (
					<span className="flex items-center gap-1.5 font-medium text-blue-600">
						<span className="h-2 w-2 animate-ping rounded-full bg-blue-600" />
						Loading more MRs...
					</span>
				)}
			</div>

			{/* MR Cards Grid */}
			<div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-3">
				{items.map((mr) => {
					const unassignedManufacturers = allManufacturers.filter(
						(m) =>
							!mr.assignments.some(
								(a) =>
									a.manufacturer === m.manufacturer &&
									a.division === m.division,
							),
					);

					const isBusy = actionPendingId === mr.id;

					return (
						<div
							className={`relative flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all ${
								isBusy ? "opacity-75" : ""
							}`}
							key={mr.id}
						>
							{/* Card Header */}
							<div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row">
								<div>
									<div className="flex items-center gap-2">
										<h3 className="font-bold text-gray-900 text-xl">
											{mr.name}
										</h3>
										{mr.isBlocked && (
											<span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-[10px] text-red-700">
												Blocked
											</span>
										)}
									</div>
									<p className="text-gray-500 text-sm">{mr.email}</p>
									{mr.division && (
										<p className="mt-1 font-semibold text-blue-600 text-xs">
											Division: {mr.division}
										</p>
									)}
								</div>
								<div className="flex flex-wrap gap-2">
									<button
										className={`whitespace-nowrap rounded-lg px-3 py-1 font-bold text-xs transition ${
											mr.isBlocked
												? "bg-red-100 text-red-700 hover:bg-red-200"
												: "bg-gray-100 text-gray-700 hover:bg-gray-200"
										}`}
										disabled={isBusy}
										onClick={() => handleToggleBlock(mr)}
										type="button"
									>
										{mr.isBlocked ? "Unblock" : "Block"}
									</button>
									<Link
										className="whitespace-nowrap rounded-lg bg-blue-50 px-3 py-1 font-bold text-blue-700 text-xs transition hover:bg-blue-100"
										href={`/admin/mrs/${mr.id}`}
									>
										View Data &rarr;
									</Link>
								</div>
							</div>

							{/* Assigned Data Section */}
							<div className="flex-grow space-y-4">
								<h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">
									Assigned Data
								</h4>
								{mr.assignments.length === 0 ? (
									<div className="text-gray-400 text-sm italic">
										No manufacturers assigned.
									</div>
								) : (
									<ul className="space-y-2">
										{mr.assignments.map((a) => (
											<li
												className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2"
												key={a.id}
											>
												<span className="truncate font-semibold text-blue-900 text-sm">
													{a.manufacturer}
													{a.division ? ` - ${a.division}` : ""}
												</span>
												<button
													className="p-1 font-bold text-red-500 text-xs hover:text-red-700"
													disabled={isBusy}
													onClick={() => handleRemoveAssignment(mr, a.id)}
													type="button"
												>
													Remove
												</button>
											</li>
										))}
									</ul>
								)}
							</div>

							{/* Permissions Section */}
							<div className="mt-6 space-y-4 border-gray-100 border-t pt-4">
								<div className="flex items-center justify-between">
									<h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">
										Permissions
									</h4>
									{statusPills[mr.id] && (
										<span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-[10px] text-emerald-800">
											✓ {statusPills[mr.id]}
										</span>
									)}
								</div>
								<form
									className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3"
									onSubmit={(e) => handleSavePermissions(mr, e)}
								>
									<label className="flex cursor-pointer items-center gap-2 font-medium text-gray-700 text-sm">
										<input
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											defaultChecked={mr.canViewFreeScheme}
											name="canViewFreeScheme"
											type="checkbox"
										/>
										Free Scheme
									</label>
									<label className="flex cursor-pointer items-center gap-2 font-medium text-gray-700 text-sm">
										<input
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											defaultChecked={mr.canViewStock}
											name="canViewStock"
											type="checkbox"
										/>
										Stock Reports
									</label>
									<label className="flex cursor-pointer items-center gap-2 font-medium text-gray-700 text-sm">
										<input
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											defaultChecked={mr.canViewSales}
											name="canViewSales"
											type="checkbox"
										/>
										Sales Reports
									</label>
									<label className="flex cursor-pointer items-center gap-2 font-medium text-gray-700 text-sm">
										<input
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											defaultChecked={mr.canViewProductWise}
											name="canViewProductWise"
											type="checkbox"
										/>
										Product Wise
									</label>
									<label className="flex cursor-pointer items-center gap-2 font-medium text-gray-700 text-sm">
										<input
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											defaultChecked={mr.canViewPartyWise}
											name="canViewPartyWise"
											type="checkbox"
										/>
										Party Wise
									</label>
									<button
										className="mt-2 font-bold text-blue-600 text-xs underline hover:text-blue-800 disabled:opacity-50"
										disabled={isBusy}
										type="submit"
									>
										Save Permissions
									</button>
								</form>
							</div>

							{/* Assign Manufacturer Form */}
							<div className="mt-6 border-gray-100 border-t pt-4">
								<form
									className="flex gap-2"
									onSubmit={(e) => handleAssignManufacturer(mr, e)}
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
										className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
										disabled={isBusy}
										type="submit"
									>
										Assign
									</button>
								</form>
							</div>
						</div>
					);
				})}

				{/* Loading skeleton placeholder cards */}
				{isLoading && (
					<>
						<div className="h-96 animate-pulse rounded-2xl border border-gray-100 bg-gray-100/60 p-6" />
						<div className="h-96 animate-pulse rounded-2xl border border-gray-100 bg-gray-100/60 p-6" />
					</>
				)}

				{items.length === 0 && !isLoading && (
					<div className="col-span-full rounded-2xl border border-gray-100 border-dashed bg-white py-12 text-center text-gray-500">
						{searchQuery
							? "No MRs found matching your search."
							: "No Medical Representatives found."}
					</div>
				)}
			</div>

			{/* Infinite scroll sentinel */}
			<div className="py-6 text-center" ref={observerRef}>
				{hasMore ? (
					<button
						className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 font-bold text-gray-700 text-sm shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
						disabled={isLoading}
						onClick={loadMore}
						type="button"
					>
						{isLoading
							? "Loading Next 10 MRs..."
							: "Load More Medical Representatives"}
					</button>
				) : (
					items.length > 0 && (
						<p className="font-medium text-gray-400 text-xs">
							✓ All {total} Medical Representatives loaded.
						</p>
					)
				)}
			</div>
		</div>
	);
}
