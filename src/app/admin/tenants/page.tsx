import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { listTenantsAction } from "@/modules/control-plane/tenantActions";
import { TenantsControlCenter } from "@/components/tenants-control-center";

export const metadata = {
	title: "Multi-Tenant Control Center | PharmaQL Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminTenantsPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "DEVELOPER")
	) {
		redirect("/login");
	}

	const res = await listTenantsAction();
	const initialTenants = res.success ? res.tenants : [];

	return (
		<div className="max-w-7xl mx-auto py-2">
			<TenantsControlCenter initialTenants={initialTenants} />
		</div>
	);
}
