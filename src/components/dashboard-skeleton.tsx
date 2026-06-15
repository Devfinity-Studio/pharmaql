export function DashboardSkeleton() {
  return (
    <div className="w-full animate-pulse space-y-6">
      {/* Top Header & Filters Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="h-8 bg-gray-200 rounded-lg w-1/3"></div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="h-10 bg-gray-200 rounded-xl w-32"></div>
          <div className="h-10 bg-gray-200 rounded-xl w-48"></div>
        </div>
      </div>

      {/* Tabs Row Skeleton */}
      <div className="flex border-b border-gray-200 mt-6 gap-6 px-4">
        <div className="h-6 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-6 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-6 bg-gray-200 rounded w-24 mb-2"></div>
      </div>

      {/* 3 KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-gray-100 rounded-3xl p-6 shadow-sm h-32 relative overflow-hidden"
          >
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>

      {/* Tables Row Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden h-64">
            <div className="h-12 bg-gray-50 border-b border-gray-100 w-full"></div>
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden h-64">
            <div className="h-12 bg-gray-50 border-b border-gray-100 w-full"></div>
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
