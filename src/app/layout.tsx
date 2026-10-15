import "@/styles/globals.css";

import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/react";
import { PwaRegister } from "@/components/pwa-register";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
	themeColor: "#0071BC",
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
	viewportFit: "cover",
};

export const metadata: Metadata = {
	title: "Asmee Pharma Pvt. Ltd. | PharmaQL",
	description:
		"The Modern Medicine Portal empowering medical representatives and distributors with real-time insights, effortless ordering and intelligent inventory tracking.",
	authors: [{ name: "Devfinity" }],
	icons: {
		icon: [
			{ url: "/favicons/favicon.ico" },
			{ url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
			{ url: "/favicons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
			{ url: "/favicons/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
		],
		apple: [
			{
				url: "/favicons/apple-touch-icon.png",
				sizes: "180x180",
				type: "image/png",
			},
		],
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "PharmaQL",
	},
	manifest: "/manifest.webmanifest",
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html className={cn(geist.variable, "font-sans", inter.variable)} lang="en">
			<body>
				<PwaRegister />
				<Analytics />
				<TRPCReactProvider>{children}</TRPCReactProvider>
			</body>
		</html>
	);
}
