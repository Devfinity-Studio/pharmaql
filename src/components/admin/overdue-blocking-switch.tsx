"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setOverdueBlockingStatusAction } from "@/server/actions/overduePolicy";
import { AlertCircle, CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";

interface OverdueBlockingSwitchProps {
	initialDisabled?: boolean;
	variant?: "card" | "compact" | "banner";
	className?: string;
}

export function OverdueBlockingSwitch({
	initialDisabled = false,
	variant = "card",
	className = "",
}: OverdueBlockingSwitchProps) {
	const [disabled, setDisabled] = useState<boolean>(initialDisabled);
	const [isPending, startTransition] = useTransition();
	const [feedbackMsg, setFeedbackMsg] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const handleToggle = (checked: boolean) => {
		// checked === true means "Enforce Blocking" (disabled = false)
		// checked === false means "Disable Blocking" (disabled = true)
		const nextDisabled = !checked;
		const previousState = disabled;

		// Optimistic update
		setDisabled(nextDisabled);
		setFeedbackMsg(null);

		startTransition(async () => {
			const res = await setOverdueBlockingStatusAction(nextDisabled);
			if (res.success) {
				setDisabled(res.disabled);
				setFeedbackMsg({
					type: "success",
					text: res.disabled
						? "MR overdue account blocking has been DISABLED. All MRs are permitted access."
						: "MR overdue account blocking has been ENFORCED. Accounts exceeding credit terms will be suspended.",
				});
				setTimeout(() => setFeedbackMsg(null), 6000);
			} else {
				// Revert on error
				setDisabled(previousState);
				setFeedbackMsg({
					type: "error",
					text: res.error || "Failed to update overdue blocking policy. Please try again.",
				});
			}
		});
	};

	if (variant === "compact") {
		return (
			<div
				className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition-all ${
					disabled
						? "border-amber-300 bg-amber-50 text-amber-900"
						: "border-emerald-300 bg-emerald-50 text-emerald-900"
				} ${className}`}
			>
				{disabled ? (
					<ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
				) : (
					<ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
				)}
				<div className="flex flex-col">
					<span className="font-bold">
						{disabled ? "Overdue Blocking: OFF" : "Overdue Blocking: ON"}
					</span>
					<span className="text-[10px] opacity-75">
						{disabled ? "MRs with >90d permitted" : "MRs >90d blocked"}
					</span>
				</div>
				<div className="ml-auto flex items-center gap-2">
					<Switch
						checked={!disabled}
						disabled={isPending}
						onCheckedChange={handleToggle}
						aria-label="Toggle Overdue Blocking"
					/>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all ${
				disabled
					? "border-amber-300 bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 text-amber-950"
					: "border-slate-200 bg-white text-slate-900"
			} ${className}`}
		>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-start gap-3.5">
					<div
						className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
							disabled
								? "border-amber-300 bg-amber-100 text-amber-700"
								: "border-blue-200 bg-blue-50 text-[#0071BC]"
						}`}
					>
						{disabled ? (
							<ShieldAlert className="h-6 w-6 text-amber-600 animate-pulse" />
						) : (
							<ShieldCheck className="h-6 w-6 text-[#0071BC]" />
						)}
					</div>
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="font-extrabold text-base tracking-tight text-slate-900">
								MR Overdue Account Blocking
							</h3>
							{disabled ? (
								<span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800 text-xs">
									<AlertCircle className="h-3 w-3" />
									SUSPENDED / DISABLED
								</span>
							) : (
								<span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800 text-xs">
									<CheckCircle2 className="h-3 w-3" />
									ACTIVE / ENFORCED
								</span>
							)}
						</div>
						<p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-2xl">
							{disabled ? (
								<span className="font-medium text-amber-900">
									Automatic overdue blocking is currently <strong>TURNED OFF</strong>. All Medical Representatives can log in, view catalogs, and place orders regardless of pending customer invoices or 90-day overdue limits.
								</span>
							) : (
								<span>
									When enforced, Medical Representatives with customer invoices overdue &gt; 90 days (or &gt; 95 days division collateral) are automatically blocked from logging in.
								</span>
							)}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3 sm:self-center pl-14 sm:pl-0">
					<div className="text-right">
						<span className="block font-bold text-xs text-slate-700">
							{disabled ? "Blocking Disabled" : "Enforce Blocking"}
						</span>
						<span className="block text-[11px] text-slate-500">
							{isPending ? "Updating policy..." : disabled ? "Click to enforce" : "Click to disable"}
						</span>
					</div>
					<Switch
						checked={!disabled}
						disabled={isPending}
						onCheckedChange={handleToggle}
						aria-label="Toggle MR Overdue Blocking"
						className={disabled ? "data-[state=unchecked]:bg-amber-400" : ""}
					/>
				</div>
			</div>

			{feedbackMsg && (
				<div
					className={`mt-4 flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all ${
						feedbackMsg.type === "success"
							? "border-emerald-300 bg-emerald-50 text-emerald-800"
							: "border-red-300 bg-red-50 text-red-800"
					}`}
				>
					{feedbackMsg.type === "success" ? (
						<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
					) : (
						<AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
					)}
					<span>{feedbackMsg.text}</span>
				</div>
			)}
		</div>
	);
}

