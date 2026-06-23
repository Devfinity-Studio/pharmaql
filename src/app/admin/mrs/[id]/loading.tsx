import { DashboardSkeleton } from "@/components/dashboard-skeleton";

export default function AdminMrLoading() {
	return (
		<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
				<div>
					<div className="mb-2 h-4 w-24 animate-pulse rounded bg-gray-200"></div>
					<div className="h-8 w-64 animate-pulse rounded bg-gray-200"></div>
				</div>
			</div>
			<DashboardSkeleton />
		</div>
	);
}
