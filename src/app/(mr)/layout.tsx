import type { ReactNode } from "react";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function MRLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "MR") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col md:flex-row">
      <aside className="w-full md:w-72 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] border-r border-gray-100 flex flex-col p-6 z-10">
        <div className="mb-10">
          <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 tracking-tight">
            PharmaQL
          </div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
            MR Portal
          </div>
        </div>

        <nav className="flex flex-col space-y-3">
          <Link
            href="/dashboard"
            className="px-4 py-3 hover:bg-blue-50 hover:text-blue-700 rounded-xl text-gray-600 font-bold transition flex items-center gap-3"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Reports Overview
          </Link>
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-100">
          <div className="text-sm font-bold text-gray-900">
            {session.user.name}
          </div>
          <div className="text-xs text-gray-500">{session.user.email}</div>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-10 overflow-y-auto bg-gray-50/50">
        {children}
      </main>
    </div>
  );
}
