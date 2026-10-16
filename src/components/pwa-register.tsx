"use client";

import { useEffect } from "react";

/**
 * Automatically registers the PharmaQL PWA Service Worker in production/browser environments.
 */
export function PwaRegister() {
	useEffect(() => {
		if (
			typeof window !== "undefined" &&
			"serviceWorker" in navigator &&
			window.location.protocol.startsWith("http")
		) {
			const registerWorker = () => {
				navigator.serviceWorker
					.register("/sw.js", { scope: "/" })
					.then((registration) => {
						// Listen for updates
						registration.addEventListener("updatefound", () => {
							const installingWorker = registration.installing;
							if (installingWorker) {
								installingWorker.addEventListener("statechange", () => {
									if (
										installingWorker.state === "installed" &&
										navigator.serviceWorker.controller
									) {
										console.log(
											"[PWA] New version of PharmaQL is available. Auto-updating on next visit.",
										);
									}
								});
							}
						});
					})
					.catch((error) => {
						console.warn("[PWA] Service Worker registration failed:", error);
					});
			};

			if (document.readyState === "complete") {
				registerWorker();
			} else {
				window.addEventListener("load", registerWorker);
				return () => window.removeEventListener("load", registerWorker);
			}
		}
	}, []);

	return null;
}
