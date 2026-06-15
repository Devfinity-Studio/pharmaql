import Link from "next/link";
import type { ReactNode } from "react";

export default function ProductsLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-screen flex-col bg-gray-50">
			<header className="sticky top-0 z-50 border-gray-200 border-b bg-white shadow-sm">
				<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
					<div className="flex items-center gap-6">
						<Link
							className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text font-extrabold text-2xl text-transparent tracking-tight"
							href="/"
						>
							PharmaQL
						</Link>
						<nav className="hidden gap-4 md:flex">
							<Link
								className="font-medium text-gray-600 transition-colors hover:text-blue-600"
								href="/products"
							>
								All Companies
							</Link>
						</nav>
					</div>
					<div className="flex items-center gap-4">
						<Link
							className="font-bold text-gray-700 text-sm transition-colors hover:text-blue-600"
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
