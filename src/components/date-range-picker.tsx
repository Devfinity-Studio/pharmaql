"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export interface DateRangePickerProps {
	singleDateMode?: boolean;
	singleDateLabel?: string;
	showReceivedDate?: boolean;
	minDate?: string;
	maxDataDays?: number | null;
}

export function DateRangePicker({
	singleDateMode = false,
	singleDateLabel = "AsOn Date",
	showReceivedDate = false,
	minDate,
	maxDataDays,
}: DateRangePickerProps = {}) {
	const router = useRouter();
	const searchParams = useSearchParams();

	const currentFrom = searchParams.get("from") || "";
	const currentTo = searchParams.get("asOn") || searchParams.get("to") || "";
	const currentRec =
		searchParams.get("recDate") || searchParams.get("receivedDate") || currentTo;

	const [from, setFrom] = useState(currentFrom);
	const [to, setTo] = useState(currentTo);
	const [recDate, setRecDate] = useState(currentRec);

	useEffect(() => {
		setFrom(currentFrom);
		setTo(currentTo);
		setRecDate(currentRec);
	}, [currentFrom, currentTo, currentRec]);

	const clampWithMin = (dateVal?: string): string => {
		if (!dateVal) return "";
		if (minDate && dateVal < minDate) return minDate;
		return dateVal;
	};

	const applyFilter = (
		customFrom?: string,
		customTo?: string,
		customRec?: string,
	) => {
		let newFrom = customFrom !== undefined ? customFrom : from;
		let newTo = customTo !== undefined ? customTo : to;
		let newRec = customRec !== undefined ? customRec : recDate;

		if (minDate) {
			if (newFrom && newFrom < minDate) newFrom = minDate;
			if (newTo && newTo < minDate) newTo = minDate;
			if (newRec && newRec < minDate) newRec = minDate;
		}

		const params = new URLSearchParams(searchParams.toString());
		if (showReceivedDate) {
			params.delete("from");
			if (newTo) {
				params.set("to", newTo);
				params.set("asOn", newTo);
			} else {
				params.delete("to");
				params.delete("asOn");
			}
			if (newRec) {
				params.set("recDate", newRec);
			} else {
				params.delete("recDate");
			}
		} else if (singleDateMode) {
			params.delete("from");
			params.delete("recDate");
			if (newTo) {
				params.set("to", newTo);
				params.set("asOn", newTo);
			} else {
				params.delete("to");
				params.delete("asOn");
			}
		} else {
			params.delete("asOn");
			params.delete("recDate");
			if (newFrom) params.set("from", newFrom);
			else params.delete("from");

			if (newTo) params.set("to", newTo);
			else params.delete("to");
		}

		router.push(`?${params.toString()}`);
	};

	const clearFilter = () => {
		setFrom("");
		setTo("");
		setRecDate("");
		const params = new URLSearchParams(searchParams.toString());
		params.delete("from");
		params.delete("to");
		params.delete("asOn");
		params.delete("recDate");
		router.push(`?${params.toString()}`);
	};

	const applyPreset = (presetType: string) => {
		const today = new Date();
		const formatDate = (d: Date) => {
			const y = d.getFullYear();
			const m = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			return `${y}-${m}-${day}`;
		};

		const todayStr = formatDate(today);

		if (singleDateMode) {
			if (presetType === "last-month") {
				const lastDayLastMonth = new Date(
					today.getFullYear(),
					today.getMonth(),
					0,
				);
				const lastMonthEndStr = clampWithMin(formatDate(lastDayLastMonth));
				setTo(lastMonthEndStr);
				applyFilter(undefined, lastMonthEndStr);
				return;
			}
			setTo(todayStr);
			applyFilter(undefined, todayStr);
			return;
		}

		let presetFrom = "";
		let presetTo = todayStr;

		if (presetType === "fy") {
			presetFrom = clampWithMin("2026-04-01");
			presetTo = clampWithMin("2026-09-30");
		} else if (presetType === "this-month") {
			const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
			presetFrom = clampWithMin(formatDate(firstDay));
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
			presetFrom = clampWithMin(formatDate(firstDayLastMonth));
			presetTo = clampWithMin(formatDate(lastDayLastMonth));
		} else if (presetType === "90-days") {
			const d90 = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
			presetFrom = clampWithMin(formatDate(d90));
		}

		setFrom(presetFrom);
		setTo(presetTo);
		applyFilter(presetFrom, presetTo);
	};

	const maxDataBadge = minDate ? (
		<span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
			Max History: {maxDataDays ? `${maxDataDays}d` : `since ${minDate}`}
		</span>
	) : null;

	if (showReceivedDate) {
		return (
			<div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm ring-1 ring-black/5">
				<div className="flex flex-wrap items-end gap-3">
					<div>
						<div className="flex items-center justify-between mb-1">
							<label className="block font-bold text-gray-700 text-xs uppercase tracking-wider">
								AsOn Date
							</label>
						</div>
						<input
							className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-medium text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-blue-500"
							min={minDate}
							onChange={(e) => {
								const val = e.target.value;
								setTo(val);
								if (!recDate || recDate === to) setRecDate(val);
							}}
							type="date"
							value={to}
						/>
					</div>
					<div>
						<label className="mb-1 block font-bold text-gray-700 text-xs uppercase tracking-wider">
							Received Date
						</label>
						<input
							className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-medium text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-blue-500"
							min={minDate}
							onChange={(e) => setRecDate(e.target.value)}
							type="date"
							value={recDate || to}
						/>
					</div>
					<button
						className="h-[38px] rounded-xl bg-blue-600 px-5 py-2 font-bold text-sm text-white shadow-sm transition hover:bg-blue-700"
						onClick={() => applyFilter()}
						type="button"
					>
						Apply
					</button>
					<button
						className="h-[38px] rounded-xl bg-gray-100 px-3 py-2 font-semibold text-gray-700 text-xs shadow-sm transition hover:bg-gray-200"
						onClick={() => applyPreset("today")}
						type="button"
					>
						Today
					</button>
					<button
						className="h-[38px] rounded-xl bg-gray-100 px-3 py-2 font-semibold text-gray-700 text-xs shadow-sm transition hover:bg-gray-200"
						onClick={() => applyPreset("last-month")}
						type="button"
					>
						Prev Month End
					</button>
					{(currentTo || currentRec) && (
						<button
							className="h-[38px] rounded-xl bg-gray-100 px-4 py-2 font-bold text-gray-700 text-sm shadow-sm transition hover:bg-gray-200"
							onClick={clearFilter}
							type="button"
						>
							Clear
						</button>
					)}
					{maxDataBadge}
				</div>
			</div>
		);
	}

	if (singleDateMode) {
		return (
			<div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm ring-1 ring-black/5">
				<div className="flex flex-wrap items-end gap-3">
					<div>
						<label className="mb-1 block font-bold text-gray-700 text-xs uppercase tracking-wider">
							{singleDateLabel}
						</label>
						<input
							className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-medium text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-blue-500"
							min={minDate}
							onChange={(e) => setTo(e.target.value)}
							type="date"
							value={to}
						/>
					</div>
					<button
						className="h-[38px] rounded-xl bg-blue-600 px-5 py-2 font-bold text-sm text-white shadow-sm transition hover:bg-blue-700"
						onClick={() => applyFilter()}
						type="button"
					>
						Apply
					</button>
					<button
						className="h-[38px] rounded-xl bg-gray-100 px-3 py-2 font-semibold text-gray-700 text-xs shadow-sm transition hover:bg-gray-200"
						onClick={() => applyPreset("today")}
						type="button"
					>
						Today
					</button>
					<button
						className="h-[38px] rounded-xl bg-gray-100 px-3 py-2 font-semibold text-gray-700 text-xs shadow-sm transition hover:bg-gray-200"
						onClick={() => applyPreset("last-month")}
						type="button"
					>
						Prev Month End
					</button>
					{(currentFrom || currentTo) && (
						<button
							className="h-[38px] rounded-xl bg-gray-100 px-4 py-2 font-bold text-gray-700 text-sm shadow-sm transition hover:bg-gray-200"
							onClick={clearFilter}
							type="button"
						>
							Clear
						</button>
					)}
					{maxDataBadge}
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2.5 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm ring-1 ring-black/5">
			{/* Preset Shortcut Buttons */}
			<div className="flex flex-wrap items-center gap-1.5 border-gray-200 border-b pb-2.5">
				<span className="font-bold text-[11px] text-gray-600 uppercase tracking-wider">
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
				{maxDataBadge}
			</div>

			{/* Manual Date Selectors */}
			<div className="flex flex-wrap items-end gap-3">
				<div>
					<label className="mb-1 block font-bold text-gray-500 text-xs uppercase tracking-wider">
						From Date
					</label>
					<input
						className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-medium text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-blue-500"
						min={minDate}
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
						min={minDate}
						onChange={(e) => setTo(e.target.value)}
						type="date"
						value={to}
					/>
				</div>
				<button
					className="h-[38px] rounded-xl bg-blue-600 px-5 py-2 font-bold text-sm text-white shadow-sm transition hover:bg-blue-700"
					onClick={() => applyFilter()}
					type="button"
				>
					Apply
				</button>
				{(currentFrom || currentTo) && (
					<button
						className="h-[38px] rounded-xl bg-gray-100 px-4 py-2 font-bold text-gray-700 text-sm shadow-sm transition hover:bg-gray-200"
						onClick={clearFilter}
						type="button"
					>
						Clear
					</button>
				)}
			</div>
		</div>
	);
}
