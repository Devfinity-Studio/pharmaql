export default function GlobalLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center">
          {/* Outer pulsing ring */}
          <div className="absolute h-24 w-24 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"></div>
          {/* Inner pulsing core */}
          <div className="h-16 w-16 animate-pulse rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400"></div>
        </div>
        <div className="animate-pulse font-bold text-gray-400 text-xl tracking-tight">
          Loading...
        </div>
      </div>
    </div>
  );
}
