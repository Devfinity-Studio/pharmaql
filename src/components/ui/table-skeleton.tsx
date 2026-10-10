import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full border rounded-lg overflow-hidden">
      <div className="bg-gray-50 flex border-b px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`header-${i}`} className="flex-1 px-2">
            <Skeleton className="h-4 w-24 bg-gray-300" />
          </div>
        ))}
      </div>
      <div className="bg-white">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex border-b px-4 py-4 last:border-0">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={`col-${rowIndex}-${colIndex}`} className="flex-1 px-2">
                <Skeleton className="h-4 w-full max-w-[120px] bg-gray-200" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
