"use client";

import { usePathname, useRouter } from "next/navigation";
import { purgeAllOfflineData } from "@/lib/offline-store";
import { logoutUser } from "@/server/actions/authActions";

export function LogoutButton({ className }: { className?: string }) {
	const router = useRouter();
	const pathname = usePathname();

	return (
		<button
			className={
				className ||
				"rounded-full bg-red-600 px-6 py-2 font-bold text-white shadow-sm transition hover:bg-red-700"
			}
			onClick={async () => {
				await purgeAllOfflineData();
				await logoutUser();
				router.refresh();
				if (pathname !== "/") {
					router.push("/login");
				}
			}}
			type="button"
		>
			Logout
		</button>
	);
}
