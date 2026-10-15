import Link from "next/link";
import { AlertOctagon, Mail, ShieldAlert } from "lucide-react";
import { getLicenseStatus } from "@/lib/license";

export const metadata = {
	title: "Subscription Required | PharmaQL | Asmee Pharma",
};

export const dynamic = "force-dynamic";

export default async function LicenseExpiredPage() {
	const status = await getLicenseStatus();

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4 text-white">
			<div className="pointer-events-none absolute inset-0 z-0 bg-[url('/devfinity.png')] bg-repeat opacity-[0.04] [background-size:120px]"></div>

			<div className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-950/80 p-8 text-center shadow-2xl backdrop-blur-xl">
				{/* Warning Icon */}
				<div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-500 shadow-inner">
					<AlertOctagon className="h-10 w-10 animate-pulse" />
				</div>

				<div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-400">
					<ShieldAlert className="h-3.5 w-3.5" />
					<span>License Inactive</span>
				</div>

				<h1 className="mt-3 font-black text-2xl tracking-tight text-white md:text-3xl">
					Software Access Suspended
				</h1>

				<p className="mt-3 text-sm leading-relaxed text-gray-400">
					The software subscription for <strong className="text-gray-200">{status.organization}</strong> has ended or access has been temporarily placed on hold.
				</p>

				{status.reason && (
					<div className="mt-5 rounded-xl border border-gray-800 bg-gray-900/60 p-3.5 font-mono text-xs text-rose-300">
						{status.reason}
					</div>
				)}

				<div className="mt-6 flex flex-col gap-3">
					<a
						className="flex items-center justify-center gap-2 rounded-xl bg-[#0071BC] px-5 py-3 font-bold text-sm text-white shadow-lg transition-all hover:bg-[#005a96] hover:shadow-[#0071BC]/20"
						href={`mailto:${status.supportEmail}?subject=PharmaQL%20License%20Renewal%20${encodeURIComponent(status.organization)}`}
					>
						<Mail className="h-4 w-4" />
						Contact Devfinity Support to Renew
					</a>

					<Link
						className="rounded-xl border border-gray-800 bg-gray-900/40 px-5 py-2.5 font-semibold text-xs text-gray-400 transition hover:bg-gray-800 hover:text-white"
						href="/login"
					>
						Developer / System Login Bypass &rarr;
					</Link>
				</div>

				<div className="mt-8 border-t border-gray-800/80 pt-4 text-center font-mono text-[11px] text-gray-500">
					PharmaQL Platform &bull; Developed by Devfinity
				</div>
			</div>
		</div>
	);
}
