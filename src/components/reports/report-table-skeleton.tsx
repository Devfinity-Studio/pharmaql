import React from "react";

export function ReportTableSkeleton() {
	return (
		<div className="mt-4 animate-pulse space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
			{/* Header silhouette */}
			<div className="flex flex-col gap-3 border-gray-200 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="h-10 w-28 rounded-lg bg-gray-200" />
					<div className="space-y-1.5">
						<div className="h-4 w-48 rounded bg-gray-200" />
						<div className="h-3 w-64 rounded bg-gray-100" />
					</div>
				</div>
				<div className="h-6 w-32 rounded-full bg-blue-100" />
			</div>

			{/* Filter bar silhouette */}
			<div className="flex items-center justify-between gap-4 py-2">
				<div className="h-4 w-40 rounded bg-gray-200" />
				<div className="flex gap-2">
					<div className="h-8 w-20 rounded-lg bg-gray-100" />
					<div className="h-8 w-20 rounded-lg bg-gray-100" />
				</div>
			</div>

			{/* Table rows silhouette */}
			<div className="space-y-2 pt-2">
				<div className="h-9 w-full rounded bg-gray-100" />
				<div className="h-7 w-full rounded bg-gray-100/70" />
				<div className="h-7 w-full rounded bg-gray-100/70" />
				<div className="h-7 w-full rounded bg-gray-100/70" />
				<div className="h-7 w-full rounded bg-gray-100/70" />
				<div className="h-7 w-full rounded bg-gray-100/70" />
				<div className="h-7 w-full rounded bg-gray-100/70" />
				<div className="h-8 w-full rounded bg-blue-50/60" />
			</div>
		</div>
	);
}
