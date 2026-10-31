"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
	activateNotice,
	deactivateNotice,
	deleteNotice,
	saveNotice,
} from "@/server/actions/notices";

export default function NoticeListClient({
	initialNotices,
	userRole = "ADMIN",
	tenants = [],
	isDevPortal = false,
}: {
	initialNotices: any[];
	userRole?: string;
	tenants?: { id: string; name: string; slug: string }[];
	isDevPortal?: boolean;
}) {
	const [notices, setNotices] = useState(initialNotices);

	// Create/Edit Modal
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [editId, setEditId] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [variant, setVariant] = useState("info");
	const [targetAudience, setTargetAudience] = useState<
		"MR" | "ADMIN" | "MR_AND_ADMIN" | "DEVELOPER" | "ALL"
	>("MR");
	const [targetTenantId, setTargetTenantId] = useState<string>("");
	const [isSaving, setIsSaving] = useState(false);

	// Activate Modal
	const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
	const [activateId, setActivateId] = useState<string | null>(null);
	const [durationMode, setDurationMode] = useState<
		"indefinite" | "days" | "date"
	>("indefinite");
	const [days, setDays] = useState(1);
	const [endDate, setEndDate] = useState("");
	const [isActivating, setIsActivating] = useState(false);

	const openEditModal = (notice?: any) => {
		if (notice) {
			setEditId(notice.id);
			setTitle(notice.title);
			setContent(notice.content);
			setVariant(notice.variant || "info");
			setTargetAudience(notice.targetAudience || "MR");
			setTargetTenantId(notice.tenantId || "");
		} else {
			setEditId(null);
			setTitle("");
			setContent("");
			setVariant("info");
			setTargetAudience("MR");
			setTargetTenantId("");
		}
		setIsEditModalOpen(true);
	};

	const handleSave = async () => {
		if (!title.trim() || !content.trim()) {
			alert("Please enter a title and content.");
			return;
		}
		setIsSaving(true);
		try {
			await saveNotice(editId, title, content, variant, targetAudience, targetTenantId || null);
			window.location.reload();
		} catch (error) {
			console.error(error);
			alert("Failed to save notice.");
			setIsSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (confirm("Are you sure you want to delete this notice?")) {
			try {
				await deleteNotice(id);
				window.location.reload();
			} catch (error) {
				console.error(error);
				alert("Failed to delete.");
			}
		}
	};

	const toggleActive = async (notice: any) => {
		if (notice.isActive) {
			// Deactivate
			if (
				confirm("Deactivate this notice? It will no longer be displayed to users.")
			) {
				await deactivateNotice(notice.id);
				window.location.reload();
			}
		} else {
			// Open activate modal
			setActivateId(notice.id);
			setDurationMode("indefinite");
			setIsActivateModalOpen(true);
		}
	};

	const handleActivateSubmit = async () => {
		if (!activateId) return;
		setIsActivating(true);

		let expiresAt: Date | null = null;
		if (durationMode === "days") {
			expiresAt = new Date();
			expiresAt.setDate(expiresAt.getDate() + days);
		} else if (durationMode === "date") {
			if (!endDate) {
				alert("Please select a date.");
				setIsActivating(false);
				return;
			}
			expiresAt = new Date(endDate);
		}

		try {
			await activateNotice(activateId, expiresAt);
			window.location.reload();
		} catch (e) {
			console.error(e);
			alert("Failed to activate notice.");
			setIsActivating(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex justify-end">
				<button
					className="rounded-lg bg-[#0B2545] px-4 py-2 font-bold text-white shadow-sm transition-colors hover:bg-[#0071BC]"
					onClick={() => openEditModal()}
				>
					+ New Notice
				</button>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{notices.map((notice) => {
					const isExpired =
						notice.expiresAt && new Date(notice.expiresAt) < new Date();
					const isActiveAndValid = notice.isActive && !isExpired;

					return (
						<div
							className={`rounded-xl border bg-white p-5 ${isActiveAndValid ? "border-green-400 ring-2 ring-green-100" : "border-gray-200"} relative overflow-hidden shadow-sm`}
							key={notice.id}
						>
							<div
								className={`absolute top-0 left-0 h-2 w-full ${
									notice.variant === "warning"
										? "bg-yellow-400"
										: notice.variant === "danger"
											? "bg-red-500"
											: notice.variant === "success"
												? "bg-green-500"
												: notice.variant === "festive"
													? "bg-fuchsia-500"
													: "bg-blue-500"
								}`}
							/>

							<div className="mt-2 flex items-start justify-between gap-3">
								<h3 className="font-bold text-gray-800 text-lg">
									{notice.title}
								</h3>

								<div className="flex items-center gap-2 shrink-0">
									{isExpired && notice.isActive && (
										<span className="rounded bg-red-50 px-2 py-1 font-bold text-red-500 text-xs">
											Expired
										</span>
									)}
									<span className="font-medium text-gray-600 text-sm">
										Active?
									</span>
									<Switch
										checked={notice.isActive}
										onCheckedChange={() => toggleActive(notice)}
									/>
								</div>
							</div>

							<div className="mt-2 flex flex-wrap items-center gap-2">
								<span className="text-gray-500 text-xs font-medium">
									Variant: <span className="capitalize font-bold text-gray-800">{notice.variant}</span>
								</span>
								<span className="text-gray-300">•</span>
								{notice.tenantId ? (
									(() => {
										const t = tenants.find((item) => item.id === notice.tenantId);
										return (
											<span className="rounded-full bg-cyan-50 px-2.5 py-0.5 font-bold text-xs text-cyan-800 border border-cyan-200">
												🏢 Tenant: {t ? `${t.name} (${t.slug})` : notice.tenantId.slice(0, 8)}
											</span>
										);
									})()
								) : (
									<span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-xs text-slate-700 border border-slate-300">
										🌐 Global Broadcast (All Tenants)
									</span>
								)}
								<span className="text-gray-300">•</span>
								{notice.targetAudience === "ADMIN" ? (
									<span className="rounded-full bg-purple-50 px-2.5 py-0.5 font-bold text-xs text-purple-700 border border-purple-200">
										Audience: Admins Only
									</span>
								) : notice.targetAudience === "MR_AND_ADMIN" ? (
									<span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-bold text-xs text-emerald-700 border border-emerald-200">
										Audience: MRs &amp; Admins
									</span>
								) : notice.targetAudience === "DEVELOPER" ? (
									<span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-bold text-xs text-amber-700 border border-amber-200">
										Audience: Developers Only
									</span>
								) : notice.targetAudience === "ALL" ? (
									<span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-bold text-xs text-indigo-700 border border-indigo-200">
										Audience: Everyone (MRs, Admins, Devs)
									</span>
								) : (
									<span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-bold text-xs text-blue-700 border border-blue-200">
										Audience: MRs Only
									</span>
								)}
								{notice.expiresAt && (
									<>
										<span className="text-gray-300">•</span>
										<span className="text-gray-500 text-xs font-mono">
											Expires: {new Date(notice.expiresAt).toLocaleDateString()}
										</span>
									</>
								)}
							</div>

							<div className="mt-4 line-clamp-3 whitespace-pre-wrap text-gray-700 text-sm">
								{notice.content}
							</div>

							<div className="mt-6 flex items-center justify-end gap-3 border-gray-200 border-t pt-4">
								<button
									className="font-medium text-blue-600 text-sm hover:text-blue-800"
									onClick={() => openEditModal(notice)}
								>
									Edit
								</button>
								<button
									className="font-medium text-red-600 text-sm hover:text-red-800"
									onClick={() => handleDelete(notice.id)}
								>
									Delete
								</button>
							</div>
						</div>
					);
				})}
				{notices.length === 0 && (
					<div className="col-span-full rounded-xl border border-gray-300 border-dashed bg-white py-10 text-center text-gray-500">
						No notices created yet.
					</div>
				)}
			</div>

			{/* Edit/Create Modal */}
			<Dialog onOpenChange={setIsEditModalOpen} open={isEditModalOpen}>
				<DialogContent className="sm:max-w-[600px]">
					<DialogHeader>
						<DialogTitle>
							{editId ? "Edit Notice" : "Create New Notice"}
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div>
							<label className="mb-1 block font-bold text-gray-700 text-sm">
								Title
							</label>
							<input
								className="w-full rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
								onChange={(e) => setTitle(e.target.value)}
								placeholder="E.g., Quarterly Zonal Sales Circular"
								type="text"
								value={title}
							/>
						</div>

						<div>
							<label className="mb-1 block font-bold text-gray-700 text-sm">
								Target Audience
							</label>
							<p className="mb-1.5 text-xs text-gray-500">
								Choose which portals and roles this notice modal and push alert will appear for:
							</p>
							<select
								className="w-full rounded-lg border p-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
								onChange={(e) => setTargetAudience(e.target.value as any)}
								value={targetAudience}
							>
								<option value="MR">Medical Representatives Only (MR Field Portal)</option>
								<option value="ADMIN">Admins Only (Admin Portal)</option>
								<option value="MR_AND_ADMIN">MRs &amp; Admins (Both Portals)</option>
								{userRole === "DEVELOPER" && (
									<>
										<option value="ALL">Everyone (MRs, Admins &amp; Developers)</option>
										<option value="DEVELOPER">Developers Only (Developer Portal)</option>
									</>
								)}
							</select>
						</div>

						{userRole === "DEVELOPER" && (
							<div>
								<label className="mb-1 block font-bold text-gray-700 text-sm">
									Target Tenant Scope
								</label>
								<p className="mb-1.5 text-xs text-gray-500">
									Select whether this notice broadcasts globally to all client tenants or targets a specific tenant:
								</p>
								<select
									className="w-full rounded-lg border p-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
									onChange={(e) => setTargetTenantId(e.target.value)}
									value={targetTenantId}
								>
									<option value="">🌐 Global Broadcast (All Tenants)</option>
									{tenants.map((t) => (
										<option key={t.id} value={t.id}>
											🏢 {t.name} ({t.slug})
										</option>
									))}
								</select>
							</div>
						)}

						<div>
							<label className="mb-1 block font-bold text-gray-700 text-sm">
								Message Content
							</label>
							<textarea
								className="h-32 w-full rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
								onChange={(e) => setContent(e.target.value)}
								placeholder="Enter the official notice or circular content..."
								value={content}
							/>
						</div>

						<div>
							<label className="mb-1 block font-bold text-gray-700 text-sm">
								Visual Variant
							</label>
							<select
								className="w-full rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
								onChange={(e) => setVariant(e.target.value)}
								value={variant}
							>
								<option value="info">Info (Blue)</option>
								<option value="success">Success (Green)</option>
								<option value="warning">Warning (Yellow)</option>
								<option value="danger">Danger (Red)</option>
								<option value="festive">
									Festive (Party Poppers / Confetti)
								</option>
							</select>
						</div>
					</div>

					<div className="flex justify-end gap-3 border-t pt-4">
						<button
							className="rounded-lg px-4 py-2 font-medium text-gray-600 hover:bg-gray-100"
							onClick={() => setIsEditModalOpen(false)}
						>
							Cancel
						</button>
						<button
							className="rounded-lg bg-[#0B2545] px-4 py-2 font-bold text-white transition-colors hover:bg-[#0071BC] disabled:opacity-50"
							disabled={isSaving}
							onClick={handleSave}
						>
							{isSaving ? "Saving..." : "Save Notice"}
						</button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Activate Modal */}
			<Dialog onOpenChange={setIsActivateModalOpen} open={isActivateModalOpen}>
				<DialogContent className="sm:max-w-[400px]">
					<DialogHeader>
						<DialogTitle>Activate Notice</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
							<strong>Warning:</strong> Activating this notice will
							automatically deactivate any currently active notice. Only one
							notice can be active at a time.
						</div>

						<div>
							<label className="mb-2 block font-bold text-gray-700 text-sm">
								How long should this be active?
							</label>
							<div className="space-y-2">
								<label className="flex items-center gap-2">
									<input
										checked={durationMode === "indefinite"}
										name="duration"
										onChange={() => setDurationMode("indefinite")}
										type="radio"
									/>
									Indefinitely
								</label>
								<label className="flex items-center gap-2">
									<input
										checked={durationMode === "days"}
										name="duration"
										onChange={() => setDurationMode("days")}
										type="radio"
									/>
									For a specific number of days
								</label>
								<label className="flex items-center gap-2">
									<input
										checked={durationMode === "date"}
										name="duration"
										onChange={() => setDurationMode("date")}
										type="radio"
									/>
									Until a specific date
								</label>
							</div>
						</div>

						{durationMode === "days" && (
							<div className="pt-2">
								<label className="mb-1 block font-bold text-gray-700 text-sm">
									Number of Days
								</label>
								<input
									className="w-full rounded-lg border p-2"
									min="1"
									onChange={(e) => setDays(parseInt(e.target.value))}
									type="number"
									value={days}
								/>
							</div>
						)}

						{durationMode === "date" && (
							<div className="pt-2">
								<label className="mb-1 block font-bold text-gray-700 text-sm">
									End Date
								</label>
								<input
									className="w-full rounded-lg border p-2"
									onChange={(e) => setEndDate(e.target.value)}
									type="date"
									value={endDate}
								/>
							</div>
						)}
					</div>

					<div className="flex justify-end gap-3 border-t pt-4">
						<button
							className="rounded-lg px-4 py-2 font-medium text-gray-600 hover:bg-gray-100"
							onClick={() => setIsActivateModalOpen(false)}
						>
							Cancel
						</button>
						<button
							className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:opacity-50"
							disabled={isActivating}
							onClick={handleActivateSubmit}
						>
							{isActivating ? "Activating..." : "Confirm & Activate"}
						</button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
