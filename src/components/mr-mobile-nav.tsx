"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
	BarChart3,
	Boxes,
	Clock,
	FileText,
	HardDrive,
	LayoutDashboard,
} from "lucide-react";
import { OfflineReportViewer } from "@/components/offline-report-viewer";

interface MrMobileNavProps {
	mrId: string;
	mrName?: string;
}

export function MrMobileNav({ mrId, mrName }: MrMobileNavProps) {
	const searchParams = useSearchParams();
	const activeTab = searchParams.get("tab") || "stock";
	const [isOfflineViewerOpen, setIsOfflineViewerOpen] = useState(false);

	const navItems = [
		{ id: "stock", label: "Stock", icon: Boxes, href: "/dashboard?tab=stock" },
		{ id: "sales", label: "Sales", icon: BarChart3, href: "/dashboard?tab=sales" },
		{ id: "products", label: "Products", icon: FileText, href: "/dashboard?tab=products" },
		{ id: "overdue", label: "Outstanding", icon: Clock, href: "/dashboard?tab=overdue" },
	];

	return (
		<>
			<div className="fixed bottom-0 left-0 right-0 z-30 block md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-lg shadow-lg [padding-bottom:env(safe-area-inset-bottom,0px)]">
				<div className="grid grid-cols-5 items-center justify-around px-2 py-1.5 text-center">
					{navItems.map((item) => {
						const Icon = item.icon;
						const isActive = activeTab === item.id;
						return (
							<Link
								className={`flex flex-col items-center justify-center py-1 transition-all ${
									isActive
										? "text-[#0071BC] font-extrabold"
										: "text-gray-500 font-medium hover:text-gray-900"
								}`}
								href={item.href}
								key={item.id}
							>
								<div
									className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
										isActive ? "bg-blue-50 text-[#0071BC]" : "text-gray-500"
									}`}
								>
									<Icon className="h-4 w-4" />
								</div>
								<span className="text-[10px] tracking-tight">{item.label}</span>
							</Link>
						);
					})}

					{/* Offline Vault Action */}
					<button
						className="flex flex-col items-center justify-center py-1 text-gray-500 hover:text-amber-600 transition"
						onClick={() => setIsOfflineViewerOpen(true)}
						type="button"
					>
						<div className="flex h-8 w-8 items-center justify-center rounded-xl text-amber-600 hover:bg-amber-50 transition">
							<HardDrive className="h-4 w-4" />
						</div>
						<span className="text-[10px] font-bold text-amber-700 tracking-tight">Offline</span>
					</button>
				</div>
			</div>

			{/* Offline Viewer Drawer */}
			<OfflineReportViewer
				isOpen={isOfflineViewerOpen}
				mrId={mrId}
				mrName={mrName}
				onClose={() => setIsOfflineViewerOpen(false)}
			/>
		</>
	);
}
