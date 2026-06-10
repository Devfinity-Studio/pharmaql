import type { ReactNode } from "react";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-gray-900 text-white border-r border-gray-800 flex flex-col p-4">
        <div className="text-2xl font-bold text-white mb-8">PharmaQL Admin</div>
        <nav className="flex flex-col space-y-2">
          <Link href="/admin/dashboard" className="p-2 hover:bg-gray-800 rounded font-medium">Global Dashboard</Link>
          <Link href="/admin/mrs" className="p-2 hover:bg-gray-800 rounded font-medium">MR Access Management</Link>
          <Link href="/admin/ingest" className="p-2 hover:bg-gray-800 rounded font-medium">Data Ingestion (CSV)</Link>
        </nav>
        <div className="mt-auto pt-4 border-t border-gray-800 text-sm text-gray-400">
          Logged in as Admin ({session.user.name})
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
