"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await signOut();
        router.refresh();
      }}
      className="rounded-full bg-white/10 px-8 py-3 font-semibold text-white no-underline transition hover:bg-white/20"
    >
      Logout
    </button>
  );
}
