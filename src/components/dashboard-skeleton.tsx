export function DashboardSkeleton() {
	return (
		<div className="w-full animate-pulse space-y-6">
			{/* Top Header & Filters Skeleton */}
			<div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
				<div className="h-8 w-1/3 rounded-lg bg-gray-200"></div>
				<div className="flex w-full gap-2 md:w-auto">
					<div className="h-10 w-32 rounded-xl bg-gray-200"></div>
					<div className="h-10 w-48 rounded-xl bg-gray-200"></div>
				</div>
			</div>

			{/* Tabs Row Skeleton */}
			<div className="mt-6 flex gap-6 border-gray-200 border-b px-4">
				<div className="mb-2 h-6 w-24 rounded bg-gray-200"></div>
				<div className="mb-2 h-6 w-24 rounded bg-gray-200"></div>
				<div className="mb-2 h-6 w-24 rounded bg-gray-200"></div>
			</div>

			{/* 3 KPI Cards Skeleton */}
			<div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
				{[1, 2, 3].map((i) => (
					<div
						className="relative h-32 overflow-hidden rounded-3xl bg-gray-100 p-6 shadow-sm"
						key={i}
					>
						<div className="mb-4 h-4 w-1/2 rounded bg-gray-200"></div>
						<div className="h-10 w-3/4 rounded bg-gray-200"></div>
					</div>
				))}
			</div>

			{/* Tables Row Skeleton */}
			<div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-2">
				<div className="space-y-4">
					<div className="h-6 w-1/3 rounded bg-gray-200"></div>
					<div className="h-64 overflow-hidden rounded-2xl border border-gray-100 bg-white">
						<div className="h-12 w-full border-gray-100 border-b bg-gray-50"></div>
						<div className="space-y-4 p-4">
							{[1, 2, 3, 4].map((i) => (
								<div className="flex justify-between" key={i}>
									<div className="h-4 w-1/4 rounded bg-gray-100"></div>
									<div className="h-4 w-1/4 rounded bg-gray-100"></div>
									<div className="h-4 w-1/4 rounded bg-gray-100"></div>
								</div>
							))}
						</div>
					</div>
				</div>
				<div className="space-y-4">
					<div className="h-6 w-1/3 rounded bg-gray-200"></div>
					<div className="h-64 overflow-hidden rounded-2xl border border-gray-100 bg-white">
						<div className="h-12 w-full border-gray-100 border-b bg-gray-50"></div>
						<div className="space-y-4 p-4">
							{[1, 2, 3, 4].map((i) => (
								<div className="flex justify-between" key={i}>
									<div className="h-4 w-1/3 rounded bg-gray-100"></div>
									<div className="h-4 w-1/3 rounded bg-gray-100"></div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
