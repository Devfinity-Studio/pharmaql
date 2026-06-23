export default function ProductsLoading() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 pt-24 pb-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center">
        <div className="mb-4 h-10 w-64 animate-pulse rounded bg-gray-200"></div>
        <div className="mb-12 h-6 w-96 max-w-full animate-pulse rounded bg-gray-200"></div>

        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              className="flex h-24 animate-pulse items-center justify-center rounded-2xl border border-gray-50 bg-gray-100 p-8 shadow-sm"
              key={i}
            >
              <div className="h-6 w-32 rounded bg-gray-200"></div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
