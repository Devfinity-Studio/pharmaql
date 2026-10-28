import {
	Activity,
	ArrowRight,
	Building2,
	Mail,
	MapPin,
	Phone,
	Pill,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import Header from "@/components/Header";
import { auth } from "@/server/auth";

export default async function Home() {
	const h = await headers();
	const session = await auth.api.getSession({
		headers: h,
	});

	const tenantName = h.get("x-tenant-name") || "Asmee Pharma Pvt. Ltd.";
	const tenantShortName = h.get("x-tenant-short-name") || "Asmee Pharma";
	const address = h.get("x-tenant-address") || "Plot No. 12, GIDC Industrial Estate, Ankleshwar, Gujarat - 393002";
	const phone = h.get("x-tenant-phone") || "+91 98765 43210";
	const email = h.get("x-tenant-email") || "info@asmeepharma.com";
	const gstin = h.get("x-tenant-gstin") || "24AAAAA0000A1Z5";
	const primaryColor = h.get("x-tenant-primary-color") || "#0B2545";
	const accentColor = h.get("x-tenant-accent-color") || "#134074";

	return (
		<div className="flex min-h-screen flex-col bg-[#050811] text-white selection:bg-cyan-500/30">
			<Header />

			<main className="relative flex-1 overflow-hidden">
				{/* BACKGROUND: HYBRID LIGHT/DARK GLOW + CONSTELLATION NODES + DIAGONAL BEAMS */}
				<div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
					{/* 1. Deep Dark Base Gradient */}
					<div className="absolute inset-0 bg-gradient-to-b from-[#080d1a] via-[#050811] to-[#020408]" />

					{/* 2. Hybrid Ambient Light Glows */}
					<div
						className="absolute top-[-5%] left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full blur-[140px] opacity-20"
						style={{ backgroundColor: accentColor || "#0071BC" }}
					/>
					<div
						className="absolute top-[20%] right-[-10%] h-[600px] w-[600px] rounded-full blur-[160px] opacity-15"
						style={{ backgroundColor: primaryColor || "#0B2545" }}
					/>
					<div className="absolute bottom-[-10%] left-[-5%] h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[150px]" />

					{/* 3. Subtle Background Micro-Grid */}
					<div
						className="absolute inset-0 opacity-[0.04]"
						style={{
							backgroundImage: `linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)`,
							backgroundSize: "50px 50px",
						}}
					/>

					{/* 4. Glowing Molecular Particles */}
					<div className="absolute top-[18%] left-[12%] h-2 w-2 rounded-full bg-cyan-400 opacity-70 shadow-[0_0_10px_#22d3ee]" />
					<div className="absolute top-[28%] left-[25%] h-3 w-3 rounded-full bg-blue-400/50 opacity-60 shadow-[0_0_12px_#60a5fa]" />
					<div className="absolute top-[15%] right-[20%] h-2.5 w-2.5 rounded-full bg-cyan-300 opacity-70 shadow-[0_0_10px_#67e8f9]" />
					<div className="absolute top-[52%] right-[14%] h-4 w-4 rounded-full bg-cyan-400/50 opacity-60 shadow-[0_0_15px_#22d3ee]" />
				</div>

				{/* HERO SECTION */}
				<section className="relative z-10 mx-auto flex min-h-[calc(100vh-140px)] max-w-7xl flex-col items-center justify-center px-6 pt-16 pb-24 text-center lg:pt-24 lg:pb-32">
					<div className="inline-flex animate-fade-in items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 font-medium text-cyan-400 text-sm backdrop-blur-md transition-colors hover:bg-cyan-500/20">
						<span className="relative flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
							<span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500"></span>
						</span>
						Official B2B Medical & Field Portal
					</div>

					<h1 className="mt-8 max-w-4xl animate-fade-in-up font-extrabold text-4xl text-white leading-[1.15] tracking-tight md:text-6xl lg:text-7xl">
						Welcome to
						<br />
						<span
							className="inline-block bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-300 bg-clip-text pb-1 text-transparent"
						>
							{tenantName}
						</span>
					</h1>

					<p
						className="mt-6 max-w-2xl animate-fade-in-up font-medium text-base text-slate-300 leading-relaxed md:text-lg"
						style={{ animationDelay: "150ms", animationFillMode: "both" }}
					>
						Empowering medical representatives, distributors, and pharmaceutical staff with
						real-time stock visibility, seamless order placement, and live ERP synchronisation for{" "}
						<strong className="text-white font-semibold">{tenantShortName}</strong>.
					</p>

					{/* Call to Action Buttons */}
					<div
						className="mt-10 flex animate-fade-in-up flex-col gap-4 sm:flex-row items-center justify-center"
						style={{ animationDelay: "300ms", animationFillMode: "both" }}
					>
						{session ? (
							<Link
								className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 font-bold text-white shadow-[0_0_30px_rgba(6,182,212,0.35)] transition-all hover:scale-105 hover:shadow-[0_0_45px_rgba(6,182,212,0.55)]"
								href={
									session.user.role === "ADMIN" || session.user.role === "DEVELOPER"
										? "/admin/dashboard"
										: "/dashboard"
								}
							>
								<span className="mr-2">Enter Dashboard</span>
								<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
							</Link>
						) : (
							<>
								<Link
									className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 font-bold text-white shadow-[0_0_30px_rgba(6,182,212,0.35)] transition-all hover:scale-105 hover:shadow-[0_0_45px_rgba(6,182,212,0.55)]"
									href="/login"
								>
									<span className="mr-2">MR Portal Login</span>
									<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
								</Link>

								<Link
									className="inline-flex items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/50 px-7 py-3.5 font-bold text-slate-200 backdrop-blur-md transition-all hover:bg-slate-700/70 hover:text-white"
									href="/login?portal=admin"
								>
									Administrator Sign In
								</Link>
							</>
						)}
					</div>

					{/* Feature Cards Grid */}
					<div
						className="mt-16 grid animate-fade-in-up grid-cols-1 gap-6 md:grid-cols-3 max-w-5xl w-full"
						style={{ animationDelay: "450ms", animationFillMode: "both" }}
					>
						<div className="flex flex-col items-center rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-cyan-500/40">
							<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
								<Activity className="h-6 w-6" />
							</div>
							<h3 className="mb-2 font-bold text-white text-lg">Real-Time ERP Sync</h3>
							<p className="text-slate-400 text-xs leading-relaxed">
								Live synchronization with on-premise Technomax ERP ensuring accurate stock, batch availability, and pricing.
							</p>
						</div>

						<div className="flex flex-col items-center rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-cyan-500/40">
							<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
								<Pill className="h-6 w-6" />
							</div>
							<h3 className="mb-2 font-bold text-white text-lg">Intelligent Order Flow</h3>
							<p className="text-slate-400 text-xs leading-relaxed">
								Effortless order placement with claim quantity calculation, free schemes, and overdue credit safeguards.
							</p>
						</div>

						<div className="flex flex-col items-center rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-cyan-500/40">
							<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
								<ShieldCheck className="h-6 w-6" />
							</div>
							<h3 className="mb-2 font-bold text-white text-lg">Isolated Field Access</h3>
							<p className="text-slate-400 text-xs leading-relaxed">
								Strict role-based data partitioning guarantees medical representatives access only assigned territory and doctor logs.
							</p>
						</div>
					</div>

					{/* Corporate Stationery Information Strip */}
					<div
						className="mt-14 w-full max-w-4xl rounded-2xl border border-slate-800/80 bg-slate-950/70 p-6 text-left backdrop-blur-md animate-fade-in-up"
						style={{ animationDelay: "550ms", animationFillMode: "both" }}
					>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
							<div className="flex items-start gap-2.5">
								<MapPin className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
								<div>
									<span className="font-semibold text-white block">Registered Facility:</span>
									<span className="text-slate-400">{address}</span>
								</div>
							</div>

							<div className="flex items-start gap-2.5">
								<Building2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
								<div>
									<span className="font-semibold text-white block">GSTIN / Tax ID:</span>
									<span className="font-mono text-cyan-300">{gstin}</span>
								</div>
							</div>

							<div className="flex items-center gap-2.5">
								<Mail className="h-4 w-4 text-cyan-400 shrink-0" />
								<div>
									<span className="font-semibold text-white">Official Email: </span>
									<span className="text-slate-400">{email}</span>
								</div>
							</div>

							<div className="flex items-center gap-2.5">
								<Phone className="h-4 w-4 text-cyan-400 shrink-0" />
								<div>
									<span className="font-semibold text-white">Direct Line: </span>
									<span className="text-slate-400">{phone}</span>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* FOOTER */}
				<footer
					className="relative z-10 w-full border-t border-slate-800 bg-slate-950/90 py-6 text-center backdrop-blur-md"
				>
					<p className="text-slate-400 text-xs font-medium">
						&copy; {new Date().getFullYear()} {tenantName}. All rights reserved.
					</p>
					<p className="mt-1.5 flex items-center justify-center gap-1 text-slate-500 text-[11px]">
						Powered by{" "}
						<a
							className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
							href="https://devfinity.net"
							rel="noopener noreferrer"
							target="_blank"
						>
							Devfinity Cloud Platform
						</a>
					</p>
				</footer>
			</main>
		</div>
	);
}