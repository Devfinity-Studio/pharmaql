"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function LogoutButton({ className }: { className?: string }) {
	const router = useRouter();

	return (
		<button
			className={
				className ||
				"rounded-full bg-white/10 px-8 py-3 font-semibold text-white no-underline transition hover:bg-white/20"
			}
			onClick={async () => {
				await signOut({
					fetchOptions: {
						onSuccess: () => {
							router.push("/login");
						},
					},
				});
			}}
		>
			Logout
		</button>
	);
}
