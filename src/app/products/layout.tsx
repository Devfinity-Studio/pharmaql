import Link from "next/link";
import type { ReactNode } from "react";

export default function ProductsLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-screen flex-col bg-gray-50">
			<header className="sticky top-0 z-50 border-gray-200 border-b bg-white shadow-sm">
				<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">


						<div className="flex items-center gap-2 font-black text-2xl ">
							<Link href="/" className="flex gap-2">

							<span className="text-[#0B2545]">Pharma</span>
							<span className="text-[#0071BC]">
                             QL
                            </span>
							</Link>
						</div>


					<div className="flex items-center gap-4">
						<Link
							className="font-bold text-[#0B2545] text-xl transition-colors hover:text-blue-600 "
							href="/login"
						>
							Portal Login
							</Link>
					</div>
				</div>
			</header>
			<div className="flex-1">{children}</div>
		</div>
	);
}
