export default function AdminDashboardLoading() {
  return (
    <div className="mx-auto mt-4 w-full max-w-7xl animate-pulse space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-2 h-8 w-64 rounded bg-gray-200"></div>
          <div className="h-4 w-96 rounded bg-gray-200"></div>
        </div>
        <div className="flex gap-4">
          <div className="h-10 w-32 rounded-xl bg-gray-200"></div>
          <div className="h-10 w-32 rounded-xl bg-gray-200"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex h-32 flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="h-4 w-1/2 rounded bg-gray-200"></div>
          <div className="h-10 w-1/4 rounded bg-gray-200"></div>
        </div>
        <div className="flex h-32 flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="h-4 w-1/2 rounded bg-gray-200"></div>
          <div className="h-10 w-1/4 rounded bg-gray-200"></div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="h-6 w-48 rounded bg-gray-200"></div>
        <div className="h-96 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex h-12 items-center gap-8 border-gray-100 border-b bg-gray-50 px-6">
            <div className="h-4 w-1/3 rounded bg-gray-200"></div>
            <div className="h-4 w-1/4 rounded bg-gray-200"></div>
            <div className="h-4 w-1/4 rounded bg-gray-200"></div>
          </div>
          <div className="space-y-6 p-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div className="flex gap-8" key={i}>
                <div className="h-4 w-1/3 rounded bg-gray-100"></div>
                <div className="h-4 w-1/4 rounded bg-gray-100"></div>
                <div className="h-4 w-1/4 rounded bg-gray-100"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
