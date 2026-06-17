import { headers } from "next/headers";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/server/auth";

export default async function Home() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	return (
		<main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#F4F7F9] text-[#0B2545]">
			{/* Abstract Background Shapes Removed for Premium Accessibility and Minimalism */}

			{/* Navigation Bar */}
			<nav className="rounded-2xl z-10 flex w-full max-w-7xl items-center justify-between px-6 py-6 border-b border-gray-200 bg-white shadow-sm">
				<div className="flex items-center gap-2 font-black text-2xl tracking-tight">
					<span className="text-[#0B2545]">Pharma</span>
					<span className="text-[#0071BC]">
                   QL
                </span>
				</div>
				<div className="flex items-center gap-4">
					{session ? (
						<>
							<Link
								className="font-semibold transition hover:text-[#0071BC] text-[#0B2545]"
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
							className="rounded-md border border-gray-300 bg-white px-8 py-2.5 font-semibold text-[#0B2545] transition hover:bg-gray-50 shadow-sm"
							href="/login"
						>
							Sign In
						</Link>
					)}
				</div>
			</nav>

			{/* Hero Section */}
			<div className="z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
				<h1 className="mb-8 font-extrabold text-6xl leading-tight tracking-tight md:text-8xl text-[#0B2545]">
					The Modern <br />
					<span className="text-red-300">
                   I Love You Debuuu ❤
                </span>
				</h1>
				<p className="mb-12 max-w-2xl font-semibold text-gray-600 text-xl md:text-2xl">
					Empowering medical representatives and distributors with real-time
					insights, effortless ordering, and intelligent inventory tracking.
				</p>

				<div className="flex flex-col gap-6 sm:flex-row">
					<Link
						className="transform rounded-md bg-[#0071BC] px-10 py-4 font-bold text-lg text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#134074] hover:shadow-lg"
						href="/products"
					>
						Browse Directory
					</Link>
					{!session && (
						<Link
							className="rounded-md border-2 border-[#0B2545] bg-white px-10 py-4 font-bold text-lg text-[#0B2545] transition hover:bg-gray-50 shadow-sm"
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