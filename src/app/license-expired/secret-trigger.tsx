"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

export function DeveloperSecretTrigger() {
	const router = useRouter();
	const clickCountRef = useRef(0);
	const lastClickTimeRef = useRef(0);
	const [hintVisible, setHintVisible] = useState(false);

	const triggerDeveloperLogin = () => {
		// Use window.location.href to perform a clean, un-cached hard navigation
		if (typeof window !== "undefined") {
			window.location.href = "/login?mode=admin&dev=1";
		} else {
			router.push("/login?mode=admin&dev=1");
		}
	};

	useEffect(() => {
		// 1. Direct query param trigger: /license-expired?dev=1
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			if (params.has("dev") || params.get("access") === "dev") {
				triggerDeveloperLogin();
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
				triggerDeveloperLogin();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	const handleSecretDevClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		// Alt-click or Shift-click immediately triggers developer bypass
		if (e.altKey || e.shiftKey) {
			triggerDeveloperLogin();
			return;
		}

		const now = Date.now();
		// Reset count if delay exceeds 1500ms
		if (now - lastClickTimeRef.current < 1500) {
			clickCountRef.current += 1;
		} else {
			clickCountRef.current = 1;
		}
		lastClickTimeRef.current = now;

		if (clickCountRef.current >= 3) {
			clickCountRef.current = 0;
			triggerDeveloperLogin();
		} else if (clickCountRef.current === 2) {
			setHintVisible(true);
			setTimeout(() => setHintVisible(false), 2000);
		}
	};

	return (
		<div className="mt-8 border-t border-gray-800/80 pt-4 text-center font-mono text-[11px] text-gray-500 select-none">
			PharmaQL Platform &bull; Developed by{" "}
			<button
				aria-label="Developer Login Gateway"
				className="inline-block cursor-pointer px-1 text-gray-400 hover:text-gray-200 transition-colors select-none focus:outline-none"
				onClick={handleSecretDevClick}
				type="button"
			>
				Devfinity
			</button>
			{hintVisible && (
				<div className="mt-2 text-[10px] text-amber-400/80 animate-pulse">
					Click 1 more time for Developer Login
				</div>
			)}
		</div>
	);
}
