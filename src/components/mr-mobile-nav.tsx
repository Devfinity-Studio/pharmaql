"use client";

import {
	BarChart3,
	Boxes,
	Clock,
	FileText,
	HardDrive,
	LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useState } from "react";
import { OfflineReportViewer } from "@/components/offline-report-viewer";

interface MrMobileNavProps {
	mrId: string;
	mrName?: string;
	rank?: 1 | 2 | 3;
	canViewSales?: boolean;
	canViewProductWise?: boolean;
	canViewFreeScheme?: boolean;
	canViewStockAndSales?: boolean;
}

export function MrMobileNav({
	mrId,
	mrName,
	rank = 3,
	canViewSales = true,
	canViewProductWise = true,
	canViewFreeScheme = true,
	canViewStockAndSales = true,
}: MrMobileNavProps) {
	const searchParams = useSearchParams();
	const activeTab = searchParams.get("tab") || "stock";
	const [isOfflineViewerOpen, setIsOfflineViewerOpen] = useState(false);

	const navItems: { id: string; label: string; icon: any; href: string }[] = [
		{ id: "stock", label: "Stock", icon: Boxes, href: "/dashboard?tab=stock" },
	];

	if (canViewStockAndSales || rank <= 2) {
		navItems.push({
			id: "stock-and-sales",
			label: "S & S",
			icon: LayoutDashboard,
			href: "/dashboard?tab=stock-and-sales",
		});
	}

	if (canViewFreeScheme && rank >= 2) {
		navItems.push({
			id: "free-schemes",
			label: "Claim",
			icon: FileText,
			href: "/dashboard?tab=free-schemes",
		});
	}

	if (canViewSales && rank === 3) {
		navItems.push({
			id: "overview",
			label: "Sales",
			icon: BarChart3,
			href: "/dashboard?tab=overview",
		});
	}

	if (canViewProductWise && rank === 3) {
		navItems.push({
			id: "products",
			label: "Products",
			icon: FileText,
			href: "/dashboard?tab=products",
		});
	}

	navItems.push({
		id: "overdue",
		label: "Outstanding",
		icon: Clock,
		href: "/dashboard?tab=overdue",
	});

	return (
		<>
			<div className="fixed right-0 bottom-0 left-0 z-30 block border-gray-200 border-t bg-white/95 shadow-lg backdrop-blur-lg [padding-bottom:env(safe-area-inset-bottom,0px)] md:hidden">
				<div
					className="grid items-center justify-around px-2 py-1.5 text-center"
					style={{
						gridTemplateColumns: `repeat(${navItems.length + 1}, minmax(0, 1fr))`,
					}}
				>
					{navItems.map((item) => {
						const Icon = item.icon;
						const isActive = activeTab === item.id;
						return (
							<Link
								className={`flex flex-col items-center justify-center py-1 transition-all ${
									isActive
										? "font-extrabold text-[#0071BC]"
										: "font-medium text-gray-500 hover:text-gray-900"
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
						className="flex flex-col items-center justify-center py-1 text-gray-500 transition hover:text-amber-600"
						onClick={() => setIsOfflineViewerOpen(true)}
						type="button"
					>
						<div className="flex h-8 w-8 items-center justify-center rounded-xl text-amber-600 transition hover:bg-amber-50">
							<HardDrive className="h-4 w-4" />
						</div>
						<span className="font-bold text-[10px] text-amber-700 tracking-tight">
							Offline
						</span>
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
