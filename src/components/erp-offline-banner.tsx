"use client";

import React, { useState } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

interface ErpOfflineBannerProps {
	isOffline?: boolean;
	onRetry?: () => Promise<void> | void;
}

export function ErpOfflineBanner({ isOffline = false, onRetry }: ErpOfflineBannerProps) {
	const [dismissed, setDismissed] = useState(false);
	const [retrying, setRetrying] = useState(false);

	if (!isOffline || dismissed) return null;

	const handleRetry = async () => {
		setRetrying(true);
		try {
			if (onRetry) {
				await onRetry();
			} else {
				window.location.reload();
			}
		} finally {
			setRetrying(false);
		}
	};

	return (
		<div className="relative z-40 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-amber-200 backdrop-blur-md">
			<div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs">
				<div className="flex items-center gap-2">
					<AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" />
					<span>
						<strong className="font-semibold text-white">ERP Bridge Sync Paused:</strong> Real-time on-premise inventory sync is currently offline. You are viewing cached data.
					</span>
				</div>

				<div className="flex items-center gap-2 shrink-0">
					<button
						onClick={handleRetry}
						disabled={retrying}
						className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition disabled:opacity-50"
					>
						<RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
						<span>{retrying ? "Retrying..." : "Retry Sync"}</span>
					</button>

					<button
						onClick={() => setDismissed(true)}
						className="rounded p-1 text-amber-400 hover:bg-amber-500/20 transition"
						title="Dismiss banner"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</div>
	);
}
