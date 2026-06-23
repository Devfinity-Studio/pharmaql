import Link from "next/link";
import { headers } from "next/headers";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/server/auth";

export default async function Header() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
      <div className="text-3xl font-bold">
        <Link href={"/"}>
          <span className="text-slate-900">Pharma</span>

          <span className="text-blue-600">QL</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {session ? (
          <>
            <Link
              href={
                session.user.role === "ADMIN"
                  ? "/admin/dashboard"
                  : "/dashboard"
              }
              className="font-medium text-slate-600 hover:text-black"
            >
              Dashboard
            </Link>

            <LogoutButton />
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-xl border border-blue-200 px-5 py-2 text-blue-600 hover:bg-blue-50"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
