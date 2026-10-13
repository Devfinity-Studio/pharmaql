"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function DateRangePicker() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const currentFrom = searchParams.get("from") || "";
	const currentTo = searchParams.get("to") || "";

	const [from, setFrom] = useState(currentFrom);
	const [to, setTo] = useState(currentTo);

	useEffect(() => {
		setFrom(currentFrom);
		setTo(currentTo);
	}, [currentFrom, currentTo]);

	const applyFilter = (customFrom?: string, customTo?: string) => {
		const newFrom = customFrom !== undefined ? customFrom : from;
		const newTo = customTo !== undefined ? customTo : to;

		const params = new URLSearchParams(searchParams.toString());
		if (newFrom) params.set("from", newFrom);
		else params.delete("from");

		if (newTo) params.set("to", newTo);
		else params.delete("to");

		router.push(`?${params.toString()}`);
	};

	const clearFilter = () => {
		setFrom("");
		setTo("");
		const params = new URLSearchParams(searchParams.toString());
		params.delete("from");
		params.delete("to");
		router.push(`?${params.toString()}`);
	};

	const applyPreset = (
		presetType: "fy" | "this-month" | "last-month" | "90-days",
	) => {
		const today = new Date();
		const todayStr = today.toISOString().split("T")[0] ?? "";

		let presetFrom = "";
		let presetTo = todayStr;

		if (presetType === "fy") {
			// Financial Year 2026-27 (or 2026-04-01 to 2027-03-31)
			presetFrom = "2026-04-01";
			presetTo = "2026-09-30";
		} else if (presetType === "this-month") {
			const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
			presetFrom = firstDay.toISOString().split("T")[0] ?? "";
		} else if (presetType === "last-month") {
			const firstDayLastMonth = new Date(
				today.getFullYear(),
				today.getMonth() - 1,
				1,
			);
			const lastDayLastMonth = new Date(
				today.getFullYear(),
				today.getMonth(),
				0,
			);
			presetFrom = firstDayLastMonth.toISOString().split("T")[0] ?? "";
			presetTo = lastDayLastMonth.toISOString().split("T")[0] ?? "";
		} else if (presetType === "90-days") {
			const d90 = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
			presetFrom = d90.toISOString().split("T")[0] ?? "";
		}

		setFrom(presetFrom);
		setTo(presetTo);
		applyFilter(presetFrom, presetTo);
	};

	return (
		<div className="flex flex-col gap-2.5 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
			{/* Preset Shortcut Buttons */}
			<div className="flex flex-wrap items-center gap-1.5 border-gray-100 border-b pb-2.5">
				<span className="font-bold text-[11px] text-gray-400 uppercase tracking-wider">
					Presets:
				</span>
				<button
					className={`rounded-lg px-2.5 py-1 font-semibold text-xs transition ${
						from === "2026-04-01" && to === "2026-09-30"
							? "bg-[#0B2545] text-white"
							: "bg-gray-100 text-gray-700 hover:bg-gray-200"
					}`}
					onClick={() => applyPreset("fy")}
					type="button"
				>
					FY 2026-27
				</button>
				<button
					className="rounded-lg bg-gray-100 px-2.5 py-1 font-semibold text-gray-700 text-xs transition hover:bg-gray-200"
					onClick={() => applyPreset("this-month")}
					type="button"
				>
					This Month
				</button>
				<button
					className="rounded-lg bg-gray-100 px-2.5 py-1 font-semibold text-gray-700 text-xs transition hover:bg-gray-200"
					onClick={() => applyPreset("last-month")}
					type="button"
				>
					Last Month
				</button>
				<button
					className="rounded-lg bg-gray-100 px-2.5 py-1 font-semibold text-gray-700 text-xs transition hover:bg-gray-200"
					onClick={() => applyPreset("90-days")}
					type="button"
				>
					Last 90 Days
				</button>
			</div>

			{/* Manual Date Selectors */}
			<div className="flex flex-wrap items-end gap-3">
				<div>
					<label className="mb-1 block font-bold text-gray-500 text-xs uppercase tracking-wider">
						From Date
					</label>
					<input
						className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-medium text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-blue-500"
						onChange={(e) => setFrom(e.target.value)}
						type="date"
						value={from}
					/>
				</div>
				<div>
					<label className="mb-1 block font-bold text-gray-500 text-xs uppercase tracking-wider">
						To Date
					</label>
					<input
						className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-medium text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-blue-500"
						onChange={(e) => setTo(e.target.value)}
						type="date"
						value={to}
					/>
				</div>
				<button
					className="h-[38px] rounded-xl bg-blue-600 px-5 py-2 font-bold text-sm text-white shadow-sm transition hover:bg-blue-700"
					onClick={() => applyFilter()}
				>
					Apply
				</button>
				{(currentFrom || currentTo) && (
					<button
						className="h-[38px] rounded-xl bg-gray-100 px-4 py-2 font-bold text-gray-700 text-sm shadow-sm transition hover:bg-gray-200"
						onClick={clearFilter}
					>
						Clear
					</button>
				)}
			</div>
		</div>
	);
}
