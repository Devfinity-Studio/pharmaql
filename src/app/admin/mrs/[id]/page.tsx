import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MrDashboardContent } from "@/components/mr-dashboard-content";

export default async function AdminMRDeepDivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const awaitedParams = await params;
  const awaitedSearchParams = await searchParams;

  return (
    <MrDashboardContent
      mrId={awaitedParams.id}
      searchParams={awaitedSearchParams}
      isAdminView={true}
    />
  );
}
