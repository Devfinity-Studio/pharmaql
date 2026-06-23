export default function CompanyProductsLoading() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      <div className="border-gray-200 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="h-6 w-40 animate-pulse rounded bg-gray-200"></div>
          <div className="h-6 w-48 animate-pulse rounded bg-gray-200"></div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl flex-1 animate-pulse px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full space-y-6">
          {/* Filters skeleton */}
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:grid-cols-3">
            <div>
              <div className="mb-2 h-4 w-24 rounded bg-gray-200"></div>
              <div className="h-10 w-full rounded-xl border border-gray-200 bg-gray-100"></div>
            </div>
            <div>
              <div className="mb-2 h-4 w-32 rounded bg-gray-200"></div>
              <div className="h-10 w-full rounded-xl border border-gray-200 bg-gray-100"></div>
            </div>
            <div>
              <div className="mb-2 h-4 w-20 rounded bg-gray-200"></div>
              <div className="h-10 w-full rounded-xl border border-gray-200 bg-gray-100"></div>
            </div>
          </div>

          {/* Table skeleton */}
          <div className="h-96 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex h-12 items-center gap-8 border-gray-200 border-b bg-gray-50 px-6">
              <div className="h-4 w-32 rounded bg-gray-200"></div>
              <div className="h-4 w-32 rounded bg-gray-200"></div>
              <div className="h-4 w-24 rounded bg-gray-200"></div>
              <div className="h-4 w-24 rounded bg-gray-200"></div>
            </div>
            <div className="space-y-6 p-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div className="flex gap-8" key={i}>
                  <div className="h-4 w-1/4 rounded bg-gray-100"></div>
                  <div className="h-4 w-1/4 rounded bg-gray-100"></div>
                  <div className="h-4 w-1/6 rounded bg-gray-100"></div>
                  <div className="h-4 w-1/6 rounded bg-gray-100"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
