import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DevControlCenter } from "@/components/dev-control-center";
import { getLicenseStatus } from "@/lib/license";
import { getFeatureToggles, getMaintenanceConfig } from "@/lib/maintenance";
import { getMaskedEnvInspection, getRuntimeConfig } from "@/lib/runtime-config";
import {
	getServiceHealthTelemetry,
	getUnifiedSystemLogs,
} from "@/server/actions/devDiagnostics";
import { fetchMRsPage } from "@/server/actions/mrInfo";
import { auth } from "@/server/auth";

export const metadata = {
	title: "Developer Control Center | PharmaQL | Asmee Pharma",
};

export const dynamic = "force-dynamic";

export default async function DeveloperControlPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session || session.user.role !== "DEVELOPER") {
		redirect("/admin/dashboard");
	}

	const [
		healthReport,
		licenseStatus,
		featureToggles,
		maintenanceConfig,
		runtimeConfig,
		initialLogs,
		mrPageData,
	] = await Promise.all([
		getServiceHealthTelemetry(),
		getLicenseStatus(),
		getFeatureToggles(),
		getMaintenanceConfig(),
		getRuntimeConfig(),
		getUnifiedSystemLogs({ limit: 100 }),
		fetchMRsPage({ page: 1, limit: 100 }),
	]);

	const maskedEnv = getMaskedEnvInspection();
	const mrList = mrPageData.items.map((m) => ({
		id: m.id,
		name: m.name,
		email: m.email || "",
		division: m.division,
		company: m.company,
		rank: m.rank,
	}));

	return (
		<DevControlCenter
			featureToggles={featureToggles}
			healthReport={healthReport}
			initialLogs={initialLogs}
			licenseStatus={licenseStatus}
			maintenanceConfig={maintenanceConfig}
			maskedEnv={maskedEnv}
			mrList={mrList}
			runtimeConfig={runtimeConfig}
		/>
	);
}
