export default function AdminMRsLoading() {
  return (
    <div className="mt-4 animate-pulse space-y-8">
      <div>
        <div className="mb-2 h-8 w-80 rounded bg-gray-200"></div>
        <div className="h-4 w-96 rounded bg-gray-200"></div>
      </div>

      {/* Search Bar Skeleton */}
      <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="h-12 flex-grow rounded-xl border border-gray-100 bg-gray-50"></div>
        <div className="h-12 w-24 rounded-xl bg-gray-200"></div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            className="relative flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
            key={i}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 h-6 w-32 rounded bg-gray-200"></div>
                <div className="h-4 w-48 rounded bg-gray-200"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-16 rounded bg-gray-200"></div>
                <div className="h-6 w-20 rounded bg-gray-200"></div>
              </div>
            </div>

            <div className="flex-grow space-y-4">
              <div className="h-4 w-32 rounded bg-gray-200"></div>
              <div className="space-y-2">
                <div className="h-10 w-full rounded-xl border border-gray-100 bg-gray-50"></div>
                <div className="h-10 w-full rounded-xl border border-gray-100 bg-gray-50"></div>
              </div>
            </div>

            <div className="mt-6 space-y-4 border-gray-100 border-t pt-4">
              <div className="h-4 w-24 rounded bg-gray-200"></div>
              <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="mb-2 h-4 w-1/2 rounded bg-gray-200"></div>
                <div className="mb-2 h-4 w-1/2 rounded bg-gray-200"></div>
                <div className="mb-4 h-4 w-1/2 rounded bg-gray-200"></div>
                <div className="h-3 w-32 rounded bg-gray-200"></div>
              </div>
            </div>

            <div className="mt-6 flex gap-2 border-gray-100 border-t pt-4">
              <div className="h-10 flex-grow rounded-xl border border-gray-100 bg-gray-50"></div>
              <div className="h-10 w-20 rounded-xl bg-gray-200"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
