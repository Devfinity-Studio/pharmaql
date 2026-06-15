export default function AdminMRsLoading() {
  return (
    <div className="space-y-8 mt-4 animate-pulse">
      <div>
        <div className="h-8 bg-gray-200 rounded w-80 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-96"></div>
      </div>

      {/* Search Bar Skeleton */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
        <div className="flex-grow h-12 bg-gray-50 rounded-xl border border-gray-100"></div>
        <div className="h-12 w-24 bg-gray-200 rounded-xl"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-full relative"
          >
            <div className="mb-4 flex justify-between items-start gap-4">
              <div>
                <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-48"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 bg-gray-200 rounded w-16"></div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            </div>

            <div className="flex-grow space-y-4">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="space-y-2">
                <div className="h-10 bg-gray-50 border border-gray-100 rounded-xl w-full"></div>
                <div className="h-10 bg-gray-50 border border-gray-100 rounded-xl w-full"></div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 space-y-4">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-32"></div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex gap-2">
              <div className="h-10 bg-gray-50 border border-gray-100 rounded-xl flex-grow"></div>
              <div className="h-10 w-20 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
