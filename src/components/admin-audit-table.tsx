"use client";

import React, { useState } from "react";
import {
	AlertTriangle,
	ArrowDownToLine,
	CheckCircle2,
	Filter,
	Key,
	Lock,
	LogOut,
	ShieldAlert,
	ShieldCheck,
	UserX,
} from "lucide-react";
import type { AuditLogEntry, AuditEventType } from "@/lib/audit-logger";

interface AdminAuditTableProps {
	initialLogs: AuditLogEntry[];
}

export function AdminAuditTable({ initialLogs }: AdminAuditTableProps) {
	const [selectedEvent, setSelectedEvent] = useState<string>("ALL");
	const [searchQuery, setSearchQuery] = useState<string>("");

	// Filter logs
	const filteredLogs = initialLogs.filter((log) => {
		if (selectedEvent !== "ALL" && log.event !== selectedEvent) {
			return false;
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			const matchIp = log.ip.toLowerCase().includes(q);
			const matchEmail = log.userEmail?.toLowerCase().includes(q) || false;
			const matchEvent = log.event.toLowerCase().includes(q);
			const matchDetails = JSON.stringify(log.details || {}).toLowerCase().includes(q);
			return matchIp || matchEmail || matchEvent || matchDetails;
		}
		return true;
	});

	// Metrics
	const totalEvents = initialLogs.length;
	const successfulLogins = initialLogs.filter((l) => l.event === "AUTH_LOGIN_SUCCESS").length;
	const failures = initialLogs.filter(
		(l) => l.event === "AUTH_LOGIN_FAILURE" || l.event === "OTP_VERIFY_FAILURE" || l.event === "SECURITY_WARNING",
	).length;
	const rateLimits = initialLogs.filter((l) => l.event === "RATE_LIMIT_EXCEEDED").length;
	const unblocks = initialLogs.filter((l) => l.event === "ADMIN_UNBLOCK").length;

	const formatTimestampDeterministic = (isoString: string) => {
		try {
			const d = new Date(isoString);
			if (isNaN(d.getTime())) {
				return { dateStr: isoString, timeStr: "" };
			}
			const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			const month = months[d.getUTCMonth()] || "Oct";
			const day = String(d.getUTCDate()).padStart(2, "0");
			const year = d.getUTCFullYear();
			const hours = String(d.getUTCHours()).padStart(2, "0");
			const minutes = String(d.getUTCMinutes()).padStart(2, "0");
			const seconds = String(d.getUTCSeconds()).padStart(2, "0");
			return {
				dateStr: `${month} ${day}, ${year}`,
				timeStr: `${hours}:${minutes}:${seconds} UTC`,
			};
		} catch {
			return { dateStr: isoString, timeStr: "" };
		}
	};

	const getEventBadge = (event: AuditEventType) => {
		switch (event) {
			case "AUTH_LOGIN_SUCCESS":
			case "OTP_VERIFY_SUCCESS":
				return (
					<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800 text-xs">
						<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
						{event}
					</span>
				);
			case "AUTH_LOGIN_FAILURE":
			case "OTP_VERIFY_FAILURE":
				return (
					<span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 font-bold text-rose-800 text-xs">
						<UserX className="h-3.5 w-3.5 text-rose-600" />
						{event}
					</span>
				);
			case "RATE_LIMIT_EXCEEDED":
				return (
					<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800 text-xs">
						<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
						RATE_LIMIT
					</span>
				);
			case "SECURITY_WARNING":
				return (
					<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 font-bold text-red-900 text-xs">
						<ShieldAlert className="h-3.5 w-3.5 text-red-700" />
						SECURITY_ALERT
					</span>
				);
			case "ADMIN_UNBLOCK":
				return (
					<span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 font-bold text-purple-800 text-xs">
						<Lock className="h-3.5 w-3.5 text-purple-600" />
						UNBLOCK_OVERRIDE
					</span>
				);
			case "EXPORT_DOWNLOAD":
				return (
					<span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 font-bold text-blue-800 text-xs">
						<ArrowDownToLine className="h-3.5 w-3.5 text-blue-600" />
						EXPORT_DOWNLOAD
					</span>
				);
			case "OTP_REQUEST":
				return (
					<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-800 text-xs">
						<Key className="h-3.5 w-3.5 text-slate-600" />
						OTP_REQUEST
					</span>
				);
			case "AUTH_LOGOUT":
				return (
					<span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 font-bold text-gray-700 text-xs">
						<LogOut className="h-3.5 w-3.5 text-gray-500" />
						AUTH_LOGOUT
					</span>
				);
			default:
				return (
					<span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 font-bold text-gray-800 text-xs">
						{event}
					</span>
				);
		}
	};

	return (
		<div className="space-y-6">
			{/* Metric Cards */}
			<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
				<div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
					<div className="font-semibold text-gray-500 text-xs uppercase">Total Events</div>
					<div className="mt-1 font-black text-2xl text-gray-900">{totalEvents}</div>
				</div>
				<div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-xs">
					<div className="font-semibold text-emerald-700 text-xs uppercase">Logins Success</div>
					<div className="mt-1 font-black text-2xl text-emerald-700">{successfulLogins}</div>
				</div>
				<div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 shadow-xs">
					<div className="font-semibold text-rose-700 text-xs uppercase">Failures / Alerts</div>
					<div className="mt-1 font-black text-2xl text-rose-700">{failures}</div>
				</div>
				<div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-xs">
					<div className="font-semibold text-amber-700 text-xs uppercase">Rate Limits</div>
					<div className="mt-1 font-black text-2xl text-amber-700">{rateLimits}</div>
				</div>
				<div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 shadow-xs">
					<div className="font-semibold text-purple-700 text-xs uppercase">Unblock Overrides</div>
					<div className="mt-1 font-black text-2xl text-purple-700">{unblocks}</div>
				</div>
			</div>

			{/* Search and Filters */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative flex-1">
					<input
						className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-900 text-sm shadow-xs placeholder:text-gray-400 focus:border-[#0071BC] focus:outline-none focus:ring-1 focus:ring-[#0071BC]"
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search by IP, email, event type or details..."
						type="text"
						value={searchQuery}
					/>
				</div>
				<div className="flex items-center gap-2">
					<Filter className="h-4 w-4 text-gray-400" />
					<select
						className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-bold text-gray-700 text-sm shadow-xs focus:border-[#0071BC] focus:outline-none"
						onChange={(e) => setSelectedEvent(e.target.value)}
						value={selectedEvent}
					>
						<option value="ALL">All Event Types</option>
						<option value="AUTH_LOGIN_SUCCESS">Login Success</option>
						<option value="AUTH_LOGIN_FAILURE">Login Failure</option>
						<option value="OTP_REQUEST">OTP Requests</option>
						<option value="OTP_VERIFY_FAILURE">OTP Failures</option>
						<option value="RATE_LIMIT_EXCEEDED">Rate Limit Exceeded</option>
						<option value="ADMIN_UNBLOCK">Admin Unblocks</option>
						<option value="EXPORT_DOWNLOAD">Export Downloads</option>
						<option value="SECURITY_WARNING">Security Warnings</option>
					</select>
				</div>
			</div>

			{/* Log Table */}
			<div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead className="border-gray-200 border-b bg-gray-50/80 font-bold text-gray-600 text-xs uppercase tracking-wider">
							<tr>
								<th className="px-4 py-3.5">Timestamp</th>
								<th className="px-4 py-3.5">Event</th>
								<th className="px-4 py-3.5">User / Target</th>
								<th className="px-4 py-3.5">IP Address</th>
								<th className="px-4 py-3.5">Details</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{filteredLogs.length === 0 ? (
								<tr>
									<td className="px-6 py-12 text-center text-gray-400" colSpan={5}>
										No audit log events found matching your filter criteria.
									</td>
								</tr>
							) : (
								filteredLogs.map((log) => {
									const { dateStr, timeStr } = formatTimestampDeterministic(log.timestamp);

									return (
										<tr className="hover:bg-gray-50/50 transition-colors" key={log.id}>
											<td className="whitespace-nowrap px-4 py-3">
												<div
													className="font-semibold text-gray-900 text-xs"
													suppressHydrationWarning
												>
													{dateStr}
												</div>
												<div
													className="text-[11px] text-gray-500 font-mono"
													suppressHydrationWarning
												>
													{timeStr}
												</div>
											</td>
											<td className="px-4 py-3">{getEventBadge(log.event)}</td>
											<td className="px-4 py-3">
												<div className="font-bold text-gray-900 text-xs">
													{log.userEmail || log.userId || "Anonymous"}
												</div>
												{log.role && (
													<span className="font-semibold text-[10px] text-gray-400">
														Role: {log.role}
													</span>
												)}
											</td>
											<td className="whitespace-nowrap px-4 py-3">
												<span className="font-mono font-medium text-xs text-gray-700 bg-gray-100 rounded px-1.5 py-0.5">
													{log.ip}
												</span>
											</td>
											<td className="px-4 py-3">
												{log.details ? (
													<div className="max-w-xs md:max-w-md truncate text-xs text-gray-600 font-mono">
														{Object.entries(log.details).map(([k, v]) => (
															<span className="mr-2 inline-block" key={k}>
																<span className="font-semibold text-gray-800">{k}:</span>{" "}
																<span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
															</span>
														))}
													</div>
												) : (
													<span className="text-gray-400 text-xs">—</span>
												)}
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
