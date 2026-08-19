import { headers } from "next/headers";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/server/auth";

export default async function Header() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#020817]/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
        <div className="font-extrabold text-3xl tracking-tight transition-transform hover:scale-[1.02]">
          <Link href={"/"}>
            <span className="text-white">Asmee</span>
            <span className="text-cyan-400">Pharma</span>
          </Link>
        </div>

        <div className="flex items-center gap-6">
          {session ? (
            <>
              <Link
                className="font-semibold text-slate-300 transition-colors hover:text-white"
                href={
                  session.user.role === "ADMIN"
                    ? "/admin/dashboard"
                    : "/dashboard"
                }
              >
                Dashboard
              </Link>
              <LogoutButton className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-6 py-2.5 font-bold text-cyan-400 backdrop-blur-sm transition-all hover:bg-cyan-500/20 hover:text-cyan-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]" />
            </>
          ) : (
            <Link
              className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-6 py-2.5 font-bold text-cyan-400 backdrop-blur-sm transition-all hover:bg-cyan-500/20 hover:text-cyan-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
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
