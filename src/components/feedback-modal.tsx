"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, usePathname } from "next/navigation";
import {
	type FeedbackCategory,
	type FeedbackUrgency,
} from "@/lib/feedback";
import { submitFeedbackAction } from "@/server/actions/feedback";
import { getRecentClientErrors, initClientErrorTracker } from "@/lib/client-error-tracker";

interface FeedbackModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialValues?: {
		category?: FeedbackCategory;
		urgency?: FeedbackUrgency;
		title?: string;
		description?: string;
		additionalErrors?: string[];
	};
}

export function FeedbackModal({
	isOpen,
	onClose,
	initialValues,
}: FeedbackModalProps) {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const [mounted, setMounted] = useState(false);
	const [category, setCategory] = useState<FeedbackCategory>(
		initialValues?.category || "BUG",
	);
	const [urgency, setUrgency] = useState<FeedbackUrgency>(
		initialValues?.urgency || "NORMAL",
	);
	const [title, setTitle] = useState(initialValues?.title || "");
	const [description, setDescription] = useState(
		initialValues?.description || "",
	);
	const [contactNote, setContactNote] = useState("");
	const [showDiagnostics, setShowDiagnostics] = useState(false);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successTicketId, setSuccessTicketId] = useState<string | null>(null);

	useEffect(() => {
		setMounted(true);
		initClientErrorTracker();
	}, []);

	// Sync when initialValues changes (e.g. from ErrorBoundary crash)
	useEffect(() => {
		if (initialValues) {
			if (initialValues.category) setCategory(initialValues.category);
			if (initialValues.urgency) setUrgency(initialValues.urgency);
			if (initialValues.title) setTitle(initialValues.title);
			if (initialValues.description) setDescription(initialValues.description);
		}
	}, [initialValues]);

	if (!mounted || !isOpen) return null;

	const activeTab = searchParams?.get("tab") || undefined;
	const activeDivision = searchParams?.get("division") || undefined;
	const currentUrl =
		typeof window !== "undefined"
			? window.location.href
			: `${pathname || ""}?${searchParams?.toString() || ""}`;

	const recentErrors = [
		...(initialValues?.additionalErrors || []),
		...getRecentClientErrors(),
	];

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) {
			setError("Please enter a short title or summary for your report.");
			return;
		}
		if (!description.trim()) {
			setError("Please enter details describing the issue or feedback.");
			return;
		}

		setError(null);
		setIsSubmitting(true);

		try {
			const viewportStr =
				typeof window !== "undefined"
					? `${window.innerWidth}x${window.innerHeight} (${window.devicePixelRatio}x)`
					: undefined;

			const isPwa =
				typeof window !== "undefined" &&
				(window.matchMedia("(display-mode: standalone)").matches ||
					(window.navigator as any).standalone === true);

			const result = await submitFeedbackAction({
				category,
				urgency,
				title: title.trim(),
				description: description.trim(),
				contactNote: contactNote.trim() || undefined,
				diagnostics: {
					url: currentUrl,
					tab: activeTab,
					division: activeDivision,
					userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
					viewport: viewportStr,
					isPwa,
					isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
					recentErrors: recentErrors.length > 0 ? recentErrors.slice(0, 5) : undefined,
				},
			});

			if (!result.success || !result.reportId) {
				setError(result.error || "Failed to submit report. Please try again.");
			} else {
				setSuccessTicketId(result.reportId);
			}
		} catch (err: any) {
			setError(err.message || "An unexpected network error occurred.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleResetAndClose = () => {
		setError(null);
		setSuccessTicketId(null);
		if (!initialValues) {
			setTitle("");
			setDescription("");
			setContactNote("");
			setCategory("BUG");
			setUrgency("NORMAL");
		}
		onClose();
	};

	const categories: { id: FeedbackCategory; label: string; icon: string }[] = [
		{ id: "BUG", label: "Bug / Error", icon: "🐛" },
		{ id: "DATA_DISCREPANCY", label: "Data Issue", icon: "📊" },
		{ id: "FEATURE_REQUEST", label: "Feature Request", icon: "💡" },
		{ id: "GENERAL", label: "Feedback", icon: "💬" },
	];

	const urgencies: { id: FeedbackUrgency; label: string; color: string }[] = [
		{ id: "LOW", label: "Low", color: "bg-slate-100 text-slate-700 border-slate-200" },
		{ id: "NORMAL", label: "Normal", color: "bg-blue-50 text-blue-700 border-blue-200" },
		{ id: "HIGH", label: "High", color: "bg-amber-50 text-amber-700 border-amber-200" },
		{ id: "CRITICAL", label: "Critical", color: "bg-rose-50 text-rose-700 border-rose-200" },
	];

	const modalContent = (
		<div
			className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
			onClick={(e) => {
				if (e.target === e.currentTarget && !isSubmitting) {
					handleResetAndClose();
				}
			}}
		>
			<div
				className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Modal Header */}
				<div className="flex items-center justify-between border-b border-slate-200 bg-[#0B2545] px-6 py-4 text-white">
					<div className="flex items-center gap-2.5">
						<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
							<svg
								className="h-5 w-5 text-[#38BDF8]"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
								/>
							</svg>
						</div>
						<div>
							<h3 className="font-bold text-base tracking-tight text-white">
								Report Issue & Feedback
							</h3>
							<p className="text-xs text-slate-300">
								Directly alerts developers & logs system diagnostics
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={handleResetAndClose}
						disabled={isSubmitting}
						className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
					>
						<svg
							className="h-5 w-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				{/* Modal Body */}
				<div className="flex-1 overflow-y-auto p-6">
					{successTicketId ? (
						<div className="py-8 text-center">
							<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4 shadow-inner">
								<svg
									className="h-9 w-9"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2.5"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							</div>
							<h4 className="text-xl font-bold text-slate-900 mb-1">
								Report Submitted Successfully!
							</h4>
							<p className="text-sm text-slate-600 mb-4">
								Your report has been logged and the developer team has been notified.
							</p>
							<div className="inline-block rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 mb-6">
								<span className="text-xs font-semibold uppercase text-emerald-800 mr-2">
									Ticket ID:
								</span>
								<code className="font-mono font-bold text-emerald-900 text-sm">
									{successTicketId}
								</code>
							</div>
							<div>
								<button
									type="button"
									onClick={handleResetAndClose}
									className="rounded-xl bg-[#0071BC] px-6 py-2.5 font-bold text-sm text-white shadow-sm transition hover:bg-[#134074]"
								>
									Done
								</button>
							</div>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="space-y-4">
							{error && (
								<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
									<svg
										className="h-4 w-4 flex-shrink-0 text-rose-500"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<path
											fillRule="evenodd"
											d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
											clipRule="evenodd"
										/>
									</svg>
									<span>{error}</span>
								</div>
							)}

							{/* Category Selection */}
							<div>
								<label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
									Category
								</label>
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
									{categories.map((cat) => (
										<button
											key={cat.id}
											type="button"
											onClick={() => setCategory(cat.id)}
											className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-xs font-semibold transition ${
												category === cat.id
													? "border-[#0071BC] bg-[#E0F2FE] text-[#0071BC] shadow-sm ring-1 ring-[#0071BC]"
													: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
											}`}
										>
											<span className="text-lg mb-1">{cat.icon}</span>
											<span className="text-center">{cat.label}</span>
										</button>
									))}
								</div>
							</div>

							{/* Urgency Selection */}
							<div>
								<label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
									Urgency Level
								</label>
								<div className="flex gap-2">
									{urgencies.map((urg) => (
										<button
											key={urg.id}
											type="button"
											onClick={() => setUrgency(urg.id)}
											className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition ${
												urgency === urg.id
													? `${urg.color} ring-2 ring-offset-1 ring-slate-400 font-extrabold shadow-sm`
													: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
											}`}
										>
											{urg.label}
										</button>
									))}
								</div>
							</div>

							{/* Title */}
							<div>
								<label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
									Subject / Summary <span className="text-rose-500">*</span>
								</label>
								<input
									type="text"
									required
									placeholder="Briefly describe what happened..."
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 transition focus:border-[#0071BC] focus:outline-none focus:ring-1 focus:ring-[#0071BC]"
								/>
							</div>

							{/* Description */}
							<div>
								<label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
									Detailed Description <span className="text-rose-500">*</span>
								</label>
								<textarea
									required
									rows={4}
									placeholder="Provide details: what did you click, what did you expect to see, or which invoice/stock row looks incorrect?"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 transition focus:border-[#0071BC] focus:outline-none focus:ring-1 focus:ring-[#0071BC]"
								></textarea>
							</div>

							{/* Optional Contact Note */}
							<div>
								<label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
									Alternative Contact Note <span className="font-normal lowercase text-slate-400">(optional)</span>
								</label>
								<input
									type="text"
									placeholder="Phone number or best time to reach you in field..."
									value={contactNote}
									onChange={(e) => setContactNote(e.target.value)}
									className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 transition focus:border-[#0071BC] focus:outline-none focus:ring-1 focus:ring-[#0071BC]"
								/>
							</div>

							{/* Auto-Captured Diagnostics Accordion */}
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
								<button
									type="button"
									onClick={() => setShowDiagnostics(!showDiagnostics)}
									className="flex w-full items-center justify-between text-left text-xs font-bold text-slate-600 hover:text-slate-900"
								>
									<span className="flex items-center gap-1.5">
										<svg
											className="h-3.5 w-3.5 text-[#0071BC]"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
										System Diagnostics (Auto-Attached)
									</span>
									<span className="text-slate-400 text-[10px]">
										{showDiagnostics ? "Hide ▲" : "Inspect ▼"}
									</span>
								</button>
								{showDiagnostics && (
									<div className="mt-2.5 border-t border-slate-200 pt-2 text-[11px] text-slate-600 font-mono space-y-1">
										<div><strong className="text-slate-700">URL:</strong> {currentUrl}</div>
										{activeTab && <div><strong className="text-slate-700">Tab:</strong> {activeTab}</div>}
										{activeDivision && <div><strong className="text-slate-700">Division:</strong> {activeDivision}</div>}
										<div><strong className="text-slate-700">Device:</strong> {typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 70) + "..." : "Browser"}</div>
										{recentErrors.length > 0 && (
											<div className="mt-1 text-rose-600">
												<strong>Client Errors Detected:</strong>
												<ul className="list-disc pl-4 mt-0.5">
													{recentErrors.slice(0, 3).map((err, i) => (
														<li key={i} className="truncate">{err}</li>
													))}
												</ul>
											</div>
										)}
									</div>
								)}
							</div>

							{/* Actions */}
							<div className="flex items-center justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={handleResetAndClose}
									disabled={isSubmitting}
									className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isSubmitting}
									className="flex items-center gap-1.5 rounded-xl bg-[#0071BC] px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#134074] disabled:opacity-60"
								>
									{isSubmitting ? (
										<>
											<svg
												className="h-3.5 w-3.5 animate-spin"
												fill="none"
												viewBox="0 0 24 24"
											>
												<circle
													className="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													strokeWidth="4"
												></circle>
												<path
													className="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
												></path>
											</svg>
											Submitting...
										</>
									) : (
										"Send Report"
									)}
								</button>
							</div>
						</form>
					)}
				</div>
			</div>
		</div>
	);

	return createPortal(modalContent, document.body);
}
