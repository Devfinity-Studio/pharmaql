export default function GlobalLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-transparent">
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex items-center justify-center">
          {/* Outer pulsing ring */}
          <div className="absolute h-24 w-24 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"></div>
          {/* Inner pulsing core */}
          <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 animate-pulse"></div>
        </div>
        <div className="text-xl font-bold tracking-tight text-gray-400 animate-pulse">
          Loading...
        </div>
      </div>
    </div>
  );
}
