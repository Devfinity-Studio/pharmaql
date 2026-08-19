"use client";

import { useRouter, usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-client";

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
        await signOut({
          fetchOptions: {
            onSuccess: () => {
              router.refresh();
              if (pathname !== "/") {
                router.push("/login");
              }
            },
          },
        });
      }}
    >
      Logout
    </button>
  );
}
