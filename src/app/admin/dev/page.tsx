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
import { fetchMRsPage, getAllMarketingCompaniesWithDivisions } from "@/server/actions/mrInfo";
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
		companiesData,
	] = await Promise.all([
		getServiceHealthTelemetry(),
		getLicenseStatus(),
		getFeatureToggles(),
		getMaintenanceConfig(),
		getRuntimeConfig(),
		getUnifiedSystemLogs({ limit: 100 }),
		fetchMRsPage({ page: 1, limit: 100 }),
		getAllMarketingCompaniesWithDivisions().catch(() => []),
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

	// Deduplicate and assemble companies list for procedure sandbox search
	const companyMap = new Map<string, { companyCode: string; companyName: string; divisionName: string }>();

	(companiesData || []).forEach((c) => {
		const code = String(c.companyCode || "").trim();
		if (!code) return;
		const key = `${code}_${c.divisionName || ""}`;
		companyMap.set(key, {
			companyCode: code,
			companyName: String(c.companyName || code).trim(),
			divisionName: String(c.divisionName || "").trim(),
		});
	});

	// Augment with MR assignments to guarantee comprehensive coverage
	mrPageData.items.forEach((m) => {
		const code = (m.companyCode || "").trim();
		const compName = (m.company || code).trim();
		if (code) {
			const key = `${code}_${m.division || ""}`;
			if (!companyMap.has(key)) {
				companyMap.set(key, {
					companyCode: code,
					companyName: compName,
					divisionName: m.division || "",
				});
			}
		}
	});

	// Ensure standard Asmee Pharma code 11 is always in the list
	if (!Array.from(companyMap.values()).some((c) => c.companyCode === "11")) {
		companyMap.set("11_Generics", {
			companyCode: "11",
			companyName: "Asmee Pharma Pvt. Ltd.",
			divisionName: "Generics",
		});
	}

	const companiesList = Array.from(companyMap.values()).sort((a, b) =>
		a.companyName.localeCompare(b.companyName),
	);

	return (
		<DevControlCenter
			companiesList={companiesList}
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
