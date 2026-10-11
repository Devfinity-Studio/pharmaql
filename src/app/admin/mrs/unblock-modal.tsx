"use client";

import { useState } from "react";
import { secureAdminUnblockMR } from "@/server/actions/adminUnblockActions";

interface Props {
	mrId: string;
	mrName: string;
	statusLabel: string;
	onSuccess?: () => void;
}

export function AdminUnblockModal({
	mrId,
	mrName,
	statusLabel,
	onSuccess,
}: Props) {
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
				className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white text-xs shadow transition hover:bg-emerald-700"
				onClick={() => {
					setIsOpen(true);
					setError(null);
					setSuccessMsg(null);
				}}
				type="button"
			>
				Unblock MR
			</button>

			{isOpen && (
				<div className="fade-in fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
					<div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
						<div className="flex items-start justify-between border-b pb-3">
							<div>
								<div className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-[11px] text-emerald-800 uppercase">
									Security Gate
								</div>
								<h3 className="mt-1 font-extrabold text-gray-900 text-lg">
									Confirm Unblock: {mrName}
								</h3>
								<p className="text-gray-500 text-xs">
									Current Status:{" "}
									<span className="font-semibold text-red-600">
										{statusLabel}
									</span>
								</p>
							</div>
							<button
								className="font-bold text-gray-400 text-lg hover:text-gray-600"
								onClick={() => setIsOpen(false)}
								type="button"
							>
								&times;
							</button>
						</div>

						{error && (
							<div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 font-semibold text-red-700 text-xs">
								{error}
							</div>
						)}

						{successMsg && (
							<div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 font-semibold text-emerald-800 text-xs">
								{successMsg}
							</div>
						)}

						<form className="mt-4 space-y-4 text-xs" onSubmit={handleUnblock}>
							<div>
								<label className="block font-bold text-gray-700">
									Admin Password <span className="text-red-500">*</span>
								</label>
								<input
									className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
									onChange={(e) => setAdminPassword(e.target.value)}
									placeholder="Enter master admin password"
									required
									type="password"
									value={adminPassword}
								/>
								<span className="text-[11px] text-gray-500">
									Confirmation password is required for unblocking even when
									logged in.
								</span>
							</div>

							<div>
								<label className="block font-bold text-gray-700">
									Exemption / Grace Period (Days)
								</label>
								<select
									className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
									onChange={(e) => setExemptionDays(Number(e.target.value))}
									value={exemptionDays}
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
									className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
									onChange={(e) => setReason(e.target.value)}
									placeholder="e.g. Payment committed via cheque #1234 on Monday"
									rows={2}
									value={reason}
								/>
							</div>

							<div className="flex justify-end gap-2 border-t pt-2">
								<button
									className="rounded-lg bg-gray-100 px-4 py-2 font-bold text-gray-700 hover:bg-gray-200"
									disabled={isLoading}
									onClick={() => setIsOpen(false)}
									type="button"
								>
									Cancel
								</button>
								<button
									className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
									disabled={isLoading}
									type="submit"
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
