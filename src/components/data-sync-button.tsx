"use client";

import React, { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { refreshAllCaches } from "@/server/actions/refreshCache";

export function DataSyncButton({ className = "" }: { className?: string }) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [isSuccess, setIsSuccess] = useState(false);

	const handleSync = () => {
		startTransition(async () => {
			await refreshAllCaches();
			router.refresh();
			setIsSuccess(true);
			setTimeout(() => setIsSuccess(false), 2000);
		});
	};

	return (
		<button
			type="button"
			onClick={handleSync}
			disabled={isPending}
			title="Force refresh statement data directly from ERP database"
			className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-bold text-xs text-gray-700 shadow-xs hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-60 cursor-pointer ${className}`}
		>
			<RefreshCw
				className={`h-3.5 w-3.5 text-[#0071BC] ${
					isPending ? "animate-spin" : ""
				}`}
			/>
			<span>
				{isPending ? "Syncing..." : isSuccess ? "Synced!" : "Sync ERP"}
			</span>
		</button>
	);
}
