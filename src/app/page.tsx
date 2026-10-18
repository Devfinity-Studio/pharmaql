import {
	Activity,
	ArrowRight,
	Pill,
	ShieldCheck,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import Header from "@/components/Header";
import { auth } from "@/server/auth";

export default async function Home() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	return (
		<div className="flex min-h-screen flex-col bg-[#050811] text-white selection:bg-cyan-500/30">
			<Header />

			<main className="relative flex-1 overflow-hidden">
				{/* BACKGROUND: HYBRID LIGHT/DARK GLOW + CONSTELLATION NODES + DIAGONAL BEAMS */}
				<div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
					{/* 1. Deep Dark Base Gradient */}
					<div className="absolute inset-0 bg-gradient-to-b from-[#080d1a] via-[#050811] to-[#020408]" />

					{/* 2. Hybrid Ambient Light Glows (Center Top & Right Side) */}
					<div className="absolute top-[-5%] left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-cyan-500/15 blur-[140px]" />
					<div className="absolute top-[20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-blue-600/15 blur-[160px]" />
					<div className="absolute bottom-[-10%] left-[-5%] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[150px]" />

					{/* 3. Subtle Background Micro-Grid */}
					<div
						className="absolute inset-0 opacity-[0.04]"
						style={{
							backgroundImage: `linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)`,
							backgroundSize: "50px 50px",
						}}
					/>

					{/* 4. Diagonal Light Rays (45-degree angled beams) */}
					<div className="absolute bottom-[-10%] right-[-5%] h-[800px] w-[800px]">
						<div className="absolute h-full w-[1px] bg-gradient-to-t from-transparent via-cyan-400/25 to-transparent rotate-[45deg] translate-x-[120px]" />
						<div className="absolute h-full w-[1px] bg-gradient-to-t from-transparent via-blue-400/30 to-transparent rotate-[45deg] translate-x-[280px]" />
						<div className="absolute h-full w-[1px] bg-gradient-to-t from-transparent via-cyan-500/20 to-transparent rotate-[45deg] translate-x-[440px]" />
					</div>

					{/* 5. Glowing Molecular Particles / Constellation Nodes */}
					<div className="absolute top-[18%] left-[12%] h-2 w-2 rounded-full bg-cyan-400 opacity-70 shadow-[0_0_10px_#22d3ee]" />
					<div className="absolute top-[28%] left-[25%] h-3 w-3 rounded-full bg-blue-400/50 opacity-60 shadow-[0_0_12px_#60a5fa]" />
					<div className="absolute top-[15%] right-[20%] h-2.5 w-2.5 rounded-full bg-cyan-300 opacity-70 shadow-[0_0_10px_#67e8f9]" />
					<div className="absolute top-[45%] left-[8%] h-3.5 w-3.5 rounded-full bg-blue-500/40 opacity-50 shadow-[0_0_15px_#3b82f6]" />
					<div className="absolute top-[52%] right-[14%] h-4 w-4 rounded-full bg-cyan-400/50 opacity-60 shadow-[0_0_15px_#22d3ee]" />
					<div className="absolute top-[75%] left-[20%] h-2 w-2 rounded-full bg-indigo-400 opacity-60 shadow-[0_0_10px_#818cf8]" />
					<div className="absolute top-[80%] right-[30%] h-2.5 w-2.5 rounded-full bg-cyan-400/60 opacity-70 shadow-[0_0_10px_#22d3ee]" />
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

					<h1 className="mt-8 max-w-4xl animate-fade-in-up font-extrabold text-5xl text-white leading-[1.15] tracking-tight md:text-7xl md:leading-[1.12]">
						Next-Generation
						<br />
						<span className="inline-block bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-400 bg-clip-text pb-1 text-transparent">
                      Healthcare Logistics
                   </span>
					</h1>

					<p
						className="mt-8 max-w-2xl animate-fade-in-up font-medium text-lg text-slate-300 leading-relaxed md:text-xl"
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
							className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 font-bold text-white shadow-[0_0_30px_rgba(6,182,212,0.35)] transition-all hover:scale-105 hover:shadow-[0_0_45px_rgba(6,182,212,0.55)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#050811]"
							href="/products"
						>
							<span className="mr-2">Explore Products</span>
							<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
						</Link>

						{session ? (
							<Link
								className="inline-flex items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/40 px-8 py-4 font-bold text-white backdrop-blur-md transition-all hover:bg-slate-700/60 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-[#050811]"
								href="/dashboard"
							>
								Go to Dashboard
							</Link>
						) : (
							<Link
								className="inline-flex items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/40 px-8 py-4 font-bold text-white backdrop-blur-md transition-all hover:bg-slate-700/60 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-[#050811]"
								href="/login"
							>
								Representative Login
							</Link>
						)}
					</div>

					{/* Features grid */}
					<div
						className="mt-24 grid animate-fade-in-up grid-cols-1 gap-8 md:grid-cols-3"
						style={{ animationDelay: "450ms", animationFillMode: "both" }}
					>
						<div className="flex flex-col items-center rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-md transition-all hover:-translate-y-2 hover:border-cyan-500/40 hover:shadow-xl">
							<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
								<Activity className="h-7 w-7 text-blue-400" />
							</div>
							<h3 className="mb-2 font-bold text-white text-xl">
								Real-time Insights
							</h3>
							<p className="text-slate-400 text-sm">
								Instantly access stock, sales, and analytics with
								up-to-the-minute data.
							</p>
						</div>

						<div className="flex flex-col items-center rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-md transition-all hover:-translate-y-2 hover:border-cyan-500/40 hover:shadow-xl">
							<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10">
								<Pill className="h-7 w-7 text-cyan-400" />
							</div>
							<h3 className="mb-2 font-bold text-white text-xl">
								Intelligent Inventory
							</h3>
							<p className="text-slate-400 text-sm">
								Track claim quantities, free schemes, and batch data accurately.
							</p>
						</div>

						<div className="flex flex-col items-center rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-md transition-all hover:-translate-y-2 hover:border-cyan-500/40 hover:shadow-xl">
							<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10">
								<ShieldCheck className="h-7 w-7 text-indigo-400" />
							</div>
							<h3 className="mb-2 font-bold text-white text-xl">
								Secure Access
							</h3>
							<p className="text-slate-400 text-sm">
								Enterprise-grade security ensuring your data remains private and
								protected.
							</p>
						</div>
					</div>
				</section>

				{/* LIGHT FOOTER */}
				<footer
					className="relative z-10 w-full animate-fade-in-up border-slate-200 border-t bg-white/90 py-6 text-center backdrop-blur-md"
					style={{ animationDelay: "600ms", animationFillMode: "both" }}
				>
					<p className="text-slate-600 text-sm font-medium">
						&copy; {new Date().getFullYear()} Asmee Pharma. All rights reserved.
					</p>
					<p className="mt-2 flex items-center justify-center gap-1 text-slate-500 text-xs">
						Made with{" "}
						<span className="animate-pulse text-red-500 text-sm">❤️</span> by{" "}
						<a
							className="font-semibold text-cyan-600 transition-colors hover:text-cyan-700"
							href="https://devfinity.net"
							rel="noopener noreferrer"
							target="_blank"
						>
							Devfinity
						</a>
					</p>
				</footer>
			</main>
		</div>
	);
}