"use client";

import { useState } from "react";
import { secureAdminUnblockMR } from "@/server/actions/adminUnblockActions";

interface Props {
	mrId: string;
	mrName: string;
	statusLabel: string;
	onSuccess?: () => void;
}

export function AdminUnblockModal({ mrId, mrName, statusLabel, onSuccess }: Props) {
	const [isOpen, setIsOpen] = useState(false);
	const [adminPassword, setAdminPassword] = useState("");
	const [reason, setReason] = useState("");
	const [exemptionDays, setExemptionDays] = useState(7);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	const handleUnblock = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccessMsg(null);
		setIsLoading(true);

		try {
			const res = await secureAdminUnblockMR({
				mrId,
				adminPassword,
				reason,
				exemptionDays: Number(exemptionDays),
			});

			if (!res.success) {
				setError(res.error || "Failed to unblock MR.");
			} else {
				setSuccessMsg(res.message || "MR successfully unblocked!");
				setTimeout(() => {
					setIsOpen(false);
					setAdminPassword("");
					setReason("");
					if (onSuccess) onSuccess();
				}, 1500);
			}
		} catch (err: any) {
			setError(err.message || "An unexpected error occurred.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<button
				type="button"
				onClick={() => {
					setIsOpen(true);
					setError(null);
					setSuccessMsg(null);
				}}
				className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-xs text-white shadow hover:bg-emerald-700 transition"
			>
				Unblock MR
			</button>

			{isOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
						<div className="flex items-start justify-between border-b pb-3">
							<div>
								<div className="rounded-full bg-emerald-100 px-2.5 py-0.5 inline-block font-bold text-emerald-800 text-[11px] uppercase">
									Security Gate
								</div>
								<h3 className="mt-1 font-extrabold text-gray-900 text-lg">
									Confirm Unblock: {mrName}
								</h3>
								<p className="text-gray-500 text-xs">
									Current Status: <span className="font-semibold text-red-600">{statusLabel}</span>
								</p>
							</div>
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								className="text-gray-400 hover:text-gray-600 font-bold text-lg"
							>
								&times;
							</button>
						</div>

						{error && (
							<div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
								{error}
							</div>
						)}

						{successMsg && (
							<div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
								{successMsg}
							</div>
						)}

						<form onSubmit={handleUnblock} className="mt-4 space-y-4 text-xs">
							<div>
								<label className="block font-bold text-gray-700">
									Admin Password <span className="text-red-500">*</span>
								</label>
								<input
									type="password"
									required
									placeholder="Enter master admin password"
									value={adminPassword}
									onChange={(e) => setAdminPassword(e.target.value)}
									className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
								/>
								<span className="text-[11px] text-gray-500">
									Confirmation password is required for unblocking even when logged in.
								</span>
							</div>

							<div>
								<label className="block font-bold text-gray-700">
									Exemption / Grace Period (Days)
								</label>
								<select
									value={exemptionDays}
									onChange={(e) => setExemptionDays(Number(e.target.value))}
									className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
								>
									<option value={3}>3 Days Grace</option>
									<option value={7}>7 Days Grace (Default)</option>
									<option value={15}>15 Days Grace</option>
									<option value={30}>30 Days Grace</option>
								</select>
							</div>

							<div>
								<label className="block font-bold text-gray-700">
									Unblock Reason / Note
								</label>
								<textarea
									rows={2}
									placeholder="e.g. Payment committed via cheque #1234 on Monday"
									value={reason}
									onChange={(e) => setReason(e.target.value)}
									className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
								/>
							</div>

							<div className="flex justify-end gap-2 pt-2 border-t">
								<button
									type="button"
									disabled={isLoading}
									onClick={() => setIsOpen(false)}
									className="rounded-lg bg-gray-100 px-4 py-2 font-bold text-gray-700 hover:bg-gray-200"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={isLoading}
									className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
								>
									{isLoading ? "Verifying..." : "Authorize Unblock"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
