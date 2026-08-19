import { headers } from "next/headers";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/server/auth";

export default async function Header() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="sticky top-0 z-50 w-full border-slate-200 border-b bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
        <div className="font-bold text-3xl">
          <Link href={"/"}>
            <span className="text-slate-900">Asmee</span>
            <span className="text-blue-600">Pharma</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {session ? (
            <>
              <Link
                className="font-medium text-slate-600 hover:text-black"
                href={
                  session.user.role === "ADMIN"
                    ? "/admin/dashboard"
                    : "/dashboard"
                }
              >
                Dashboard
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              className="rounded-xl border border-blue-200 px-5 py-2 text-blue-600 hover:bg-blue-50"
              href="/login"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
