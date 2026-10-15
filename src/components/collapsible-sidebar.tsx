"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import {
	BarChart3,
	Bell,
	Building2,
	ChevronLeft,
	ChevronRight,
	FileSpreadsheet,
	LayoutDashboard,
	LogOut,
	Shield,
	Terminal,
	Users,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { NotificationCenter } from "@/components/notification-center";

interface CollapsibleSidebarProps {
	portal: "mr" | "admin";
	userName?: string;
	userEmail?: string;
	userRole?: string;
}

export function CollapsibleSidebar({
	portal,
	userName,
	userEmail,
	userRole,
}: CollapsibleSidebarProps) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const pathname = usePathname();

	const mrNavItems = [
		{
			label: "Reports Overview",
			href: "/dashboard",
			icon: BarChart3,
		},
	];

	const baseAdminNavItems = [
		{
			label: "Global Dashboard",
			href: "/admin/dashboard",
			icon: LayoutDashboard,
		},
		{
			label: "MR Access",
			href: "/admin/mrs",
			icon: Users,
		},
		{
			label: "Company Display",
			href: "/admin/companies",
			icon: Building2,
		},
		{
			label: "Notice Board",
			href: "/admin/notices",
			icon: Bell,
		},
	];

	const adminNavItems = [
		...baseAdminNavItems,
		...(userRole === "DEVELOPER"
			? [
					{
						label: "Security & Audit",
						href: "/admin/audit",
						icon: Shield,
					},
					{
						label: "Developer Options",
						href: "/admin/dev",
						icon: Terminal,
					},
				]
			: []),
	];

	const navItems = portal === "mr" ? mrNavItems : adminNavItems;
	const isDark = portal === "admin";

	return (
		<aside
			className={`relative z-10 flex flex-col transition-all duration-300 ease-in-out ${
				isDark
					? "border-gray-800 border-r bg-gray-900 text-white"
					: "border-gray-200 border-r bg-white text-[#0B2545]"
			} ${
				isCollapsed
					? "w-full md:w-20 p-3"
					: portal === "mr"
						? "w-full md:w-72 p-6"
						: "w-full md:w-64 p-5"
			} h-auto md:h-screen`}
		>
			{/* Top Header & Collapse Toggle */}
			<div className="mb-6 flex items-center justify-between">
				{!isCollapsed && (
					<div>
						<div className="flex items-center gap-1.5 font-black text-xl md:text-2xl tracking-tight">
							<Link className="flex gap-1.5" href="/">
								<span className={isDark ? "text-white" : "text-[#0B2545]"}>
									Asmee
								</span>
								<span className="text-[#0071BC]">Pharma</span>
							</Link>
						</div>
						<div className="mt-1 flex items-center gap-1.5 font-bold text-gray-400 text-xs uppercase tracking-widest">
							<span>
								{portal === "mr"
									? "MR Portal"
									: userRole === "DEVELOPER"
										? "Developer Panel"
										: "Admin Panel"}
							</span>
							{userRole === "DEVELOPER" && (
								<span className="rounded border border-purple-500/40 bg-purple-500/20 px-1 py-0.2 font-mono text-[9px] text-purple-300">
									DEV
								</span>
							)}
						</div>
					</div>
				)}

				{isCollapsed && (
					<Link
						className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl font-black text-lg text-white"
						href="/"
						title="Asmee Pharma"
					>
						<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0071BC] font-bold text-white shadow-sm">
							A
						</span>
					</Link>
				)}

				<div className={`flex items-center gap-1.5 ${isCollapsed ? "flex-col mt-2" : ""}`}>
					<NotificationCenter isDark={isDark} userRole={userRole} />
					<button
						aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						className={`hidden h-8 w-8 items-center justify-center rounded-lg border transition md:flex ${
							isDark
								? "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
								: "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-[#0B2545]"
						} ${isCollapsed ? "mx-auto" : ""}`}
						onClick={() => setIsCollapsed(!isCollapsed)}
						title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						type="button"
					>
						{isCollapsed ? (
							<ChevronRight className="h-4 w-4" />
						) : (
							<ChevronLeft className="h-4 w-4" />
						)}
					</button>
				</div>
			</div>

			{/* Navigation Links */}
			<nav className="flex flex-col space-y-1.5">
				{navItems.map((item) => {
					const Icon = item.icon;
					const isActive =
						pathname === item.href || pathname.startsWith(`${item.href}/`);

					return (
						<Link
							className={`group flex items-center gap-3 rounded-xl font-bold text-sm transition-all duration-150 ${
								isCollapsed
									? "justify-center px-2 py-3"
									: "px-3.5 py-2.5"
							} ${
								isActive
									? isDark
										? "bg-gray-800 text-[#38BDF8] shadow-xs"
										: "border-[#0071BC] border-l-4 bg-[#F1F5F9] text-[#0071BC]"
									: isDark
										? "text-gray-300 hover:bg-gray-800 hover:text-white"
										: "text-gray-600 hover:bg-gray-100/80 hover:text-[#0B2545]"
							}`}
							href={item.href}
							key={item.href}
							title={isCollapsed ? item.label : undefined}
						>
							<Icon
								className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
									isActive
										? isDark
											? "text-[#38BDF8]"
											: "text-[#0071BC]"
										: "text-gray-400 group-hover:text-current"
								}`}
							/>
							{!isCollapsed && <span className="truncate">{item.label}</span>}
						</Link>
					);
				})}
			</nav>

			{/* Profile Info and Footer */}
			<div
				className={`mt-auto flex flex-col gap-3 border-t pt-4 ${
					isDark ? "border-gray-800" : "border-gray-200"
				}`}
			>
				{!isCollapsed && userName && (
					<div className="truncate">
						<div
							className={`font-bold text-sm truncate ${
								isDark ? "text-white" : "text-[#0B2545]"
							}`}
						>
							{userName}
						</div>
						{userEmail && (
							<div className="font-semibold text-gray-400 text-xs truncate">
								{userEmail}
							</div>
						)}
					</div>
				)}

				<div className={isCollapsed ? "flex justify-center" : "w-full"}>
					<LogoutButton
						className={`rounded-xl border font-bold transition-colors ${
							isCollapsed
								? "flex h-10 w-10 items-center justify-center p-0 border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
								: isDark
									? "w-full bg-red-600 px-4 py-2 text-center text-sm text-white hover:bg-red-700 border-red-700"
									: "w-full border-red-200 bg-white px-4 py-2 text-center text-sm text-red-600 hover:bg-red-50"
						}`}
					/>
				</div>

				{!isCollapsed && (
					<div className="mt-1 text-center text-[10px] text-gray-400">
						<p>© {new Date().getFullYear()} Asmee Pharma Pvt. Ltd.</p>
						<p className="mt-0.5 flex items-center justify-center gap-1">
							Made with <span className="text-red-500">❤️</span> by{" "}
							<a
								className={`font-bold hover:underline ${
									isDark ? "text-blue-400" : "text-[#0071BC]"
								}`}
								href="https://devfinity.net"
								rel="noopener noreferrer"
								target="_blank"
							>
								Devfinity
							</a>
						</p>
					</div>
				)}
			</div>
		</aside>
	);
}
