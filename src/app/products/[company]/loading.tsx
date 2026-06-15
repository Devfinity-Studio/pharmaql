export default function CompanyProductsLoading() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="h-6 bg-gray-200 rounded w-40 animate-pulse"></div>
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
        <div className="space-y-6 w-full">
          {/* Filters skeleton */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-10 bg-gray-100 rounded-xl w-full border border-gray-200"></div>
            </div>
            <div>
              <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
              <div className="h-10 bg-gray-100 rounded-xl w-full border border-gray-200"></div>
            </div>
            <div>
              <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
              <div className="h-10 bg-gray-100 rounded-xl w-full border border-gray-200"></div>
            </div>
          </div>

          {/* Table skeleton */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-96">
            <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center px-6 gap-8">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="p-6 space-y-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-8">
                  <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/6"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/6"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
