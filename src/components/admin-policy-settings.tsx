"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import {
	updateTenantPolicyAction,
	type OverduePolicyConfig,
} from "@/server/actions/overduePolicy";
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	CalendarDays,
	ShieldAlert,
	ShieldCheck,
	Save,
} from "lucide-react";

interface AdminPolicySettingsProps {
	initialPolicy: OverduePolicyConfig;
	className?: string;
}

export function AdminPolicySettings({
	initialPolicy,
	className = "",
}: AdminPolicySettingsProps) {
	const [disabled, setDisabled] = useState<boolean>(initialPolicy.disabled);
	const [directBlockDays, setDirectBlockDays] = useState<number>(
		initialPolicy.directBlockDays ?? 90,
	);
	const [divisionBlockDays, setDivisionBlockDays] = useState<number>(
		initialPolicy.divisionBlockDays ?? 120,
	);
	const [maxDataDays, setMaxDataDays] = useState<string>(
		initialPolicy.maxDataDays ? String(initialPolicy.maxDataDays) : "",
	);

	const [isPending, startTransition] = useTransition();
	const [feedbackMsg, setFeedbackMsg] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const handleSave = (e: React.FormEvent) => {
		e.preventDefault();
		setFeedbackMsg(null);

		const parsedDirect = Math.max(1, Number(directBlockDays) || 90);
		const parsedDivision = Math.max(1, Number(divisionBlockDays) || 120);
		const parsedMaxData = maxDataDays.trim() ? Number(maxDataDays) : null;

		startTransition(async () => {
			const res = await updateTenantPolicyAction({
				disabled,
				directBlockDays: parsedDirect,
				divisionBlockDays: parsedDivision,
				maxDataDays: parsedMaxData,
			});

			if (res.success && res.policy) {
				setDisabled(res.policy.disabled);
				setDirectBlockDays(res.policy.directBlockDays);
				setDivisionBlockDays(res.policy.divisionBlockDays);
				setMaxDataDays(res.policy.maxDataDays ? String(res.policy.maxDataDays) : "");
				setFeedbackMsg({
					type: "success",
					text: "Policy settings successfully updated. Changes apply immediately across all MR accounts.",
				});
				setTimeout(() => setFeedbackMsg(null), 6000);
			} else {
				setFeedbackMsg({
					type: "error",
					text: res.error || "Failed to update policy settings. Please try again.",
				});
			}
		});
	};

	return (
		<div className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs ${className}`}>
			{/* Header */}
			<div className="border-gray-100 border-b bg-gradient-to-r from-gray-50/80 to-white px-6 py-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
							<Clock className="h-5 w-5" />
						</div>
						<div>
							<h3 className="font-extrabold text-[#0B2545] text-base sm:text-lg">
								Overdue & Data Visibility Controls
							</h3>
							<p className="font-medium text-gray-500 text-xs">
								Configure automated credit term suspensions and MR historical data access boundaries
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<span
							className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold text-xs ${
								disabled
									? "bg-amber-100 text-amber-900 border border-amber-200"
									: "bg-emerald-100 text-emerald-900 border border-emerald-200"
							}`}
						>
							{disabled ? (
								<>
									<ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
									Blocking Disabled
								</>
							) : (
								<>
									<ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
									Blocking Enforced
								</>
							)}
						</span>
					</div>
				</div>
			</div>

			{/* Form Body */}
			<form onSubmit={handleSave} className="p-6 space-y-6">
				{feedbackMsg && (
					<div
						className={`flex items-start gap-3 rounded-xl border p-4 text-xs font-medium ${
							feedbackMsg.type === "success"
								? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
								: "border-red-200 bg-red-50/70 text-red-900"
						}`}
					>
						{feedbackMsg.type === "success" ? (
							<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
						) : (
							<AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
						)}
						<div className="flex-1 leading-relaxed">{feedbackMsg.text}</div>
					</div>
				)}

				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
					{/* 1. Overdue Blocking Master Switch */}
					<div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-gray-50/50 p-4">
						<div>
							<label className="block font-bold text-[#0B2545] text-sm">
								Overdue Enforcement
							</label>
							<p className="mt-1 font-medium text-gray-500 text-xs">
								Auto-suspend MR accounts when invoices exceed credit terms
							</p>
						</div>
						<div className="mt-4 flex items-center justify-between">
							<span className="font-semibold text-xs text-gray-700">
								{disabled ? "Disabled (Permit All)" : "Enforced (Active)"}
							</span>
							<Switch
								checked={!disabled}
								disabled={isPending}
								onCheckedChange={(checked) => setDisabled(!checked)}
							/>
						</div>
					</div>

					{/* 2. Direct Overdue Block Days */}
					<div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
						<label className="block font-bold text-[#0B2545] text-sm">
							Direct Block (Days)
						</label>
						<p className="mt-1 font-medium text-gray-500 text-xs">
							Invoices older than this threshold immediately lock the MR
						</p>
						<div className="mt-3">
							<div className="relative">
								<input
									type="number"
									min="1"
									max="365"
									value={directBlockDays}
									onChange={(e) => setDirectBlockDays(Number(e.target.value))}
									disabled={isPending}
									className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-[#0B2545] focus:border-blue-500 focus:outline-none"
								/>
								<span className="absolute right-3 top-2.5 font-bold text-xs text-gray-400">
									days
								</span>
							</div>
						</div>
					</div>

					{/* 3. Division Cascading Block Days */}
					<div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
						<label className="block font-bold text-[#0B2545] text-sm">
							Division Block (Days)
						</label>
						<p className="mt-1 font-medium text-gray-500 text-xs">
							Division-wide suspension threshold for unresolved balances
						</p>
						<div className="mt-3">
							<div className="relative">
								<input
									type="number"
									min="1"
									max="365"
									value={divisionBlockDays}
									onChange={(e) => setDivisionBlockDays(Number(e.target.value))}
									disabled={isPending}
									className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-[#0B2545] focus:border-blue-500 focus:outline-none"
								/>
								<span className="absolute right-3 top-2.5 font-bold text-xs text-gray-400">
									days
								</span>
							</div>
						</div>
					</div>

					{/* 4. Max Historical Data Limit for MRs */}
					<div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
						<div className="flex items-center gap-1.5">
							<CalendarDays className="h-4 w-4 text-blue-600" />
							<label className="block font-bold text-[#0B2545] text-sm">
								MR Max Data Window
							</label>
						</div>
						<p className="mt-1 font-medium text-gray-500 text-xs">
							Max days past today visible to MRs. Blank or 0 = Unlimited
						</p>
						<div className="mt-3">
							<div className="relative">
								<input
									type="number"
									min="0"
									max="730"
									placeholder="e.g. 60 (Unlimited if blank)"
									value={maxDataDays}
									onChange={(e) => setMaxDataDays(e.target.value)}
									disabled={isPending}
									className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-[#0B2545] placeholder:font-normal placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
								/>
								<span className="absolute right-3 top-2.5 font-bold text-xs text-gray-400">
									days
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Footer CTA */}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-gray-100 border-t pt-4">
					<div className="text-xs text-gray-500 font-medium">
						{maxDataDays && Number(maxDataDays) > 0 ? (
							<span className="text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md inline-block font-semibold">
								MRs are restricted to the last {maxDataDays} days of data. Admins have 100% unrestricted access.
							</span>
						) : (
							<span>MRs have full historical data visibility across assigned financial years.</span>
						)}
					</div>

					<button
						type="submit"
						disabled={isPending}
						className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0071BC] px-5 py-2.5 font-bold text-sm text-white shadow-sm transition hover:bg-[#005c99] disabled:opacity-50"
					>
						<Save className="h-4 w-4" />
						{isPending ? "Saving Settings..." : "Save Policy Settings"}
					</button>
				</div>
			</form>
		</div>
	);
}

