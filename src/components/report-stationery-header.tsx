"use client";

import Image from "next/image";
import React from "react";
import { useTenant } from "@/lib/tenant-context";

export interface ReportStationeryHeaderProps {
	title: string;
	fromDisplay?: string;
	toDisplay?: string;
	year?: string;
	summaryRight?: React.ReactNode;
	className?: string;
}

export function ReportStationeryHeader({
	title,
	fromDisplay,
	toDisplay,
	year = "2026-27",
	summaryRight,
	className = "",
}: ReportStationeryHeaderProps) {
	const tenant = useTenant();

	return (
		<div className={`border-gray-900 border-b-2 pb-2 ${className}`}>
			<div className="flex flex-col items-start justify-between gap-3 md:flex-row">
				<div className="flex items-start gap-4">
					<div className="flex-shrink-0">
						<Image
							alt={`${tenant.displayName} Logo`}
							className="object-contain pt-0.5"
							height={45}
							priority
							src={tenant.logoUrl || "/devfinity.png"}
							width={140}
							unoptimized
						/>
					</div>
					<div>
						<h1 className="font-extrabold text-base text-gray-900 uppercase tracking-tight">
							{tenant.displayName}
						</h1>
						<p className="mt-0.5 text-[11px] text-gray-700 leading-tight whitespace-pre-line">
							{tenant.address}
							{tenant.phone || tenant.email || tenant.gstin ? (
								<>
									<br />
									{tenant.phone ? `Contact: ${tenant.phone} ` : ""}
									{tenant.email ? `Email: ${tenant.email} ` : ""}
									{tenant.gstin ? `GSTIN: ${tenant.gstin}` : ""}
								</>
							) : null}
						</p>
					</div>
				</div>
			</div>

			<div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-gray-300 border-t pt-1.5 font-bold text-gray-900 text-xs">
				<div>Year : {year}</div>
				<div className="text-center font-extrabold text-[#0B2545] text-xs">
					{title}
					{fromDisplay && toDisplay
						? ` for Period of ${fromDisplay} to ${toDisplay}`
						: fromDisplay
							? ` as of ${fromDisplay}`
							: ""}
				</div>
				<div className="text-right font-medium text-[11px] text-gray-600">
					{summaryRight || null}
				</div>
			</div>
		</div>
	);
}
