import {
  ArrowRight,
  Pill,
  Activity,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import { auth } from "@/server/auth";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#020817] selection:bg-cyan-500/30">
      <Header />

      <main className="relative flex-1 overflow-hidden">
        {/* BACKGROUND IMAGE with gradient overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-bg.jpg"
            alt="Asmee Pharma Background"
            fill
            className="object-cover opacity-[0.25] mix-blend-screen"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020817] via-[#020817]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#020817] via-transparent to-[#020817]" />
        </div>

        {/* HERO SECTION */}
        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl flex-col items-center justify-center px-6 pt-20 pb-32 text-center lg:pt-32 lg:pb-40">
          <div className="inline-flex animate-fade-in items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 font-medium text-cyan-400 text-sm backdrop-blur-md transition-colors hover:bg-cyan-500/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500"></span>
            </span>
            Welcome to Asmee Pharma
          </div>

          <h1 className="mt-8 max-w-4xl animate-fade-in-up font-extrabold text-5xl text-white leading-tight tracking-tight md:text-7xl">
            Next-Generation
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              Healthcare Logistics
            </span>
          </h1>

          <p
            className="mt-8 max-w-2xl animate-fade-in-up font-medium text-slate-300 text-lg leading-relaxed md:text-xl"
            style={{ animationDelay: "150ms", animationFillMode: "both" }}
          >
            Empowering medical representatives and distributors with real-time
            insights, effortless ordering, and intelligent inventory tracking
            for <strong className="text-white">Asmee Pharma</strong>.
          </p>

          <div
            className="mt-12 flex animate-fade-in-up flex-col gap-4 sm:flex-row"
            style={{ animationDelay: "300ms", animationFillMode: "both" }}
          >
            <Link
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-cyan-600 px-8 py-4 font-bold text-white transition-all hover:scale-105 hover:bg-cyan-500 hover:shadow-[0_0_40px_rgba(6,182,212,0.4)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#020817]"
              href="/products"
            >
              <span className="mr-2">Explore Products</span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>

            {session ? (
              <Link
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 px-8 py-4 font-bold text-white backdrop-blur-sm transition-all hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-[#020817]"
                href="/dashboard"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/50 px-8 py-4 font-bold text-white backdrop-blur-sm transition-all hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-[#020817]"
                href="/login"
              >
                Representative Login
              </Link>
            )}
          </div>

          {/* Features grid */}
          <div
            className="mt-24 grid grid-cols-1 gap-8 md:grid-cols-3 animate-fade-in-up"
            style={{ animationDelay: "450ms", animationFillMode: "both" }}
          >
            <div className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-transform hover:-translate-y-2 hover:border-cyan-500/30">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
                <Activity className="h-7 w-7 text-blue-400" />
              </div>
              <h3 className="mb-2 font-bold text-white text-xl">
                Real-time Insights
              </h3>
              <p className="text-sm text-slate-400">
                Instantly access stock, sales, and analytics with
                up-to-the-minute data.
              </p>
            </div>

            <div className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-transform hover:-translate-y-2 hover:border-cyan-500/30">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10">
                <Pill className="h-7 w-7 text-cyan-400" />
              </div>
              <h3 className="mb-2 font-bold text-white text-xl">
                Intelligent Inventory
              </h3>
              <p className="text-sm text-slate-400">
                Track claim quantities, free schemes, and batch data accurately.
              </p>
            </div>

            <div className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-transform hover:-translate-y-2 hover:border-cyan-500/30">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10">
                <ShieldCheck className="h-7 w-7 text-indigo-400" />
              </div>
              <h3 className="mb-2 font-bold text-white text-xl">
                Secure Access
              </h3>
              <p className="text-sm text-slate-400">
                Enterprise-grade security ensuring your data remains private and
                protected.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
