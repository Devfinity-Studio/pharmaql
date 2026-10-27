"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import {
	BarChart3,
	Bell,
	Building2,
	ChevronLeft,
	ChevronRight,
	Database,
	LayoutDashboard,
	LogOut,
	Menu,
	Shield,
	Terminal,
	Users,
	X,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { NotificationCenter } from "@/components/notification-center";
import { useTenant } from "@/lib/tenant-context";

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
	const tenant = useTenant();
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [isMobileOpen, setIsMobileOpen] = useState(false);
	const pathname = usePathname();

	// Close mobile menu whenever user navigates
	useEffect(() => {
		setIsMobileOpen(false);
	}, [pathname]);

	// Restore collapsed preference from localStorage
	useEffect(() => {
		try {
			const saved = localStorage.getItem("pharmaql_sidebar_collapsed");
			if (saved !== null) {
				setIsCollapsed(saved === "true");
			}
		} catch {}
	}, []);

	const toggleCollapse = () => {
		setIsCollapsed((prev) => {
			const next = !prev;
			try {
				localStorage.setItem("pharmaql_sidebar_collapsed", String(next));
			} catch {}
			return next;
		});
	};

	const mrNavItems = [
		{
			label: "Reports Overview",
			href: "/dashboard",
			icon: BarChart3,
		},
	];

	const baseAdminNavItems = [
		{
			label: "Tenant Control",
			href: "/admin/tenants",
			icon: Database,
		},
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
			className={`relative z-50 flex flex-col transition-all duration-300 ease-in-out md:shrink-0 overflow-visible ${
				isDark
					? "border-gray-800 border-b md:border-b-0 md:border-r bg-gray-900 text-white"
					: "border-gray-200 border-b md:border-b-0 md:border-r bg-white text-[#0B2545]"
			} ${
				isCollapsed
					? "w-full md:w-20 p-3"
					: "w-full md:w-72 p-4 md:p-5"
			} h-auto md:h-screen`}
		>
			{/* Top Header & Collapse/Menu Toggles */}
			<div
				className={`flex items-center justify-between gap-2 ${
					isCollapsed ? "md:flex-col md:gap-3 md:mb-6" : "mb-0 md:mb-6"
				}`}
			>
				{/* Brand Logo & Name (Expanded Desktop + Mobile) */}
				{!isCollapsed ? (
					<div className="min-w-0 flex-1 truncate pr-1">
						<div className="flex items-center gap-1.5 font-black text-xl md:text-2xl tracking-tight truncate">
							<Link className="flex items-center gap-1.5 truncate" href="/">
								<span className={isDark ? "text-white" : "text-[#0B2545]"}>
									{tenant.displayName}
								</span>
							</Link>
						</div>
						<div className="mt-0.5 md:mt-1 flex items-center gap-1.5 font-bold text-gray-400 text-xs uppercase tracking-widest truncate">
							<span className="truncate">
								{portal === "mr"
									? "MR Portal"
									: userRole === "DEVELOPER"
										? "Developer Panel"
										: "Admin Panel"}
							</span>
							{userRole === "DEVELOPER" && (
								<span className="shrink-0 rounded border border-purple-500/40 bg-purple-500/20 px-1 py-0.2 font-mono text-[9px] text-purple-300">
									DEV
								</span>
							)}
						</div>
					</div>
				) : (
					/* When Collapsed on Desktop: show initial mark */
					<div className="hidden md:flex flex-col items-center justify-center w-full">
						<Link
							className="flex h-10 w-10 items-center justify-center rounded-xl font-black text-lg text-white"
							href="/"
							title={tenant.displayName}
						>
							<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0071BC] font-bold text-white shadow-sm hover:scale-105 transition-transform uppercase">
								{tenant.shortName.charAt(0) || "P"}
							</span>
						</Link>
					</div>
				)}

				{/* On mobile when isCollapsed was set on desktop: still show brand name on mobile */}
				{isCollapsed && (
					<div className="flex md:hidden items-center gap-1.5 font-black text-xl tracking-tight min-w-0 flex-1 truncate">
						<Link className="flex items-center gap-1.5 truncate" href="/">
							<span className={isDark ? "text-white" : "text-[#0B2545]"}>
								{tenant.displayName}
							</span>
						</Link>
					</div>
				)}

				{/* Right Side Header Controls */}
				<div
					className={`flex items-center gap-1.5 shrink-0 ${
						isCollapsed ? "md:flex-col md:gap-2.5 md:w-full md:items-center" : ""
					}`}
				>
					{/* Notification Center */}
					<NotificationCenter
						align="auto"
						buttonClassName={`relative flex h-8 w-8 md:h-8.5 md:w-8.5 items-center justify-center rounded-lg border transition shrink-0 ${
							isDark
								? "border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
								: "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-[#0B2545]"
						}`}
						isDark={isDark}
						userRole={userRole}
					/>

					{/* Desktop Collapse / Expand Toggle */}
					<button
						aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						className={`hidden h-8 w-8 md:h-8.5 md:w-8.5 items-center justify-center rounded-lg border transition shrink-0 md:flex ${
							isDark
								? "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
								: "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-[#0B2545]"
						}`}
						onClick={toggleCollapse}
						title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						type="button"
					>
						{isCollapsed ? (
							<ChevronRight className="h-4 w-4" />
						) : (
							<ChevronLeft className="h-4 w-4" />
						)}
					</button>

					{/* Mobile Menu Hamburger Toggle */}
					<button
						aria-label={isMobileOpen ? "Close menu" : "Open menu"}
						className={`flex h-8 w-8 md:h-8.5 md:w-8.5 items-center justify-center rounded-lg border transition shrink-0 md:hidden ${
							isDark
								? "border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
								: "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-[#0B2545]"
						}`}
						onClick={() => setIsMobileOpen(!isMobileOpen)}
						type="button"
					>
						{isMobileOpen ? (
							<X className="h-4 w-4" />
						) : (
							<Menu className="h-4 w-4" />
						)}
					</button>
				</div>
			</div>

			{/* Collapsible Content Body (Mobile Accordion / Desktop Sidebar Body) */}
			<div
				className={`${
					isMobileOpen ? "flex" : "hidden"
				} md:flex flex-col flex-1 min-h-0 mt-4 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 ${
					isDark ? "border-gray-800" : "border-gray-100"
				}`}
			>
				{/* Navigation Links */}
				<nav className="flex flex-col space-y-1.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-1 scrollbar-thin">
					{navItems.map((item) => {
						const Icon = item.icon;
						const isActive =
							pathname === item.href || pathname.startsWith(`${item.href}/`);

						return (
							<Link
								className={`group flex items-center gap-3 rounded-xl font-bold text-sm transition-all duration-150 ${
									isCollapsed
										? "md:justify-center px-3.5 md:px-2 py-2.5 md:py-3"
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
								onClick={() => setIsMobileOpen(false)}
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
								<span className={`${isCollapsed ? "md:hidden" : ""} truncate`}>
									{item.label}
								</span>
							</Link>
						);
					})}
				</nav>

				{/* Profile Info and Footer */}
				<div
					className={`mt-auto flex flex-col gap-3 border-t pt-4 shrink-0 ${
						isDark ? "border-gray-800" : "border-gray-200"
					}`}
				>
					{userName && (
						<div className={`${isCollapsed ? "md:hidden" : ""} truncate px-1`}>
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

					<div
						className={
							isCollapsed ? "md:flex md:justify-center w-full" : "w-full"
						}
					>
						{/* Desktop Collapsed Icon-Only Button */}
						{isCollapsed ? (
							<>
								<div className="hidden md:flex justify-center w-full">
									<LogoutButton
										className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all p-0"
										title="Logout"
									>
										<LogOut className="h-4 w-4" />
									</LogoutButton>
								</div>
								<div className="flex md:hidden w-full">
									<LogoutButton
										className={`flex w-full items-center justify-center gap-2 rounded-xl border font-bold px-4 py-2.5 text-center text-sm transition-all ${
											isDark
												? "bg-red-600/20 border-red-500/30 text-red-300 hover:bg-red-600 hover:text-white"
												: "border-2 border-red-200 bg-white text-red-600 hover:bg-red-50"
										}`}
									>
										<LogOut className="h-4 w-4 shrink-0" />
										<span>Logout</span>
									</LogoutButton>
								</div>
							</>
						) : (
							<LogoutButton
								className={`flex w-full items-center justify-center gap-2 rounded-xl border font-bold px-4 py-2.5 text-center text-sm transition-all ${
									isDark
										? "bg-red-600/20 border-red-500/30 text-red-300 hover:bg-red-600 hover:text-white"
										: "border-2 border-red-200 bg-white text-red-600 hover:bg-red-50"
								}`}
							>
								<LogOut className="h-4 w-4 shrink-0" />
								<span>Logout</span>
							</LogoutButton>
						)}
					</div>

					<div
						className={`${
							isCollapsed ? "md:hidden" : ""
						} mt-1 text-center text-[10px] text-gray-400`}
					>
						<p>© {new Date().getFullYear()} {tenant.displayName}</p>
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
				</div>
			</div>
		</aside>
	);
}
