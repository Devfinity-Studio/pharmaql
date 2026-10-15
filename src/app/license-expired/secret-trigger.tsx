"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useRef } from "react";

export function DeveloperSecretTrigger() {
	const router = useRouter();
	const clickCountRef = useRef(0);
	const lastClickTimeRef = useRef(0);

	useEffect(() => {
		// 1. Direct query param trigger: /license-expired?dev=1
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			if (params.has("dev") || params.get("access") === "dev") {
				router.push("/login");
				return;
			}
		}

		// 2. Keyboard shortcut: Ctrl + Shift + D or Alt + D
		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") ||
				(e.altKey && e.key.toLowerCase() === "d")
			) {
				e.preventDefault();
				router.push("/login");
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [router]);

	const handleSecretDevClick = (e: React.MouseEvent) => {
		// Alt-click or triple-click on Devfinity quietly navigates to login
		if (e.altKey) {
			router.push("/login");
			return;
		}

		const now = Date.now();
		if (now - lastClickTimeRef.current < 800) {
			clickCountRef.current += 1;
		} else {
			clickCountRef.current = 1;
		}
		lastClickTimeRef.current = now;

		if (clickCountRef.current >= 3) {
			router.push("/login");
		}
	};

	return (
		<div className="mt-8 border-t border-gray-800/80 pt-4 text-center font-mono text-[11px] text-gray-500 select-none">
			PharmaQL Platform &bull; Developed by{" "}
			<span
				className="cursor-default text-gray-400 hover:text-gray-300 transition-colors"
				onClick={handleSecretDevClick}
			>
				Devfinity
			</span>
		</div>
	);
}
