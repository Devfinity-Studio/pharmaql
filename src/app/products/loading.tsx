export default function ProductsLoading() {
  return (
    <main className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col items-center w-full">
        <div className="h-10 bg-gray-200 rounded w-64 mb-4 animate-pulse"></div>
        <div className="h-6 bg-gray-200 rounded w-96 max-w-full mb-12 animate-pulse"></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="bg-gray-100 rounded-2xl h-24 p-8 flex items-center justify-center shadow-sm border border-gray-50 animate-pulse"
            >
              <div className="h-6 bg-gray-200 rounded w-32"></div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
