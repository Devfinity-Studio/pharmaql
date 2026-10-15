"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserCheck } from "lucide-react";
import { stopMrImpersonation } from "@/server/actions/impersonation";

interface ImpersonationBannerProps {
	mrName: string;
	mrId: string;
	rank?: number;
}

export function ImpersonationBanner({
	mrName,
	mrId,
	rank = 3,
}: ImpersonationBannerProps) {
	const [isPending, startTransition] = useTransition();
	const router = useRouter();

	const handleExit = () => {
		startTransition(async () => {
			await stopMrImpersonation();
			router.push("/admin/dev");
			router.refresh();
		});
	};

	return (
		<div className="sticky top-0 z-50 flex items-center justify-between border-b border-purple-500/30 bg-gradient-to-r from-purple-950/95 via-gray-950/95 to-purple-950/95 px-4 py-2.5 text-white shadow-lg backdrop-blur-md">
			<div className="flex items-center gap-2.5 font-medium text-xs sm:text-sm">
				<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
					<UserCheck className="h-4 w-4" />
				</div>
				<div>
					<span className="font-bold text-purple-300">Developer Simulation Active:</span>{" "}
					<span>
						Viewing as <strong>{mrName}</strong> ({mrId}) &bull; Rank {rank}
					</span>
				</div>
			</div>

			<button
				className="flex items-center gap-1.5 rounded-lg border border-purple-400/30 bg-purple-600/30 px-3 py-1 font-bold text-xs text-purple-200 transition-all hover:bg-purple-600 hover:text-white"
				disabled={isPending}
				onClick={handleExit}
				type="button"
			>
				<LogOut className="h-3.5 w-3.5" />
				<span>{isPending ? "Exiting..." : "Exit Simulation"}</span>
			</button>
		</div>
	);
}
