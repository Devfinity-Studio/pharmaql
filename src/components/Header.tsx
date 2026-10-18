import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/server/auth";

export default async function Header() {
	const session = await auth.api.getSession({ headers: await headers() });

	return (
	<header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md">
		<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
			{/* Logo Badge Container */}
			<div className="flex items-center gap-3 cursor-pointer">

					<Link

						href={"/"}
					>
						<Image
							alt="Asmee Pharma Logo"
							className="h-8 w-auto object-contain"
							height={36}
							priority
							src="/logo.png"
							width={140}
						/>
					</Link>

				<div className="flex flex-col">
              <span className="font-extrabold text-slate-900 text-lg tracking-wider leading-tight">
                ASMEE <span className="text-cyan-600">PHARMA</span>
              </span>
					<span className="font-semibold text-[10px] text-cyan-700 tracking-widest uppercase">
                LOGISTICS PORTAL
              </span>
				</div>
			</div>

			<div className="flex items-center gap-6">
				{session ? (
					<>
						<Link className="font-semibold text-slate-300 transition-colors hover:text-white"
						      href={
								  session.user.role === "ADMIN"
									  ? "/admin/dashboard"
									  : "/dashboard"
							  }
						>
							Dashboard
						</Link>
						<LogoutButton className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-6 py-2.5 font-bold text-cyan-400 backdrop-blur-sm transition-all hover:bg-cyan-500/20 hover:text-cyan-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]" />
					</>
				) : (
					<Link className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-6 py-2.5 font-bold text-cyan-400 backdrop-blur-sm transition-all hover:bg-cyan-500/20 hover:text-cyan-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
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
