import "@/styles/globals.css";

import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import { headers } from "next/headers";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/react";
import { PwaRegister } from "@/components/pwa-register";
import { TenantProvider, type TenantContextValue } from "@/lib/tenant-context";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
	themeColor: "#0071BC",
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
	viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
	const h = await headers();
	const isDev = h.get("x-is-dev-portal") === "true";
	const tenantLogo = h.get("x-tenant-logo") || "/devfinity.png";
	const tenantName = h.get("x-tenant-name") || (isDev ? "Devfinity Control Center" : "PharmaQL");

	return {
		title: isDev ? "Devfinity | PharmaQL Control Center" : `${tenantName} | PharmaQL`,
		description:
			"The Modern Medicine Portal empowering medical representatives and distributors with real-time insights, effortless ordering and intelligent inventory tracking.",
		authors: [{ name: "Devfinity" }],
		icons: {
			icon: [
				{ url: tenantLogo },
				{ url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
				{ url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
				{ url: "/favicons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
				{ url: "/favicons/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
			],
			apple: [
				{
					url: tenantLogo,
				},
				{
					url: "/favicons/apple-touch-icon.png",
					sizes: "180x180",
					type: "image/png",
				},
			],
			shortcut: [
				{ url: tenantLogo },
			],
		},
		appleWebApp: {
			capable: true,
			statusBarStyle: "default",
			title: tenantName,
		},
		manifest: "/manifest.webmanifest",
	};
}

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const h = await headers();
	const isDev = h.get("x-is-dev-portal") === "true";
	const tenantValue: Partial<TenantContextValue> = {
		id: h.get("x-tenant-id") || undefined,
		slug: h.get("x-tenant-slug") || (isDev ? "devfinity" : "asmee"),
		displayName: h.get("x-tenant-name") || (isDev ? "Devfinity Pvt. Ltd." : "Asmee Pharma Pvt. Ltd."),
		shortName: h.get("x-tenant-short-name") || (isDev ? "Devfinity" : "Asmee Pharma"),
		logoUrl: h.get("x-tenant-logo") || "/devfinity.png",
		primaryColor: h.get("x-tenant-primary-color") || (isDev ? "#0071BC" : "#0B2545"),
		accentColor: h.get("x-tenant-accent-color") || (isDev ? "#38BDF8" : "#134074"),
		address: h.get("x-tenant-address") || (isDev ? "Devfinity Cloud Platform" : "Plot No. 12, GIDC Industrial Estate, Ankleshwar, Gujarat - 393002"),
		phone: h.get("x-tenant-phone") || "+91 98765 43210",
		email: h.get("x-tenant-email") || (isDev ? "info@devfinity.net" : "info@asmeepharma.com"),
		supportEmail: h.get("x-tenant-support-email") || (isDev ? "info@devfinity.net" : "asmeepharma2022@gmail.com"),
		userEmailDomain: h.get("x-tenant-email-domain") || (isDev ? "@devfinity.net" : "@asmeepharma.com"),
		gstin: h.get("x-tenant-gstin") || "24AAAAA0000A1Z5",
		customDomain: h.get("x-tenant-domain") || (isDev ? "pharmaql.devfinity.net" : "portal.asmeepharma.com"),
		legacyDbName: h.get("x-tenant-legacy-db") || "pdyasvmaster",
		erpSoftwareType: h.get("x-tenant-erp-type") || "Technomax",
		compNo: Number(h.get("x-tenant-comp-no")) || 11,
		locNo: Number(h.get("x-tenant-loc-no")) || 11,
		overdueDirectBlockDays: Number(h.get("x-tenant-overdue-direct")) || 90,
		overdueDivisionBlockDays: Number(h.get("x-tenant-overdue-division")) || 95,
		isDevPortal: isDev,
	};

	const effectiveFavicon = tenantValue.logoUrl || "/devfinity.png";

	return (
		<html className={cn(geist.variable, "font-sans", inter.variable)} lang="en">
			<head>
				<title>{tenantValue.isDevPortal ? "Devfinity | PharmaQL Control Center" : `${tenantValue.displayName} | PharmaQL`}</title>
				<link rel="icon" href={effectiveFavicon} />
				<link rel="shortcut icon" href={effectiveFavicon} />
				<link rel="apple-touch-icon" href={effectiveFavicon} />
			</head>
			<body>
				<TenantProvider value={tenantValue}>
					<PwaRegister />
					<Analytics />
					<TRPCReactProvider>{children}</TRPCReactProvider>
				</TenantProvider>
			</body>
		</html>
	);
}
