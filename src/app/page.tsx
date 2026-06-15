import Link from "next/link";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { LogoutButton } from "@/components/logout-button";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white relative overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-50 animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-50 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation Bar */}
      <nav className="w-full max-w-7xl px-6 py-6 flex items-center justify-between z-10">
        <div className="text-2xl font-black tracking-tight flex items-center gap-2">
          <span className="text-white">Pharma</span>
          <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            QL
          </span>
        </div>
        <div className="flex gap-4 items-center">
          {session ? (
            <>
              <Link
                href={
                  session.user.role === "ADMIN"
                    ? "/admin/dashboard"
                    : "/dashboard"
                }
                className="font-semibold hover:text-cyan-400 transition"
              >
                Dashboard
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-white/10 px-8 py-2.5 font-semibold transition hover:bg-white/20 border border-white/10 backdrop-blur-md"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 z-10 w-full max-w-5xl mx-auto pb-20">
        <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-8 leading-tight">
          The Modern <br />
          <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Medicine Portal
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mb-12 font-medium">
          Empowering medical representatives and distributors with real-time
          insights, effortless ordering, and intelligent inventory tracking.
        </p>

        <div className="flex flex-col sm:flex-row gap-6">
          <Link
            href="/products"
            className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-10 py-4 font-bold text-lg shadow-lg hover:shadow-cyan-500/25 transition transform hover:-translate-y-1"
          >
            Browse Directory
          </Link>
          {!session && (
            <Link
              href="/login"
              className="rounded-full bg-white/10 px-10 py-4 font-bold text-lg backdrop-blur-md border border-white/20 hover:bg-white/20 transition"
            >
              Partner Login
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
