import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { MrDashboardContent } from "@/components/mr-dashboard-content";

export default async function AdminMRViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    division?: string;
    from?: string;
    to?: string;
    tab?: string;
    product?: string;
    party?: string;
  }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const awaitedParams = await searchParams;

  const mrArr = await db.select().from(user).where(eq(user.id, id)).limit(1);
  if (mrArr.length === 0) {
    notFound();
  }

  return (
    <MrDashboardContent
      mrId={id}
      isAdminView={true}
      searchParams={{
        division: awaitedParams.division,
        from: awaitedParams.from,
        to: awaitedParams.to,
        tab: awaitedParams.tab,
        product: awaitedParams.product,
        party: awaitedParams.party,
      }}
    />
  );
}
