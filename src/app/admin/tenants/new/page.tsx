import React from "react";
import type { Metadata } from "next";
import { TenantForm } from "@/components/tenant-form";

export const metadata: Metadata = {
	title: "Onboard New Client Organization | Devfinity Control Center",
	description: "Add a new client tenant with dedicated routing, custom domain, and ERP configuration.",
};

export default function NewTenantPage() {
	return (
		<div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
			<TenantForm mode="create" />
		</div>
	);
}
