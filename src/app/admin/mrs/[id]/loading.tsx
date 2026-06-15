import { DashboardSkeleton } from "@/components/dashboard-skeleton";

export default function AdminMrLoading() {
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
        </div>
      </div>
      <DashboardSkeleton />
    </div>
  );
}
