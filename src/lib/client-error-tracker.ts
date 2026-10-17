"use client";

const MAX_RING_BUFFER_SIZE = 5;
const recentErrors: string[] = [];
let isListening = false;

/**
 * Initialize client-side error listeners to capture unexpected console errors or unhandled rejections.
 * Safe for SSR (no-op on server).
 */
export function initClientErrorTracker() {
	if (typeof window === "undefined" || isListening) return;
	isListening = true;

	window.addEventListener("error", (event) => {
		try {
			const msg = event.message || "Unknown client script error";
			const source = event.filename
				? ` at ${event.filename.split("/").pop()}:${event.lineno}`
				: "";
			addClientError(`[Error] ${msg}${source}`);
		} catch {
			// Ignore tracking errors
		}
	});

	window.addEventListener("unhandledrejection", (event) => {
		try {
			const reason =
				event.reason instanceof Error
					? event.reason.message
					: String(event.reason || "Unhandled Promise Rejection");
			addClientError(`[Unhandled Rejection] ${reason}`);
		} catch {
			// Ignore tracking errors
		}
	});
}

/**
 * Add an error message to the ring buffer.
 */
export function addClientError(errorMsg: string) {
	if (!errorMsg) return;
	const timestamp = new Date().toLocaleTimeString();
	recentErrors.unshift(`[${timestamp}] ${errorMsg}`);
	if (recentErrors.length > MAX_RING_BUFFER_SIZE) {
		recentErrors.pop();
	}
}

/**
 * Get a copy of the recent client errors.
 */
export function getRecentClientErrors(): string[] {
	return [...recentErrors];
}
