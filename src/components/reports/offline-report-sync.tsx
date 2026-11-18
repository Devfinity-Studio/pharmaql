"use client";

import { useEffect } from "react";
import { saveReportSnapshot } from "@/lib/offline-store";

interface OfflineReportSyncProps {
	mrId: string;
	tab: string;
	data: any;
	params?: Record<string, any>;
}

/**
 * Client component that silently sanitizes and persists the active report data
 * into the current MR's isolated offline store whenever a live report is rendered.
 */
export function OfflineReportSync({
	mrId,
	tab,
	data,
	params,
}: OfflineReportSyncProps) {
	useEffect(() => {
		if (typeof window !== "undefined" && mrId && tab && data) {
			// Save sanitized snapshot asynchronously without blocking UI
			saveReportSnapshot(mrId, tab, data, params).catch((err) => {
				console.warn(`[OfflineSync] Failed to cache snapshot for ${tab}:`, err);
			});
		}
	}, [mrId, tab, data, params]);

	return null;
}
