import { headers } from "next/headers";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/server/auth";

export default async function Home() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	return (
		<main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white">
			{/* Abstract Background Shapes */}
			<div className="pointer-events-none absolute top-0 left-0 z-0 h-full w-full overflow-hidden">
				<div className="absolute top-[-10%] left-[-10%] h-96 w-96 animate-blob rounded-full bg-purple-600 opacity-50 mix-blend-multiply blur-[128px] filter"></div>
				<div className="animation-delay-2000 absolute top-[20%] right-[-10%] h-96 w-96 animate-blob rounded-full bg-cyan-500 opacity-50 mix-blend-multiply blur-[128px] filter"></div>
				<div className="animation-delay-4000 absolute bottom-[-20%] left-[20%] h-96 w-96 animate-blob rounded-full bg-pink-600 opacity-50 mix-blend-multiply blur-[128px] filter"></div>
			</div>

			{/* Navigation Bar */}
			<nav className="z-10 flex w-full max-w-7xl items-center justify-between px-6 py-6">
				<div className="flex items-center gap-2 font-black text-2xl tracking-tight">
					<span className="text-white">Pharma</span>
					<span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
						QL
					</span>
				</div>
				<div className="flex items-center gap-4">
					{session ? (
						<>
							<Link
								className="font-semibold transition hover:text-cyan-400"
								href={
									session.user.role === "ADMIN"
										? "/admin/dashboard"
										: "/dashboard"
								}
							>
								Dashboard
							</Link>
							<LogoutButton />
						</>
					) : (
						<Link
							className="rounded-full border border-white/10 bg-white/10 px-8 py-2.5 font-semibold backdrop-blur-md transition hover:bg-white/20"
							href="/login"
						>
							Sign In
						</Link>
					)}
				</div>
			</nav>

			{/* Hero Section */}
			<div className="z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
				<h1 className="mb-8 font-extrabold text-6xl leading-tight tracking-tight md:text-8xl">
					The Modern <br />
					<span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
						Medicine Portal
					</span>
				</h1>
				<p className="mb-12 max-w-2xl font-medium text-gray-300 text-xl md:text-2xl">
					Empowering medical representatives and distributors with real-time
					insights, effortless ordering, and intelligent inventory tracking.
				</p>

				<div className="flex flex-col gap-6 sm:flex-row">
					<Link
						className="transform rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-10 py-4 font-bold text-lg shadow-lg transition hover:-translate-y-1 hover:shadow-cyan-500/25"
						href="/products"
					>
						Browse Directory
					</Link>
					{!session && (
						<Link
							className="rounded-full border border-white/20 bg-white/10 px-10 py-4 font-bold text-lg backdrop-blur-md transition hover:bg-white/20"
							href="/login"
						>
							Partner Login
						</Link>
					)}
				</div>
			</div>
		</main>
	);
}
