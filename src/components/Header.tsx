import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/server/auth";

export default async function Header() {
	const session = await auth.api.getSession({ headers: await headers() });
	const isAdminOrDev =
		session?.user?.role === "ADMIN" || session?.user?.role === "DEVELOPER";

	return (
		<header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 shadow-xs backdrop-blur-md">
			<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
				{/* Brand Link */}
				<Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
					<Image
						alt="Asmee Pharma Logo"
						className="h-8 w-auto object-contain"
						height={36}
						priority
						src="/logo.png"
						width={140}
					/>
					<div className="flex flex-col">
						<span className="font-extrabold text-slate-900 text-lg tracking-wider leading-tight">
							ASMEE <span className="text-cyan-600">PHARMA</span>
						</span>
						<span className="font-semibold text-[10px] text-cyan-700 tracking-widest uppercase">
							LOGISTICS PORTAL
						</span>
					</div>
				</Link>

				<div className="flex items-center gap-4 sm:gap-6">
					{session ? (
						<>
							<Link
								className="font-semibold text-slate-700 text-sm transition-colors hover:text-cyan-600"
								href={isAdminOrDev ? "/admin/dashboard" : "/dashboard"}
							>
								Dashboard
							</Link>
							<LogoutButton className="rounded-full border border-slate-200 bg-slate-50 px-5 py-2 font-bold text-slate-700 text-sm shadow-xs transition-all hover:bg-slate-100 hover:text-slate-900" />
						</>
					) : (
						<Link
							className="rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-2.5 font-bold text-white text-sm shadow-xs transition-all hover:from-cyan-500 hover:to-blue-500 hover:shadow-md"
							href="/login"
						>
							Sign In
						</Link>
					)}
				</div>
			</div>
		</header>
	);
}
