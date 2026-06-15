export default function AdminDashboardLoading() {
  return (
    <div className="space-y-8 mt-4 animate-pulse w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-96"></div>
        </div>
        <div className="flex gap-4">
          <div className="h-10 bg-gray-200 rounded-xl w-32"></div>
          <div className="h-10 bg-gray-200 rounded-xl w-32"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-32 flex flex-col justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-10 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-32 flex flex-col justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-10 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="h-6 bg-gray-200 rounded w-48"></div>
        <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden h-96">
          <div className="h-12 bg-gray-50 border-b border-gray-100 px-6 flex items-center gap-8">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
          <div className="p-6 space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-8">
                <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                <div className="h-4 bg-gray-100 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
