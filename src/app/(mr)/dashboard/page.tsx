import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MrDashboardContent } from "@/components/mr-dashboard-content";

export default async function MRDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string; from?: string; to?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "MR") {
    redirect("/login");
  }

  const awaitedParams = await searchParams;

  return (
    <MrDashboardContent
      mrId={session.user.id}
      searchParams={{
        division: awaitedParams.division,
        from: awaitedParams.from,
        to: awaitedParams.to,
      }}
      isAdminView={false}
    />
  );
}
