"use client";

import { useState, useEffect, useCallback } from "react";
import {
	type FeedbackReport,
	type FeedbackCategory,
	type FeedbackUrgency,
	type FeedbackStatus,
} from "@/lib/feedback";
import {
	getFeedbackReportsAction,
	updateFeedbackReportStatusAction,
} from "@/server/actions/feedback";

export function DevFeedbackPanel() {
	const [reports, setReports] = useState<FeedbackReport[]>([]);
	const [counts, setCounts] = useState({
		all: 0,
		open: 0,
		underReview: 0,
		resolved: 0,
		critical: 0,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Filters
	const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "ALL">("ALL");
	const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | "ALL">("ALL");
	const [urgencyFilter, setUrgencyFilter] = useState<FeedbackUrgency | "ALL">("ALL");
	const [searchQuery, setSearchQuery] = useState("");

	// Active Ticket Drawer for Inspection & Update
	const [selectedTicket, setSelectedTicket] = useState<FeedbackReport | null>(null);
	const [updatingStatus, setUpdatingStatus] = useState<FeedbackStatus>("OPEN");
	const [updatingNotes, setUpdatingNotes] = useState("");
	const [isSavingUpdate, setIsSavingUpdate] = useState(false);
	const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

	const loadReports = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const res = await getFeedbackReportsAction({
				status: statusFilter,
				category: categoryFilter,
				urgency: urgencyFilter,
				search: searchQuery,
			});

			if (!res.success || !res.data) {
				setError(res.error || "Failed to load feedback reports.");
			} else {
				setReports(res.data.reports);
				setCounts(res.data.counts);
			}
		} catch (err: any) {
			setError(err.message || "Network error loading feedback reports.");
		} finally {
			setIsLoading(false);
		}
	}, [statusFilter, categoryFilter, urgencyFilter, searchQuery]);

	useEffect(() => {
		loadReports();
	}, [loadReports]);

	const handleOpenDrawer = (ticket: FeedbackReport) => {
		setSelectedTicket(ticket);
		setUpdatingStatus(ticket.status);
		setUpdatingNotes(ticket.developerNotes || "");
		setActionMessage(null);
	};

	const handleSaveStatusUpdate = async () => {
		if (!selectedTicket) return;
		setIsSavingUpdate(true);
		setActionMessage(null);

		try {
			const res = await updateFeedbackReportStatusAction({
				id: selectedTicket.id,
				status: updatingStatus,
				developerNotes: updatingNotes.trim() || undefined,
			});

			if (!res.success || !res.data) {
				setActionMessage({ text: res.error || "Failed to update status", type: "error" });
			} else {
				setActionMessage({ text: "Ticket status updated successfully!", type: "success" });
				setSelectedTicket(res.data);
				// Update list item in place
				setReports((prev) =>
					prev.map((r) => (r.id === res.data.id ? res.data : r)),
				);
				// Reload counts
				loadReports();
			}
		} catch (err: any) {
			setActionMessage({ text: err.message || "Error updating ticket", type: "error" });
		} finally {
			setIsSavingUpdate(false);
		}
	};

	const categoryBadge = (cat: FeedbackCategory) => {
		switch (cat) {
			case "BUG":
				return <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">🐛 Bug / Crash</span>;
			case "DATA_DISCREPANCY":
				return <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">📊 Data Issue</span>;
			case "FEATURE_REQUEST":
				return <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">💡 Feature Request</span>;
			case "GENERAL":
			default:
				return <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 border border-sky-200">💬 Feedback</span>;
		}
	};

	const urgencyBadge = (urg: FeedbackUrgency) => {
		switch (urg) {
			case "CRITICAL":
				return <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-extrabold text-white uppercase tracking-wider">Critical</span>;
			case "HIGH":
				return <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-extrabold text-white uppercase tracking-wider">High</span>;
			case "NORMAL":
				return <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800 uppercase tracking-wider">Normal</span>;
			case "LOW":
			default:
				return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 uppercase tracking-wider">Low</span>;
		}
	};

	const statusBadge = (st: FeedbackStatus) => {
		switch (st) {
			case "OPEN":
				return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800"><span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse"></span>Open</span>;
			case "UNDER_REVIEW":
				return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800"><span className="h-1.5 w-1.5 rounded-full bg-amber-600"></span>In Review</span>;
			case "RESOLVED":
				return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>Resolved</span>;
			case "WONT_FIX":
			default:
				return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">Closed</span>;
		}
	};

	return (
		<div className="space-y-6">
			{/* Metric KPI Cards */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Reports</div>
					<div className="mt-1 text-2xl font-black text-slate-900">{counts.all}</div>
				</div>
				<div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
					<div className="text-xs font-bold uppercase tracking-wider text-rose-700">Open Tickets</div>
					<div className="mt-1 text-2xl font-black text-rose-700">{counts.open}</div>
				</div>
				<div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
					<div className="text-xs font-bold uppercase tracking-wider text-amber-700">Under Review</div>
					<div className="mt-1 text-2xl font-black text-amber-700">{counts.underReview}</div>
				</div>
				<div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
					<div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Resolved</div>
					<div className="mt-1 text-2xl font-black text-emerald-700">{counts.resolved}</div>
				</div>
				<div className="rounded-2xl border border-rose-300 bg-rose-100/60 p-4 shadow-sm">
					<div className="text-xs font-bold uppercase tracking-wider text-rose-900">Critical Unresolved</div>
					<div className="mt-1 text-2xl font-black text-rose-900">{counts.critical}</div>
				</div>
			</div>

			{/* Filter & Search Bar */}
			<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					{/* Status Filter Buttons */}
					<div className="flex flex-wrap gap-1.5">
						{[
							{ id: "ALL", label: "All Status" },
							{ id: "OPEN", label: "Open" },
							{ id: "UNDER_REVIEW", label: "In Review" },
							{ id: "RESOLVED", label: "Resolved" },
							{ id: "WONT_FIX", label: "Closed" },
						].map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setStatusFilter(tab.id as any)}
								className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
									statusFilter === tab.id
										? "bg-[#0B2545] text-white shadow-sm"
										: "bg-slate-100 text-slate-600 hover:bg-slate-200"
								}`}
							>
								{tab.label}
							</button>
						))}
					</div>

					{/* Refresh Button */}
					<button
						type="button"
						onClick={loadReports}
						disabled={isLoading}
						className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
					>
						<svg
							className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? "animate-spin" : ""}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Refresh
					</button>
				</div>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					{/* Search */}
					<div>
						<input
							type="text"
							placeholder="Search ID, subject, MR name..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full rounded-xl border border-slate-300 px-3.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#0071BC] focus:outline-none focus:ring-1 focus:ring-[#0071BC]"
						/>
					</div>

					{/* Category */}
					<div>
						<select
							value={categoryFilter}
							onChange={(e) => setCategoryFilter(e.target.value as any)}
							className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-[#0071BC] focus:outline-none focus:ring-1 focus:ring-[#0071BC]"
						>
							<option value="ALL">All Categories</option>
							<option value="BUG">🐛 Bug / Crash</option>
							<option value="DATA_DISCREPANCY">📊 Data Discrepancy</option>
							<option value="FEATURE_REQUEST">💡 Feature Request</option>
							<option value="GENERAL">💬 General Feedback</option>
						</select>
					</div>

					{/* Urgency */}
					<div>
						<select
							value={urgencyFilter}
							onChange={(e) => setUrgencyFilter(e.target.value as any)}
							className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-[#0071BC] focus:outline-none focus:ring-1 focus:ring-[#0071BC]"
						>
							<option value="ALL">All Urgencies</option>
							<option value="CRITICAL">Critical</option>
							<option value="HIGH">High</option>
							<option value="NORMAL">Normal</option>
							<option value="LOW">Low</option>
						</select>
					</div>
				</div>
			</div>

			{/* Tickets List */}
			{error ? (
				<div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">
					<p className="font-bold text-sm">{error}</p>
					<button
						type="button"
						onClick={loadReports}
						className="mt-3 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
					>
						Try Again
					</button>
				</div>
			) : isLoading ? (
				<div className="flex flex-col items-center justify-center p-12 text-slate-400">
					<svg
						className="h-8 w-8 animate-spin text-[#0071BC] mb-2"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
						<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<span className="text-xs font-semibold">Loading feedback tickets...</span>
				</div>
			) : reports.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
					<svg
						className="mx-auto h-12 w-12 text-slate-300 mb-3"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="1.5"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					<h4 className="font-bold text-slate-800 text-sm">No Reports Found</h4>
					<p className="text-xs text-slate-500 mt-1">No feedback tickets match the selected filters.</p>
				</div>
			) : (
				<div className="space-y-3">
					{reports.map((report) => (
						<div
							key={report.id}
							onClick={() => handleOpenDrawer(report)}
							className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#0071BC] hover:shadow-md"
						>
							<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
								<div className="space-y-1.5 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-700">
											{report.id}
										</code>
										{categoryBadge(report.category)}
										{urgencyBadge(report.urgency)}
										{statusBadge(report.status)}
									</div>
									<h4 className="text-sm font-bold text-slate-900 group-hover:text-[#0071BC] transition">
										{report.title}
									</h4>
									<p className="text-xs text-slate-600 line-clamp-2">
										{report.description}
									</p>
								</div>

								{/* Submitter & Timestamp */}
								<div className="sm:text-right text-xs text-slate-500 shrink-0 space-y-1 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
									<div className="font-bold text-slate-800">
										{report.submittedBy.userRole === "MR" ? (
											<span className="inline-flex items-center gap-1">
												<span className="rounded bg-sky-100 text-[#0071BC] px-1.5 py-0.2 font-extrabold text-[10px]">MR</span>
												{report.submittedBy.userName}
												{report.submittedBy.mrRank && <span className="text-slate-400 font-normal"> (R{report.submittedBy.mrRank})</span>}
											</span>
										) : (
											<span>{report.submittedBy.userName} ({report.submittedBy.userRole})</span>
										)}
									</div>
									<div className="text-[11px] text-slate-400">
										{new Date(report.createdAt).toLocaleDateString("en-IN", {
											day: "2-digit",
											month: "short",
											year: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</div>
									{report.diagnostics.tab && (
										<div className="text-[10px] text-slate-500">
											Tab: <span className="font-semibold text-slate-700">{report.diagnostics.tab}</span>
										</div>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Detailed Slide-Over Inspector Drawer */}
			{selectedTicket && (
				<div
					className="fixed inset-0 z-[9999] flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
					onClick={() => setSelectedTicket(null)}
				>
					<div
						className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl overflow-hidden"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Drawer Header */}
						<div className="flex items-center justify-between border-b border-slate-200 bg-[#0B2545] p-5 text-white">
							<div>
								<div className="flex items-center gap-2">
									<span className="font-mono text-xs font-bold text-sky-400">
										{selectedTicket.id}
									</span>
									{urgencyBadge(selectedTicket.urgency)}
								</div>
								<h3 className="font-bold text-base text-white mt-1">
									{selectedTicket.title}
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setSelectedTicket(null)}
								className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
							>
								<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						{/* Drawer Content */}
						<div className="flex-1 overflow-y-auto p-6 space-y-6">
							{actionMessage && (
								<div
									className={`rounded-xl p-3 text-xs font-bold ${
										actionMessage.type === "success"
											? "bg-emerald-50 text-emerald-800 border border-emerald-200"
											: "bg-rose-50 text-rose-800 border border-rose-200"
									}`}
								>
									{actionMessage.text}
								</div>
							)}

							{/* Submitter Box */}
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
								<h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
									Submitter Information
								</h5>
								<div className="text-sm font-bold text-slate-900">
									{selectedTicket.submittedBy.userName}
								</div>
								<div className="text-xs text-slate-600 mt-1 space-y-0.5">
									<div>Role: <strong>{selectedTicket.submittedBy.userRole}</strong> {selectedTicket.submittedBy.mrRank ? `(Rank ${selectedTicket.submittedBy.mrRank})` : ""}</div>
									<div>Email: <code>{selectedTicket.submittedBy.userEmail}</code></div>
									<div>User ID: <code>{selectedTicket.submittedBy.userId}</code></div>
									{selectedTicket.submittedBy.division && <div>Division: <strong>{selectedTicket.submittedBy.division}</strong></div>}
									{selectedTicket.contactNote && (
										<div className="mt-2 rounded bg-amber-50 p-2 text-amber-900 border border-amber-200">
											<strong>Contact Note:</strong> &ldquo;{selectedTicket.contactNote}&rdquo;
										</div>
									)}
								</div>
							</div>

							{/* Description */}
							<div>
								<h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
									Description
								</h5>
								<div className="rounded-xl border border-slate-200 bg-white p-4 text-xs font-sans leading-relaxed text-slate-800 whitespace-pre-wrap">
									{selectedTicket.description}
								</div>
							</div>

							{/* Diagnostics */}
							<div>
								<h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
									Client Diagnostics
								</h5>
								<div className="rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-[11px] text-slate-300 space-y-1.5 overflow-x-auto">
									<div><strong className="text-sky-400">URL:</strong> {selectedTicket.diagnostics.url}</div>
									{selectedTicket.diagnostics.tab && <div><strong className="text-sky-400">Tab:</strong> {selectedTicket.diagnostics.tab}</div>}
									{selectedTicket.diagnostics.division && <div><strong className="text-sky-400">Division:</strong> {selectedTicket.diagnostics.division}</div>}
									<div><strong className="text-sky-400">Device/Browser:</strong> {selectedTicket.diagnostics.userAgent}</div>
									{selectedTicket.diagnostics.viewport && <div><strong className="text-sky-400">Viewport:</strong> {selectedTicket.diagnostics.viewport}</div>}
									{selectedTicket.diagnostics.ip && <div><strong className="text-sky-400">Client IP:</strong> {selectedTicket.diagnostics.ip}</div>}
									{selectedTicket.diagnostics.recentErrors && selectedTicket.diagnostics.recentErrors.length > 0 && (
										<div className="mt-2 text-rose-400 border-t border-slate-800 pt-2">
											<strong>Client Error Logs:</strong>
											<ul className="list-disc pl-4 mt-1 space-y-0.5">
												{selectedTicket.diagnostics.recentErrors.map((err, i) => (
													<li key={i}>{err}</li>
												))}
											</ul>
										</div>
									)}
								</div>
							</div>

							{/* Developer Status & Notes Update */}
							<div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
								<h5 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
									Developer Action & Status
								</h5>
								<div>
									<label className="block text-xs font-bold text-slate-700 mb-1">
										Update Status
									</label>
									<select
										value={updatingStatus}
										onChange={(e) => setUpdatingStatus(e.target.value as any)}
										className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
									>
										<option value="OPEN">🔴 Open</option>
										<option value="UNDER_REVIEW">🟡 Under Review / Investigating</option>
										<option value="RESOLVED">🟢 Resolved / Fixed</option>
										<option value="WONT_FIX">⚪ Won&apos;t Fix / Closed</option>
									</select>
								</div>
								<div>
									<label className="block text-xs font-bold text-slate-700 mb-1">
										Developer Notes / Resolution Details
									</label>
									<textarea
										rows={3}
										placeholder="Add internal notes on resolution or cause..."
										value={updatingNotes}
										onChange={(e) => setUpdatingNotes(e.target.value)}
										className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
									></textarea>
								</div>
								<div className="flex justify-end pt-1">
									<button
										type="button"
										onClick={handleSaveStatusUpdate}
										disabled={isSavingUpdate}
										className="rounded-xl bg-[#0071BC] px-4 py-2 font-bold text-xs text-white shadow-sm transition hover:bg-[#134074] disabled:opacity-50"
									>
										{isSavingUpdate ? "Saving..." : "Update Ticket Status"}
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
