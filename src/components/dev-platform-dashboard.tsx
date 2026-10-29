import React from "react";
import Link from "next/link";
import {
	Building2,
	Users,
	Database,
	ShieldCheck,
	Globe,
	ArrowRight,
	Plus,
	ExternalLink,
	Megaphone,
	ShieldAlert,
	Wrench,
	Activity,
	CheckCircle2,
	AlertCircle,
	Server,
	Clock,
} from "lucide-react";
import { type TenantListItem } from "@/modules/control-plane/tenantActions";

interface DevPlatformDashboardProps {
	tenants: TenantListItem[];
	neonStatus: {
		connected: boolean;
		latencyMs: number;
		storageType: string;
	};
	totalNotices: number;
	clientOrigin: string;
}

export function DevPlatformDashboard({
	tenants,
	neonStatus,
	totalNotices,
	clientOrigin,
}: DevPlatformDashboardProps) {
	const totalTenants = tenants.length;
	const activeTenants = tenants.filter((t) => t.is_active).length;
	const inactiveTenants = totalTenants - activeTenants;

	return (
		<div className="space-y-8 pb-12">
			{/* Top Header Banner */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
				<div>
					<div className="flex items-center gap-2">
						<span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-md">
							Devfinity Cloud Platform
						</span>
						<span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
							<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
							Centralized Control Plane Active
						</span>
					</div>
					<h1 className="text-3xl font-extrabold text-white mt-1.5 tracking-tight">
						Master Platform Command Center
					</h1>
					<p className="text-xs text-slate-400">
						Global multi-tenant telemetry, client routing ingress, control plane health, and developer shortcuts.
					</p>
				</div>

				<div className="flex items-center gap-3">
					<Link
						href="/admin/tenants/new"
						className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
					>
						<Plus className="w-4 h-4" />
						Onboard New Tenant
					</Link>
					<Link
						href="/admin/dev"
						className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center gap-1.5"
					>
						<Wrench className="w-3.5 h-3.5 text-purple-400" />
						Developer Panel
					</Link>
				</div>
			</div>

			{/* Metric Cards Grid */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Card 1: Registered Tenants */}
				<div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-slate-400">Registered Client Tenants</p>
						<div className="flex items-baseline gap-2 mt-1">
							<h3 className="text-3xl font-black text-white">{totalTenants}</h3>
							<span className="text-xs text-emerald-400 font-semibold">
								{activeTenants} active / {inactiveTenants} paused
							</span>
						</div>
					</div>
					<div className="p-3.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
						<Building2 className="w-6 h-6" />
					</div>
				</div>

				{/* Card 2: Control Plane Neon Status */}
				<div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-slate-400">Neon Control Plane DB</p>
						<div className="flex items-baseline gap-2 mt-1">
							<h3 className="text-2xl font-black text-white">
								{neonStatus.connected ? "Operational" : "Fallback Store"}
							</h3>
						</div>
						<p className="text-[11px] text-slate-500 mt-0.5">
							{neonStatus.connected ? `Latency: ${neonStatus.latencyMs}ms roundtrip` : "Local data/tenants.json"}
						</p>
					</div>
					<div
						className={`p-3.5 rounded-xl border ${
							neonStatus.connected
								? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
								: "bg-amber-500/10 text-amber-400 border-amber-500/20"
						}`}
					>
						<Database className="w-6 h-6" />
					</div>
				</div>

				{/* Card 3: Broadcast Notices */}
				<div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-slate-400">Active Notice Board</p>
						<div className="flex items-baseline gap-2 mt-1">
							<h3 className="text-3xl font-black text-white">{totalNotices}</h3>
							<span className="text-xs text-indigo-400 font-semibold">Broadcasts</span>
						</div>
						<p className="text-[11px] text-slate-500 mt-0.5">Global announcements</p>
					</div>
					<div className="p-3.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
						<Megaphone className="w-6 h-6" />
					</div>
				</div>

				{/* Card 4: Platform Security & Ingress */}
				<div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-slate-400">Edge Domain Routing</p>
						<div className="flex items-baseline gap-2 mt-1">
							<h3 className="text-2xl font-black text-emerald-400">Enforced</h3>
						</div>
						<p className="text-[11px] text-slate-500 mt-0.5">Zero cross-tenant leakage</p>
					</div>
					<div className="p-3.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
						<ShieldCheck className="w-6 h-6" />
					</div>
				</div>
			</div>

			{/* Quick Platform Action Shortcuts */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<Link
					href="/admin/tenants"
					className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-800/50 transition-all group shadow-sm flex items-center justify-between"
				>
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-400">
							<Building2 className="w-4 h-4" />
						</div>
						<div>
							<h4 className="text-xs font-bold text-white group-hover:text-teal-400 transition-colors">
								Tenant Control Center
							</h4>
							<p className="text-[11px] text-slate-400">Manage client organizations</p>
						</div>
					</div>
					<ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 transition-colors" />
				</Link>

				<Link
					href="/admin/notices"
					className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all group shadow-sm flex items-center justify-between"
				>
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
							<Megaphone className="w-4 h-4" />
						</div>
						<div>
							<h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
								Notice Board
							</h4>
							<p className="text-[11px] text-slate-400">Broadcast announcements</p>
						</div>
					</div>
					<ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
				</Link>

				<Link
					href="/admin/audit"
					className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-800/50 transition-all group shadow-sm flex items-center justify-between"
				>
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400">
							<ShieldAlert className="w-4 h-4" />
						</div>
						<div>
							<h4 className="text-xs font-bold text-white group-hover:text-rose-400 transition-colors">
								Security & Audit Feed
							</h4>
							<p className="text-[11px] text-slate-400">Trace logins and system events</p>
						</div>
					</div>
					<ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition-colors" />
				</Link>

				<Link
					href="/admin/dev"
					className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/50 transition-all group shadow-sm flex items-center justify-between"
				>
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
							<Wrench className="w-4 h-4" />
						</div>
						<div>
							<h4 className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
								Developer Switchboard
							</h4>
							<p className="text-[11px] text-slate-400">Feature flags & maintenance</p>
						</div>
					</div>
					<ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
				</Link>
			</div>

			{/* Client Organizations Table Overview */}
			<div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
				<div className="p-5 border-b border-slate-800 flex items-center justify-between">
					<div>
						<h2 className="text-base font-bold text-white">Client Tenant Ingress & Status</h2>
						<p className="text-xs text-slate-400">
							Live tenant status badges, assigned domains, and quick preview links.
						</p>
					</div>
					<Link
						href="/admin/tenants"
						className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 transition-colors"
					>
						View All Tenants ({totalTenants})
						<ArrowRight className="w-3.5 h-3.5" />
					</Link>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-left text-xs">
						<thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
							<tr>
								<th className="px-5 py-3.5">Organization</th>
								<th className="px-5 py-3.5">Subdomain & Custom Domain</th>
								<th className="px-5 py-3.5">ERP Parameters</th>
								<th className="px-5 py-3.5">Status</th>
								<th className="px-5 py-3.5 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-800/60 text-slate-300">
							{tenants.map((t) => {
								const clientUrl = t.custom_domain
									? `https://${t.custom_domain}`
									: `${clientOrigin}?tenant=${t.slug}`;

								return (
									<tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
										<td className="px-5 py-4">
											<div className="flex items-center gap-3">
												{t.logo_url ? (
													<img
														src={t.logo_url}
														alt={t.display_name}
														className="w-8 h-8 rounded-lg object-contain bg-white/5 border border-slate-800 p-0.5"
													/>
												) : (
													<div
														className="w-8 h-8 rounded-lg border text-white font-black flex items-center justify-center text-xs"
														style={{
															backgroundColor: t.primary_color || "#0B2545",
															borderColor: t.accent_color || "#134074",
														}}
													>
														{t.display_name.charAt(0)}
													</div>
												)}
												<div>
													<p className="font-bold text-white text-xs">{t.display_name}</p>
													<p className="text-[11px] text-slate-400 font-mono">slug: {t.slug}</p>
												</div>
											</div>
										</td>

										<td className="px-5 py-4">
											<div className="space-y-1">
												<div className="flex items-center gap-1.5 font-mono text-[11px] text-teal-400">
													<Globe className="w-3.5 h-3.5" />
													{t.custom_domain ? (
														<span>{t.custom_domain}</span>
													) : (
														<span className="text-slate-500 italic">No custom domain</span>
													)}
												</div>
												<p className="text-[10px] text-slate-500 font-mono">
													{t.slug}.pharmaql.devfinity.net
												</p>
											</div>
										</td>

										<td className="px-5 py-4 font-mono text-[11px]">
											<p className="text-slate-300">DB: {t.legacy_db_name || "pdyasvmaster"}</p>
											<p className="text-slate-500 text-[10px]">
												Comp: {t.comp_no ?? 11} | Loc: {t.loc_no ?? 11}
											</p>
										</td>

										<td className="px-5 py-4">
											<span
												className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
													t.is_active
														? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
														: "bg-rose-500/10 text-rose-400 border border-rose-500/30"
												}`}
											>
												<span
													className={`w-1.5 h-1.5 rounded-full ${
														t.is_active ? "bg-emerald-400" : "bg-rose-400"
													}`}
												/>
												{t.is_active ? "Active" : "Suspended"}
											</span>
										</td>

										<td className="px-5 py-4 text-right">
											<div className="flex items-center justify-end gap-2">
												<a
													href={clientUrl}
													target="_blank"
													rel="noreferrer"
													className="p-1.5 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 transition-colors"
													title="Preview Client Portal"
												>
													<ExternalLink className="w-4 h-4" />
												</a>
												<Link
													href={`/admin/tenants/${t.id}`}
													className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
												>
													Manage
												</Link>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
