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
import { getAllMRsForDev, getAllMarketingCompaniesWithDivisions } from "@/server/actions/mrInfo";
import { listTenantsAction } from "@/modules/control-plane/tenantActions";
import { auth } from "@/server/auth";

export const metadata = {
	title: "Developer Platform Control Center | Devfinity PharmaQL",
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
		allDevMRs,
		companiesData,
		tenantsRes,
	] = await Promise.all([
		getServiceHealthTelemetry(),
		getLicenseStatus(),
		getFeatureToggles(),
		getMaintenanceConfig(),
		getRuntimeConfig(),
		getUnifiedSystemLogs({ limit: 100 }),
		getAllMRsForDev(),
		getAllMarketingCompaniesWithDivisions().catch(() => []),
		listTenantsAction(),
	]);

	const tenants = tenantsRes.success ? tenantsRes.tenants : [];

	const maskedEnv = getMaskedEnvInspection();
	const mrList = allDevMRs.map((m) => ({
		id: m.id,
		name: m.name,
		email: m.email || "",
		division: m.division,
		company: m.company,
		companyCode: m.companyCode,
		rank: m.rank,
		isBlocked: m.isBlocked,
		assignedCompanies: Array.from(
			new Set(
				(m.assignments || [])
					.map((a) => a.company || a.manufacturer)
					.filter(Boolean),
			),
		),
		assignedDivisions: Array.from(
			new Set(
				(m.assignments || [])
					.map((a) => a.division)
					.filter((d): d is string => Boolean(d)),
			),
		),
	}));

	// Deduplicate and assemble companies list for procedure sandbox search
	const companyMap = new Map<string, { companyCode: string; companyName: string; divisionName: string }>();

	(companiesData || []).forEach((c) => {
		const code = String(c.companyCode || "").trim();
		if (!code) return;
		const div = String(c.divisionName || "").trim();
		const key = `${code.toUpperCase()}_${div.toUpperCase()}`;
		if (!companyMap.has(key)) {
			companyMap.set(key, {
				companyCode: code,
				companyName: String(c.companyName || code).trim(),
				divisionName: div,
			});
		}
	});

	// Augment with MR assignments to guarantee comprehensive coverage
	allDevMRs.forEach((m) => {
		const code = (m.companyCode || "").trim();
		const compName = (m.company || code).trim();
		const div = (m.division || "").trim();
		if (code) {
			const key = `${code.toUpperCase()}_${div.toUpperCase()}`;
			if (!companyMap.has(key)) {
				companyMap.set(key, {
					companyCode: code,
					companyName: compName,
					divisionName: div,
				});
			}
		}

		(m.assignments || []).forEach((a) => {
			const aCode = (a.companyCode || "").trim();
			const aCompName = (a.company || aCode).trim();
			const aDiv = (a.division || "").trim();
			if (aCode) {
				const aKey = `${aCode.toUpperCase()}_${aDiv.toUpperCase()}`;
				if (!companyMap.has(aKey)) {
					companyMap.set(aKey, {
						companyCode: aCode,
						companyName: aCompName,
						divisionName: aDiv,
					});
				}
			}
		});
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
			tenants={tenants}
		/>
	);
}
