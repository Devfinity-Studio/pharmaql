"use client";

import React, { useEffect, useState } from "react";
import { HardDrive, Wifi, WifiOff } from "lucide-react";
import { OfflineReportViewer } from "@/components/offline-report-viewer";

interface OfflineIndicatorProps {
	mrId?: string;
	mrName?: string;
}

export function OfflineIndicator({ mrId, mrName }: OfflineIndicatorProps) {
	const [isOnline, setIsOnline] = useState(true);
	const [showBackOnlineNotice, setShowBackOnlineNotice] = useState(false);
	const [isViewerOpen, setIsViewerOpen] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;

		setIsOnline(navigator.onLine);

		const handleOnline = () => {
			setIsOnline(true);
			setShowBackOnlineNotice(true);
			const timer = setTimeout(() => {
				setShowBackOnlineNotice(false);
			}, 4000);
			return () => clearTimeout(timer);
		};

		const handleOffline = () => {
			setIsOnline(false);
			setShowBackOnlineNotice(false);
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	return (
		<>
			{/* Offline Floating Banner */}
			{!isOnline && (
				<div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-amber-300 bg-amber-500/95 px-4 py-2 font-bold text-xs text-white shadow-xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
					<div className="flex items-center gap-1.5">
						<WifiOff className="h-4 w-4 animate-pulse" />
						<span>Offline Field Mode</span>
					</div>

					{mrId && (
						<button
							className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white hover:bg-white/30 transition"
							onClick={() => setIsViewerOpen(true)}
							type="button"
						>
							View Saved Reports
						</button>
					)}
				</div>
			)}

			{/* Back Online Toast */}
			{isOnline && showBackOnlineNotice && (
				<div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-600 px-4 py-2 font-bold text-xs text-white shadow-xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
					<Wifi className="h-4 w-4" />
					<span>Connection Restored &bull; Live ERP Synchronized</span>
				</div>
			)}

			{/* Viewer Modal */}
			{mrId && (
				<OfflineReportViewer
					isOpen={isViewerOpen}
					mrId={mrId}
					mrName={mrName}
					onClose={() => setIsViewerOpen(false)}
				/>
			)}
		</>
	);
}
