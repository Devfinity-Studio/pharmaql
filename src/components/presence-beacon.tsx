"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { sendPresenceHeartbeatAction } from "@/server/actions/presenceActions";

const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
const SESSION_STORAGE_KEY = "pharmaql_presence_session_id";

export function PresenceBeacon() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();

	const sessionIdRef = useRef<string | null>(null);
	const isSendingRef = useRef(false);
	const lastSentUrlRef = useRef<string>("");

	useEffect(() => {
		// Restore session ID from sessionStorage if existing in tab
		if (typeof window !== "undefined") {
			sessionIdRef.current = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
		}
	}, []);

	useEffect(() => {
		let isMounted = true;

		async function sendHeartbeat() {
			if (isSendingRef.current) return;
			isSendingRef.current = true;

			try {
				const currentUrl =
					typeof window !== "undefined"
						? `${window.location.pathname}${window.location.search}`
						: pathname || "/";

				const title = typeof document !== "undefined" ? document.title : "";
				const screenRes =
					typeof window !== "undefined" && window.screen
						? `${window.screen.width}x${window.screen.height}`
						: undefined;

				const res = await sendPresenceHeartbeatAction({
					sessionId: sessionIdRef.current || undefined,
					currentPage: currentUrl,
					currentTitle: title,
					screenResolution: screenRes,
				});

				if (!isMounted) return;

				if (res.success && res.sessionId) {
					sessionIdRef.current = res.sessionId;
					if (typeof window !== "undefined") {
						window.sessionStorage.setItem(SESSION_STORAGE_KEY, res.sessionId);
					}
				}

				// If developer remotely revoked this session, instantly redirect
				if (res.isRevoked) {
					if (typeof window !== "undefined") {
						window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
						window.location.href = "/login?reason=session_revoked";
					} else {
						router.push("/login?reason=session_revoked");
					}
				}

				lastSentUrlRef.current = currentUrl;
			} catch (err) {
				// Non-blocking telemetry error - ignore silently
			} finally {
				isSendingRef.current = false;
			}
		}

		// Send on mount or route transition
		const activeUrl = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
		if (activeUrl !== lastSentUrlRef.current) {
			sendHeartbeat();
		}

		// Periodic heartbeat timer
		const timer = setInterval(() => {
			sendHeartbeat();
		}, HEARTBEAT_INTERVAL_MS);

		return () => {
			isMounted = false;
			clearInterval(timer);
		};
	}, [pathname, searchParams, router]);

	return null;
}
