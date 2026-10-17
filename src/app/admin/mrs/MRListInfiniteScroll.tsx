"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MRDisplayItem } from "@/server/actions/mrInfo";
import { fetchMRsPage } from "@/server/actions/mrInfo";
import { toggleMRBlockStatus } from "@/server/actions/mrs";

interface Props {
	initialItems: MRDisplayItem[];
	initialTotal: number;
	initialHasMore: boolean;
	allManufacturers?: Array<{
		manufacturer: string | null;
		division: string | null;
	}>;
	searchQuery: string;
	sortQuery: string;
}

function formatLastLogin(timestamp?: string | null): string {
	if (!timestamp) return "Never logged in";
	try {
		const d = new Date(timestamp);
		if (isNaN(d.getTime())) return "Never logged in";
		return d.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "Never logged in";
	}
}

export function MRListInfiniteScroll({
	initialItems,
	initialTotal,
	initialHasMore,
	searchQuery,
	sortQuery,
}: Props) {
	const [items, setItems] = useState<MRDisplayItem[]>(initialItems);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(initialHasMore);
	const [total, setTotal] = useState(initialTotal);
	const [isLoading, setIsLoading] = useState(false);
	const [actionPendingId, setActionPendingId] = useState<string | null>(null);

	const observerRef = useRef<HTMLDivElement | null>(null);

	// Synchronize when search or sort query changes
	useEffect(() => {
		setItems(initialItems);
		setPage(1);
		setHasMore(initialHasMore);
		setTotal(initialTotal);
	}, [initialItems, initialHasMore, initialTotal, searchQuery, sortQuery]);

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
					const isBusy = actionPendingId === mr.id;

					return (
						<div
							className={`relative flex h-full flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md ${
								isBusy ? "opacity-75" : ""
							}`}
							key={mr.id}
						>
							<div className="space-y-4">
								{/* Card Header: Name, Block Status, Action Buttons */}
								<div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
									<div>
										<div className="flex items-center gap-2">
											<h3 className="font-bold text-gray-900 text-xl">
												{mr.name}
											</h3>
											{mr.isBlocked && (
												<span className="rounded-full bg-red-100 px-2.5 py-0.5 font-bold text-[10px] text-red-700">
													Blocked
												</span>
											)}
										</div>
										<p className="text-gray-500 text-sm">{mr.email}</p>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<button
											className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-bold text-xs transition ${
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
											className="whitespace-nowrap rounded-lg bg-blue-50 px-3 py-1.5 font-bold text-blue-700 text-xs transition hover:bg-blue-100"
											href={`/admin/mrs/${mr.id}`}
										>
											View Data &rarr;
										</Link>
									</div>
								</div>

								{/* Info Box: Last Login, Division & Manufacturer */}
								<div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3.5 text-xs">
									<div className="flex items-center justify-between">
										<span className="font-semibold text-gray-500 uppercase tracking-wider text-[11px]">
											Last Login
										</span>
										<span className="font-medium text-gray-900">
											{formatLastLogin(mr.lastLogin)}
										</span>
									</div>
									<div className="border-gray-200/60 border-t pt-2 flex flex-col gap-1.5">
										<div className="flex items-start justify-between gap-2">
											<span className="font-semibold text-gray-500 uppercase tracking-wider text-[11px]">
												Manufacturer
											</span>
											<span className="font-medium text-gray-900 text-right">
												{mr.company || "Not assigned"}
											</span>
										</div>
										<div className="flex flex-col gap-1.5 pt-1 border-t border-gray-100">
											<div className="flex items-center justify-between">
												<span className="font-semibold text-gray-500 uppercase tracking-wider text-[11px]">
													Assigned Divisions ({mr.assignments && mr.assignments.length > 0 ? mr.assignments.length : 1})
												</span>
											</div>
											<div className="flex flex-wrap gap-1">
												{(mr.assignments && mr.assignments.length > 0
													? Array.from(new Set(mr.assignments.map((a) => a.division).filter(Boolean)))
													: mr.division ? [mr.division] : []
												).map((divName) => (
													<span
														key={divName}
														className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-bold text-blue-800 text-[11px]"
													>
														{divName}
													</span>
												))}
											</div>
										</div>
									</div>
								</div>

								{/* Rank Section (Read-only from database) */}
								<div>
									<div className="flex items-center justify-between">
										<span className="font-bold uppercase tracking-wider text-gray-500 text-[11px]">
											MR Rank
										</span>
									</div>
									<div className="mt-1.5">
										<span
											className={`inline-flex items-center rounded-lg px-2.5 py-1 font-bold text-xs ${
												mr.rank === 1
													? "border border-amber-200 bg-amber-50 text-amber-800"
													: mr.rank === 2
														? "border border-blue-200 bg-blue-50 text-blue-800"
														: "border border-purple-200 bg-purple-50 text-purple-800"
											}`}
										>
											Rank {mr.rank} &bull;{" "}
											{mr.rank === 1
												? "Stock Reports Only"
												: mr.rank === 2
													? "Stock & Claim Qty Reports"
													: "All Reports Access"}
										</span>
									</div>
								</div>
							</div>

							{/* Current Permissions Section (Read-only badges) */}
							<div className="mt-4 border-gray-100 border-t pt-3">
								<span className="font-bold uppercase tracking-wider text-gray-500 text-[11px]">
									Active Report Permissions
								</span>
								<div className="mt-2 flex flex-wrap gap-1.5">
									<span
										className={`inline-flex items-center rounded-md px-2 py-0.5 font-semibold text-[11px] ${
											mr.canViewStock
												? "border border-emerald-200 bg-emerald-50 text-emerald-700"
												: "border border-gray-100 bg-gray-50 text-gray-400 line-through"
										}`}
									>
										{mr.canViewStock ? "✓" : "✕"} Stock
									</span>
									<span
										className={`inline-flex items-center rounded-md px-2 py-0.5 font-semibold text-[11px] ${
											mr.canViewFreeScheme
												? "border border-emerald-200 bg-emerald-50 text-emerald-700"
												: "border border-gray-100 bg-gray-50 text-gray-400 line-through"
										}`}
									>
										{mr.canViewFreeScheme ? "✓" : "✕"} Claim Qty
									</span>
									<span
										className={`inline-flex items-center rounded-md px-2 py-0.5 font-semibold text-[11px] ${
											mr.canViewSales
												? "border border-emerald-200 bg-emerald-50 text-emerald-700"
												: "border border-gray-100 bg-gray-50 text-gray-400 line-through"
										}`}
									>
										{mr.canViewSales ? "✓" : "✕"} Sales Overview
									</span>
									<span
										className={`inline-flex items-center rounded-md px-2 py-0.5 font-semibold text-[11px] ${
											mr.canViewProductWise
												? "border border-emerald-200 bg-emerald-50 text-emerald-700"
												: "border border-gray-100 bg-gray-50 text-gray-400 line-through"
										}`}
									>
										{mr.canViewProductWise ? "✓" : "✕"} Product Wise
									</span>
									<span
										className={`inline-flex items-center rounded-md px-2 py-0.5 font-semibold text-[11px] ${
											mr.canViewPartyWise
												? "border border-emerald-200 bg-emerald-50 text-emerald-700"
												: "border border-gray-100 bg-gray-50 text-gray-400 line-through"
										}`}
									>
										{mr.canViewPartyWise ? "✓" : "✕"} Party Wise
									</span>
								</div>
							</div>
						</div>
					);
				})}

				{/* Loading skeleton placeholder cards */}
				{isLoading && (
					<>
						<div className="h-64 animate-pulse rounded-2xl border border-gray-100 bg-gray-100/60 p-6" />
						<div className="h-64 animate-pulse rounded-2xl border border-gray-100 bg-gray-100/60 p-6" />
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
