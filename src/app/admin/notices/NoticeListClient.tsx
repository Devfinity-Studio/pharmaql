"use client";

import { useState } from "react";
import { saveNotice, deleteNotice, activateNotice, deactivateNotice } from "@/server/actions/notices";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export default function NoticeListClient({ initialNotices }: { initialNotices: any[] }) {
	const [notices, setNotices] = useState(initialNotices);
	
	// Create/Edit Modal
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [editId, setEditId] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [variant, setVariant] = useState("info");
	const [isSaving, setIsSaving] = useState(false);

	// Activate Modal
	const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
	const [activateId, setActivateId] = useState<string | null>(null);
	const [durationMode, setDurationMode] = useState<"indefinite" | "days" | "date">("indefinite");
	const [days, setDays] = useState(1);
	const [endDate, setEndDate] = useState("");
	const [isActivating, setIsActivating] = useState(false);

	const openEditModal = (notice?: any) => {
		if (notice) {
			setEditId(notice.id);
			setTitle(notice.title);
			setContent(notice.content);
			setVariant(notice.variant);
		} else {
			setEditId(null);
			setTitle("");
			setContent("");
			setVariant("info");
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
			await saveNotice(editId, title, content, variant);
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
			if (confirm("Deactivate this notice? It will no longer be shown to MRs.")) {
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
		} catch(e) {
			console.error(e);
			alert("Failed to activate notice.");
			setIsActivating(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex justify-end">
				<button
					onClick={() => openEditModal()}
					className="bg-[#0B2545] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#0071BC] transition-colors shadow-sm"
				>
					+ New Notice
				</button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{notices.map((notice) => {
					const isExpired = notice.expiresAt && new Date(notice.expiresAt) < new Date();
					const isActiveAndValid = notice.isActive && !isExpired;

					return (
						<div key={notice.id} className={`bg-white p-5 rounded-xl border ${isActiveAndValid ? 'border-green-400 ring-2 ring-green-100' : 'border-gray-200'} shadow-sm relative overflow-hidden`}>
							<div className={`absolute top-0 left-0 w-full h-2 ${
								notice.variant === 'warning' ? 'bg-yellow-400' :
								notice.variant === 'danger' ? 'bg-red-500' :
								notice.variant === 'success' ? 'bg-green-500' :
								notice.variant === 'festive' ? 'bg-fuchsia-500' :
								'bg-blue-500'
							}`} />
							
							<div className="flex justify-between items-start mt-2">
								<h3 className="font-bold text-lg text-gray-800">{notice.title}</h3>
								
								<div className="flex items-center gap-2">
									{isExpired && notice.isActive && (
										<span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">Expired</span>
									)}
									<span className="text-sm font-medium text-gray-600">Active?</span>
									<Switch
										checked={notice.isActive}
										onCheckedChange={() => toggleActive(notice)}
									/>
								</div>
							</div>
							
							<p className="text-xs text-gray-400 mt-1">
								Variant: <span className="capitalize">{notice.variant}</span>
								{notice.expiresAt && ` | Expires: ${new Date(notice.expiresAt).toLocaleDateString()}`}
							</p>
							
							<div className="mt-4 text-gray-700 text-sm whitespace-pre-wrap line-clamp-3">
								{notice.content}
							</div>

							<div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
								<button onClick={() => openEditModal(notice)} className="text-sm font-medium text-blue-600 hover:text-blue-800">
									Edit
								</button>
								<button onClick={() => handleDelete(notice.id)} className="text-sm font-medium text-red-600 hover:text-red-800">
									Delete
								</button>
							</div>
						</div>
					);
				})}
				{notices.length === 0 && (
					<div className="col-span-full text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
						No notices created yet.
					</div>
				)}
			</div>

			{/* Edit/Create Modal */}
			<Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
				<DialogContent className="sm:max-w-[600px]">
					<DialogHeader>
						<DialogTitle>{editId ? "Edit Notice" : "Create New Notice"}</DialogTitle>
					</DialogHeader>
					
					<div className="space-y-4 py-4">
						<div>
							<label className="block font-bold text-gray-700 text-sm mb-1">Title</label>
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="E.g., System Maintenance"
							/>
						</div>
						
						<div>
							<label className="block font-bold text-gray-700 text-sm mb-1">Message</label>
							<textarea
								value={content}
								onChange={(e) => setContent(e.target.value)}
								className="w-full h-32 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="Enter the notice content..."
							/>
						</div>

						<div>
							<label className="block font-bold text-gray-700 text-sm mb-1">Visual Variant</label>
							<select
								value={variant}
								onChange={(e) => setVariant(e.target.value)}
								className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="info">Info (Blue)</option>
								<option value="success">Success (Green)</option>
								<option value="warning">Warning (Yellow)</option>
								<option value="danger">Danger (Red)</option>
								<option value="festive">Festive (Party Poppers / Confetti)</option>
							</select>
						</div>
					</div>

					<div className="flex justify-end gap-3 pt-4 border-t">
						<button
							onClick={() => setIsEditModalOpen(false)}
							className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100"
						>
							Cancel
						</button>
						<button
							onClick={handleSave}
							disabled={isSaving}
							className="px-4 py-2 bg-[#0B2545] text-white rounded-lg font-bold hover:bg-[#0071BC] transition-colors disabled:opacity-50"
						>
							{isSaving ? "Saving..." : "Save Notice"}
						</button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Activate Modal */}
			<Dialog open={isActivateModalOpen} onOpenChange={setIsActivateModalOpen}>
				<DialogContent className="sm:max-w-[400px]">
					<DialogHeader>
						<DialogTitle>Activate Notice</DialogTitle>
					</DialogHeader>
					
					<div className="space-y-4 py-4">
						<div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm mb-4 border border-yellow-200">
							<strong>Warning:</strong> Activating this notice will automatically deactivate any currently active notice. Only one notice can be active at a time.
						</div>

						<div>
							<label className="block font-bold text-gray-700 text-sm mb-2">How long should this be active?</label>
							<div className="space-y-2">
								<label className="flex items-center gap-2">
									<input type="radio" name="duration" checked={durationMode === "indefinite"} onChange={() => setDurationMode("indefinite")} />
									Indefinitely
								</label>
								<label className="flex items-center gap-2">
									<input type="radio" name="duration" checked={durationMode === "days"} onChange={() => setDurationMode("days")} />
									For a specific number of days
								</label>
								<label className="flex items-center gap-2">
									<input type="radio" name="duration" checked={durationMode === "date"} onChange={() => setDurationMode("date")} />
									Until a specific date
								</label>
							</div>
						</div>

						{durationMode === "days" && (
							<div className="pt-2">
								<label className="block font-bold text-gray-700 text-sm mb-1">Number of Days</label>
								<input type="number" min="1" value={days} onChange={e => setDays(parseInt(e.target.value))} className="w-full p-2 border rounded-lg" />
							</div>
						)}

						{durationMode === "date" && (
							<div className="pt-2">
								<label className="block font-bold text-gray-700 text-sm mb-1">End Date</label>
								<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded-lg" />
							</div>
						)}
					</div>

					<div className="flex justify-end gap-3 pt-4 border-t">
						<button onClick={() => setIsActivateModalOpen(false)} className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100">
							Cancel
						</button>
						<button onClick={handleActivateSubmit} disabled={isActivating} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">
							{isActivating ? "Activating..." : "Confirm & Activate"}
						</button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
