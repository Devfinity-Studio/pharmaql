import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { getTenantAction } from "@/modules/control-plane/tenantActions";
import { TenantForm } from "@/components/tenant-form";

export const metadata: Metadata = {
	title: "Edit Client Tenant | Devfinity Control Center",
	description: "Manage client organization settings, custom domain, and ERP credentials.",
};

interface EditTenantPageProps {
	params: Promise<{ id: string }>;
}

export default async function EditTenantPage({ params }: EditTenantPageProps) {
	const { id } = await params;
	const res = await getTenantAction(id);

	if (!res.success || !res.tenant) {
		return (
			<div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
				<div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
					<div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
						<AlertCircle className="w-6 h-6" />
					</div>
					<h2 className="text-lg font-bold text-white">Tenant Not Found</h2>
					<p className="text-sm text-slate-400">
						The tenant with identifier <code className="text-rose-400">{id}</code> could not be located in
						the control plane.
					</p>
					<Link
						href="/admin/tenants"
						className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
					>
						<ArrowLeft className="w-4 h-4" />
						Return to Tenants List
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
			<TenantForm mode="edit" initialTenant={res.tenant} />
		</div>
	);
}
