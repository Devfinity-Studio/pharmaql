import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({
	rows = 5,
	columns = 4,
}: {
	rows?: number;
	columns?: number;
}) {
	return (
		<div className="w-full overflow-hidden rounded-lg border border-gray-200 ring-1 ring-black/5">
			<div className="flex border-b border-gray-200 bg-gray-50 px-4 py-3">
				{Array.from({ length: columns }).map((_, i) => (
					<div className="flex-1 px-2" key={`header-${i}`}>
						<Skeleton className="h-4 w-24 bg-gray-300" />
					</div>
				))}
			</div>
			<div className="bg-white">
				{Array.from({ length: rows }).map((_, rowIndex) => (
					<div
						className="flex border-b border-gray-200 px-4 py-4 last:border-0"
						key={`row-${rowIndex}`}
					>
						{Array.from({ length: columns }).map((_, colIndex) => (
							<div className="flex-1 px-2" key={`col-${rowIndex}-${colIndex}`}>
								<Skeleton className="h-4 w-full max-w-[120px] bg-gray-200" />
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
}
