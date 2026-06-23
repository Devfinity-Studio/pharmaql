import { ArrowDown, Cross, Pill } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import Header from "@/components/Header";
import { auth } from "@/server/auth";

export default async function Home() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-gradient-to-b from-white to-slate-50">
			<Header />
			<main className="relative flex-1 overflow-hidden">
				{/* HERO */}

				<section className="relative mx-auto flex max-w-5xl flex-col items-center justify-center px-6 pt-24 text-center">
					{/* LEFT DOTS */}

					<div className="absolute top-8 left-0 hidden lg:block">
						<div className="grid grid-cols-6 gap-2">
							{Array.from({ length: 36 }).map((_, i) => (
								<div className="h-1.5 w-1.5 rounded-full bg-blue-200" key={i} />
							))}
						</div>
					</div>

					{/* LEFT PILL */}

					<div className="absolute top-24 left-10 hidden lg:block">
						<div className="flex h-32 w-32 items-center justify-center rounded-full bg-blue-50">
							<Pill
								className="h-16 w-16 rotate-45 text-blue-500"
								strokeWidth={1.5}
							/>
						</div>
					</div>

					{/* RIGHT PLUS */}

					<div className="absolute top-96 right-0 hidden lg:block">
						<div className="flex h-32 w-32 items-center justify-center rounded-full bg-green-50">
							<Cross className="h-16 w-16 text-green-500" strokeWidth={1.5} />
						</div>
					</div>

					{/* RIGHT DOTS */}

					<div className="absolute right-0 bottom-56 hidden lg:block">
						<div className="grid grid-cols-6 gap-2">
							{Array.from({ length: 36 }).map((_, i) => (
								<div className="h-1.5 w-1.5 rounded-full bg-blue-200" key={i} />
							))}
						</div>
					</div>

					{/* PILLS */}

					<div className="absolute right-12 bottom-28 hidden lg:block">
						<Pill
							className="absolute h-28 w-28 rotate-[35deg] text-blue-500"
							strokeWidth={1.3}
						/>

						<Pill
							className="absolute top-10 left-12 h-20 w-20 rotate-[120deg] text-slate-300"
							strokeWidth={1.3}
						/>
					</div>

					<h1 className="font-extrabold text-6xl leading-tight md:text-7xl">
						<span className="text-slate-900">The Modern</span>

						<br />

						<span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
							Medicine Portal
						</span>
					</h1>

					<p className="mt-8 max-w-2xl text-slate-500 text-xl leading-9">
						Empowering medical representatives and distributors with real-time
						insights, effortless ordering and intelligent inventory tracking.
					</p>

					<Link
						className="mt-10 rounded-xl bg-blue-600 px-10 py-4 font-semibold text-white shadow-lg transition hover:bg-blue-700"
						href="/products"
					>
						Browse Directory
					</Link>

					{/*<div className="mt-20 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-white shadow-sm">
            <ArrowDown className="h-5 w-5 text-slate-500" />
          </div>

          <p className="mt-3 text-slate-400">Scroll to explore</p>
        </div>*/}
				</section>

				{/* SINGLE WAVE */}

				<div className="absolute bottom-0 left-0 w-full overflow-hidden">
					<svg className="w-full" viewBox="0 0 1440 320">
						<path
							d="

M0,224
L80,202.7
C160,181,320,139,480,154.7
C640,171,800,245,960,266.7
C1120,288,1280,256,1360,234.7
L1440,213
V320
H0
Z

"
							fill="#EEF4FF"
						/>
					</svg>
				</div>

				{/* FOOTER COPYRIGHT */}
				<div className="absolute right-0 bottom-4 left-0 z-20 text-center text-[10px] text-slate-500">
					<p>© {new Date().getFullYear()} PharmaQL. All rights reserved.</p>
					<p className="mt-1 flex items-center justify-center gap-1">
						Made with{" "}
						<span className="cursor-pointer text-red-500 transition-transform duration-200 hover:scale-125">
							❤️
						</span>{" "}
						by{" "}
						<a
							className="inline-block font-bold text-[#0071BC] transition-all hover:scale-105 hover:text-blue-800"
							href="https://devfinity.net"
							rel="noopener noreferrer"
							target="_blank"
						>
							Devfinity
						</a>
					</p>
				</div>
			</main>
		</div>
	);
}
