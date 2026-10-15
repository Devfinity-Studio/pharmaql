"use client";

import React, { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";

export function PwaInstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
	const [isInstallable, setIsInstallable] = useState(false);
	const [isIos, setIsIos] = useState(false);
	const [isDismissed, setIsDismissed] = useState(true);

	useEffect(() => {
		if (typeof window === "undefined") return;

		// 1. Check if already running as standalone PWA
		const isStandalone =
			window.matchMedia("(display-mode: standalone)").matches ||
			(window.navigator as any).standalone === true;

		if (isStandalone) {
			return;
		}

		// 2. Check 7-day snooze dismissal in localStorage
		const dismissedAt = localStorage.getItem("pharmaql_pwa_install_dismissed");
		if (dismissedAt) {
			const ageDays = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
			if (ageDays < 7) {
				return;
			}
		}

		// 3. Detect iOS Safari
		const userAgent = window.navigator.userAgent.toLowerCase();
		const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
		const isSafari =
			userAgent.includes("safari") &&
			!userAgent.includes("crios") &&
			!userAgent.includes("chrome");

		if (isIosDevice && isSafari) {
			setIsIos(true);
			setIsDismissed(false);
			return;
		}

		// 4. Capture beforeinstallprompt for Android / Chrome / Edge
		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e);
			setIsInstallable(true);
			setIsDismissed(false);
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

		return () => {
			window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		};
	}, []);

	const handleInstallClick = async () => {
		if (!deferredPrompt) return;

		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;

		if (outcome === "accepted") {
			setIsInstallable(false);
			setIsDismissed(true);
		}
		setDeferredPrompt(null);
	};

	const handleDismiss = () => {
		setIsDismissed(true);
		localStorage.setItem("pharmaql_pwa_install_dismissed", Date.now().toString());
	};

	if (isDismissed || (!isInstallable && !isIos)) {
		return null;
	}

	return (
		<div className="fixed bottom-20 left-4 right-4 z-40 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 rounded-2xl border border-blue-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-6 duration-300">
			<div className="flex items-start gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0071BC] text-white shadow-md">
					<Smartphone className="h-6 w-6" />
				</div>

				<div className="flex-1">
					<div className="flex items-center justify-between">
						<h4 className="font-extrabold text-sm text-[#0B2545]">Install PharmaQL App</h4>
						<button
							className="rounded-lg p-1 text-gray-400 hover:text-gray-600"
							onClick={handleDismiss}
							type="button"
						>
							<X className="h-4 w-4" />
						</button>
					</div>

					<p className="mt-1 text-xs text-gray-600 leading-relaxed">
						Install the app on your phone for lightning-fast reports and offline access in the field.
					</p>

					{isIos ? (
						<div className="mt-3 flex items-center gap-1.5 rounded-lg bg-blue-50 p-2 text-[11px] text-blue-900 font-medium">
							<Share className="h-4 w-4 text-[#0071BC] shrink-0" />
							<span>
								Tap <strong>Share</strong> in Safari, then select <strong>Add to Home Screen</strong>.
							</span>
						</div>
					) : (
						<div className="mt-3 flex items-center gap-2">
							<button
								className="flex items-center gap-1.5 rounded-xl bg-[#0071BC] px-4 py-2 font-bold text-xs text-white shadow-sm transition hover:bg-[#005a96]"
								onClick={handleInstallClick}
								type="button"
							>
								<Download className="h-3.5 w-3.5" />
								Install App
							</button>

							<button
								className="rounded-xl px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
								onClick={handleDismiss}
								type="button"
							>
								Later
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
