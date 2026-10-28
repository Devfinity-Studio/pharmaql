"use client";

import React, { useState, useMemo } from "react";
import {
	Building,
	Search,
	Plus,
	ExternalLink,
	Database,
	Server,
	CheckCircle2,
	XCircle,
	Activity,
	MoreVertical,
	Edit2,
	Trash2,
	RefreshCw,
	ShieldCheck,
	Loader2,
	Globe,
	Sparkles,
	Sliders,
} from "lucide-react";
import {
	type TenantListItem,
	listTenantsAction,
	toggleTenantStatusAction,
	deleteTenantAction,
	testApiServerConnectionAction,
} from "@/modules/control-plane/tenantActions";
import { TenantModal } from "@/components/tenant-modal";

interface TenantsControlCenterProps {
	initialTenants: TenantListItem[];
}

export function TenantsControlCenter({
	initialTenants,
}: TenantsControlCenterProps) {
	const [tenants, setTenants] = useState<TenantListItem[]>(initialTenants);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

	// Modal State
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingTenant, setEditingTenant] = useState<TenantListItem | null>(null);

	// Action States
	const [pingingId, setPingingId] = useState<string | null>(null);
	const [pingResults, setPingResults] = useState<Record<string, { latencyMs?: number; success: boolean; error?: string }>>({});
	const [togglingId, setTogglingId] = useState<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);

	const handleRefresh = async () => {
		setIsRefreshing(true);
		try {
			const res = await listTenantsAction();
			if (res.success) {
				setTenants(res.tenants);
			}
		} finally {
			setIsRefreshing(false);
		}
	};

	const handleToggleStatus = async (tenant: TenantListItem) => {
		setTogglingId(tenant.id);
		try {
			const nextStatus = !tenant.is_active;
			const res = await toggleTenantStatusAction(tenant.id, nextStatus);
			if (res.success) {
				setTenants((prev) =>
					prev.map((t) => (t.id === tenant.id ? { ...t, is_active: nextStatus } : t)),
				);
			}
		} finally {
			setTogglingId(null);
		}
	};

	const handleDelete = async (tenant: TenantListItem) => {
		if (
			!window.confirm(
				`Are you sure you want to permanently delete "${tenant.display_name}"? All associated data and configurations will be removed.`,
			)
		) {
			return;
		}

		try {
			const res = await deleteTenantAction(tenant.id);
			if (res.success) {
				setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
			}
		} catch (err: any) {
			alert(err.message || "Failed to delete tenant.");
		}
	};

	const handlePingApiServer = async (tenant: TenantListItem) => {
		setPingingId(tenant.id);
		try {
			const res = await testApiServerConnectionAction({ tenantId: tenant.id });
			setPingResults((prev) => ({
				...prev,
				[tenant.id]: {
					success: res.success,
					latencyMs: res.latencyMs,
					error: res.error,
				},
			}));
		} finally {
			setPingingId(null);
		}
	};

	const openCreateModal = () => {
		setEditingTenant(null);
		setIsModalOpen(true);
	};

	const openEditModal = (tenant: TenantListItem) => {
		setEditingTenant(tenant);
		setIsModalOpen(true);
	};

	// Metrics
	const totalCount = tenants.length;
	const activeCount = useMemo(() => tenants.filter((t) => t.is_active).length, [tenants]);
	const inactiveCount = totalCount - activeCount;

	// Filtered Tenants
	const filteredTenants = useMemo(() => {
		return tenants.filter((t) => {
			const matchesQuery =
				t.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(t.custom_domain && t.custom_domain.toLowerCase().includes(searchQuery.toLowerCase()));

			const matchesStatus =
				statusFilter === "all" ||
				(statusFilter === "active" && t.is_active) ||
				(statusFilter === "inactive" && !t.is_active);

			return matchesQuery && matchesStatus;
		});
	}, [tenants, searchQuery, statusFilter]);

	return (
		<div className="space-y-6">
			{/* Header / Intro */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
							Dev Portal Suite
						</span>
						<span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
							<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
							Control Plane Active (Dual Mode)
						</span>
					</div>
					<h1 className="text-2xl font-extrabold text-white mt-1 tracking-tight">
						Master Tenant Control Center
					</h1>
					<p className="text-xs text-gray-400">
						Manage client organizations, configure dynamic branding, ERP databases, CompNo/LocNo, and domain routing
					</p>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleRefresh}
						disabled={isRefreshing}
						className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-300 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl transition-all disabled:opacity-50"
					>
						<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
						Refresh
					</button>
					<button
						type="button"
						onClick={openCreateModal}
						className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02]"
					>
						<Plus className="w-4 h-4" />
						Onboard Client Tenant
					</button>
				</div>
			</div>

			{/* Metric Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="p-4 rounded-2xl bg-gray-900 border border-gray-800 shadow-sm flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-gray-400">Total Registered Tenants</p>
						<h3 className="text-2xl font-black text-white mt-1">{totalCount}</h3>
					</div>
					<div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
						<Building className="w-5 h-5" />
					</div>
				</div>

				<div className="p-4 rounded-2xl bg-gray-900 border border-gray-800 shadow-sm flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-gray-400">Active Routing Ingress</p>
						<h3 className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</h3>
					</div>
					<div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
						<CheckCircle2 className="w-5 h-5" />
					</div>
				</div>

				<div className="p-4 rounded-2xl bg-gray-900 border border-gray-800 shadow-sm flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-gray-400">Suspended / Inactive</p>
						<h3 className="text-2xl font-black text-amber-400 mt-1">{inactiveCount}</h3>
					</div>
					<div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
						<XCircle className="w-5 h-5" />
					</div>
				</div>

				<div className="p-4 rounded-2xl bg-gray-900 border border-gray-800 shadow-sm flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-gray-400">Control Plane Storage</p>
						<h3 className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
							<ShieldCheck className="w-4 h-4 text-emerald-400" />
							Dual-Mode Store
						</h3>
					</div>
					<div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
						<Database className="w-5 h-5" />
					</div>
				</div>
			</div>

			{/* Search & Filter Toolbar */}
			<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-gray-900/60 border border-gray-800 rounded-2xl">
				<div className="relative flex-1 max-w-md">
					<Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
					<input
						type="text"
						placeholder="Search by tenant name, slug, or domain..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
					/>
				</div>

				<div className="flex items-center gap-1 bg-gray-950 p-1 border border-gray-800 rounded-xl">
					<button
						type="button"
						onClick={() => setStatusFilter("all")}
						className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
							statusFilter === "all" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-200"
						}`}
					>
						All ({totalCount})
					</button>
					<button
						type="button"
						onClick={() => setStatusFilter("active")}
						className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
							statusFilter === "active" ? "bg-emerald-500/20 text-emerald-300" : "text-gray-400 hover:text-gray-200"
						}`}
					>
						Active ({activeCount})
					</button>
					<button
						type="button"
						onClick={() => setStatusFilter("inactive")}
						className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
							statusFilter === "inactive" ? "bg-amber-500/20 text-amber-300" : "text-gray-400 hover:text-gray-200"
						}`}
					>
						Inactive ({inactiveCount})
					</button>
				</div>
			</div>

			{/* Tenants Data Table */}
			<div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-xl">
				{filteredTenants.length === 0 ? (
					<div className="p-12 text-center space-y-3">
						<div className="w-12 h-12 mx-auto rounded-2xl bg-gray-800/80 border border-gray-700 flex items-center justify-center text-gray-400">
							<Building className="w-6 h-6" />
						</div>
						<h3 className="text-sm font-bold text-white">No tenants found</h3>
						<p className="text-xs text-gray-400 max-w-sm mx-auto">
							{searchQuery
								? `No tenants match your search "${searchQuery}". Try clearing the filter.`
								: "Get started by onboarding your first client organization."}
						</p>
						{!searchQuery && (
							<button
								type="button"
								onClick={openCreateModal}
								className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg transition-all"
							>
								<Plus className="w-3.5 h-3.5" />
								Onboard Client Tenant
							</button>
						)}
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead className="bg-gray-950/70 border-b border-gray-800 text-gray-400 uppercase tracking-wider font-semibold text-[10px]">
								<tr>
									<th className="px-5 py-3.5">Organization & Brand</th>
									<th className="px-5 py-3.5">Domain Ingress</th>
									<th className="px-5 py-3.5">ERP & SQL Config</th>
									<th className="px-5 py-3.5">Overdue Policy</th>
									<th className="px-5 py-3.5">Status</th>
									<th className="px-5 py-3.5">Live Ping</th>
									<th className="px-5 py-3.5 text-right">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-800/60 text-gray-300">
								{filteredTenants.map((tenant) => {
									const ping = pingResults[tenant.id];
									const isPinging = pingingId === tenant.id;
									const isToggling = togglingId === tenant.id;

									return (
										<tr key={tenant.id} className="hover:bg-gray-800/30 transition-colors">
											{/* Name, Brand Color & Slug */}
											<td className="px-5 py-4">
												<div className="flex items-center gap-3">
													{tenant.logo_url ? (
														<img
															src={tenant.logo_url}
															alt={tenant.display_name}
															className="w-8 h-8 rounded-lg object-contain bg-white/5 border border-gray-800 p-0.5"
														/>
													) : (
														<div
															className="w-8 h-8 rounded-lg border text-white font-black flex items-center justify-center text-xs"
															style={{
																backgroundColor: tenant.primary_color || "#0B2545",
																borderColor: tenant.accent_color || "#134074",
															}}
														>
															{tenant.display_name.charAt(0)}
														</div>
													)}
													<div>
														<div className="font-bold text-white text-sm flex items-center gap-1.5">
															{tenant.display_name}
															<span
																className="w-2.5 h-2.5 rounded-full inline-block border border-white/20"
																style={{ backgroundColor: tenant.primary_color || "#0B2545" }}
																title={`Brand Color: ${tenant.primary_color}`}
															/>
														</div>
														<div className="flex items-center gap-2 mt-0.5">
															<span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/60">
																{tenant.slug}
															</span>
															{tenant.short_name && (
																<span className="text-[10px] text-gray-400">
																	({tenant.short_name})
																</span>
															)}
															{tenant.gstin && (
																<span className="font-mono text-[10px] text-gray-500">
																	GST: {tenant.gstin}
																</span>
															)}
														</div>
													</div>
												</div>
											</td>

											{/* Domain Routing */}
											<td className="px-5 py-4">
												<div className="space-y-1">
													{tenant.custom_domain ? (
														<a
															href={`https://${tenant.custom_domain}`}
															target="_blank"
															rel="noopener noreferrer"
															className="inline-flex items-center gap-1 font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline"
														>
															<Globe className="w-3.5 h-3.5" />
															{tenant.custom_domain}
															<ExternalLink className="w-3 h-3 opacity-60" />
														</a>
													) : (
														<span className="text-gray-500 italic text-[11px]">Unmapped production</span>
													)}
													<div className="flex items-center gap-2">
														<a
															href={`http://${tenant.slug}.localhost:3000`}
															target="_blank"
															rel="noopener noreferrer"
															className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-400 hover:text-gray-200"
															title="Subdomain routing"
														>
															{tenant.slug}.localhost:3000
															<ExternalLink className="w-2.5 h-2.5 opacity-50" />
														</a>
														<span className="text-gray-600">|</span>
														<a
															href={`http://localhost:3000/?tenant=${tenant.slug}`}
															target="_blank"
															rel="noopener noreferrer"
															className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan-400 hover:text-cyan-300"
															title="Direct local test simulation"
														>
															Local Test
															<ExternalLink className="w-2.5 h-2.5 opacity-50" />
														</a>
													</div>
												</div>
											</td>

											{/* ERP & SQL Parameters */}
											<td className="px-5 py-4">
												<div className="space-y-1">
													<div className="flex items-center gap-1.5">
														<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-800 border border-gray-700 text-gray-300">
															{tenant.erp_software_type || "Technomax"}
														</span>
														<span className="text-[10px] font-mono text-gray-400">
															{tenant.legacy_db_name || "pdyasvmaster"}
														</span>
													</div>
													<div className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
														<span className="px-1 py-0.2 bg-gray-800/80 rounded border border-gray-700/60">
															Comp: {tenant.comp_no ?? 11}
														</span>
														<span className="px-1 py-0.2 bg-gray-800/80 rounded border border-gray-700/60">
															Loc: {tenant.loc_no ?? 11}
														</span>
													</div>
												</div>
											</td>

											{/* Overdue Policies */}
											<td className="px-5 py-4">
												<div className="space-y-0.5 text-[11px]">
													<div className="text-gray-300">
														Direct: <span className="font-mono font-bold text-amber-400">{tenant.overdue_direct_block_days ?? 90}d</span>
													</div>
													<div className="text-gray-400 text-[10px]">
														Division: <span className="font-mono text-rose-400">{tenant.overdue_division_block_days ?? 95}d</span>
													</div>
												</div>
											</td>

											{/* Status Toggle */}
											<td className="px-5 py-4">
												<button
													type="button"
													onClick={() => handleToggleStatus(tenant)}
													disabled={isToggling}
													className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
														tenant.is_active
															? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
															: "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-750"
													}`}
												>
													<span
														className={`w-1.5 h-1.5 rounded-full ${
															tenant.is_active ? "bg-emerald-400 animate-pulse" : "bg-gray-500"
														}`}
													/>
													{isToggling ? "Updating..." : tenant.is_active ? "Active" : "Suspended"}
												</button>
											</td>

											{/* API Server Diagnostics */}
											<td className="px-5 py-4">
												<div className="flex items-center gap-2">
													<button
														type="button"
														onClick={() => handlePingApiServer(tenant)}
														disabled={isPinging || !tenant.api_server_url}
														className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-gray-800 hover:bg-gray-750 text-blue-400 border border-blue-500/30 rounded-lg transition-colors disabled:opacity-40"
													>
														{isPinging ? (
															<>
																<Loader2 className="w-3 h-3 animate-spin" />
																Pinging...
															</>
														) : (
															<>
																<Activity className="w-3 h-3" />
																Ping API
															</>
														)}
													</button>

													{ping && (
														<span
															className={`px-2 py-0.5 text-[11px] font-mono rounded border ${
																ping.success
																	? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
																	: "bg-rose-500/10 text-rose-400 border-rose-500/30"
															}`}
															title={ping.error || `Latency: ${ping.latencyMs}ms`}
														>
															{ping.success ? `${ping.latencyMs}ms` : "Error"}
														</span>
													)}
												</div>
											</td>

											{/* Actions */}
											<td className="px-5 py-4 text-right">
												<div className="flex items-center justify-end gap-1.5">
													<button
														type="button"
														onClick={() => openEditModal(tenant)}
														className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
														title="Edit Tenant"
													>
														<Edit2 className="w-4 h-4" />
													</button>
													<button
														type="button"
														onClick={() => handleDelete(tenant)}
														className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
														title="Delete Tenant"
													>
														<Trash2 className="w-4 h-4" />
													</button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Modal Dialog */}
			{isModalOpen && (
				<TenantModal
					key={editingTenant ? `edit-${editingTenant.id}` : "create-new-tenant"}
					isOpen={isModalOpen}
					onClose={() => {
						setIsModalOpen(false);
						setEditingTenant(null);
					}}
					onSaved={handleRefresh}
					initialTenant={editingTenant}
				/>
			)}
		</div>
	);
}
