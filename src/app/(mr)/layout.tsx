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

  if ((session.user as any).isBlocked) {
    // If they get blocked mid-session, force logout essentially by redirecting
    // or just show a blocked screen right here
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center space-y-4">
          <div className="text-red-500 mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-600 font-medium">you have been blocked please contact the admin to get unblocked</p>
          <div className="pt-4">
             <Link href="/login" className="text-blue-600 font-bold hover:underline">Return to Login</Link>
          </div>
        </div>
      </div>
    );
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
