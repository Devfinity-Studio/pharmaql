import React from "react";
import Link from "next/link";
import { Building2, ShieldAlert } from "lucide-react";

export const metadata = {
	title: "Tenant Not Found | PharmaQL",
	description: "The requested domain is not configured on this portal.",
};

export default function TenantNotFoundPage() {
	return (
		<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-center">
			<div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
				<div className="mx-auto w-16 h-16 bg-red-950/60 border border-red-800/40 rounded-2xl flex items-center justify-center text-red-400">
					<ShieldAlert className="w-8 h-8" />
				</div>

				<div className="space-y-2">
					<h1 className="text-2xl font-bold tracking-tight text-white">
						Domain Not Configured
					</h1>
					<p className="text-sm text-slate-400">
						This domain is not associated with an active PharmaQL client portal or has been temporarily suspended.
					</p>
				</div>

				<div className="bg-slate-950 border border-slate-800/60 rounded-xl p-4 text-left space-y-2 text-xs text-slate-400 font-mono">
					<div className="flex items-center gap-2 text-slate-300 font-sans font-semibold">
						<Building2 className="w-4 h-4 text-emerald-400" />
						<span>Client Portal Routing</span>
					</div>
					<p>Please contact your pharmaceutical administrator to verify your portal access URL.</p>
				</div>

				<div className="pt-2">
					<p className="text-xs text-slate-600">
						Powered by Devfinity Cloud Platform
					</p>
				</div>
			</div>
		</div>
	);
}
