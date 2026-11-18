"use client";

import { usePathname, useRouter } from "next/navigation";
import { purgeAllOfflineData } from "@/lib/offline-store";
import { logoutUser } from "@/server/actions/authActions";

interface LogoutButtonProps {
	className?: string;
	children?: React.ReactNode;
	title?: string;
}

export function LogoutButton({ className, children, title }: LogoutButtonProps) {
	const router = useRouter();
	const pathname = usePathname();

	return (
		<button
			className={
				className ||
				"rounded-full bg-red-600 px-6 py-2 font-bold text-white shadow-sm transition hover:bg-red-700"
			}
			title={title}
			onClick={async () => {
				// 1. Purge all offline IndexedDB snapshots & cached credentials
				await purgeAllOfflineData();

				// 2. Unregister push subscription from device and server to guarantee multi-MR isolation
				try {
					const { logoutPushCleanupAction } = await import("@/server/actions/pushActions");
					if (typeof window !== "undefined" && "serviceWorker" in navigator) {
						const reg = await navigator.serviceWorker.ready;
						const sub = await reg.pushManager.getSubscription();
						if (sub) {
							await sub.unsubscribe();
						}
					}
					await logoutPushCleanupAction();
				} catch (err) {
					console.warn("[Push] Logout push cleanup partial error:", err);
				}

				// 3. Clear server auth session
				await logoutUser();
				router.refresh();
				if (pathname !== "/") {
					router.push("/login");
				}
			}}
			type="button"
		>
			{children || "Logout"}
		</button>
	);
}
