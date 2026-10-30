import { headers } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/server/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
	const h = await headers();
	const session = await auth.api.getSession({
		headers: h,
	});

	if (session) {
		if (session.user.role === "DEVELOPER") {
			redirect("/admin/dev");
		} else if (session.user.role === "ADMIN") {
			redirect("/admin/dashboard");
		} else {
			redirect("/dashboard");
		}
	}

	const tenantLogo = h.get("x-tenant-logo") || "/devfinity.png";
	const tenantName = h.get("x-tenant-name") || "PharmaQL";

	return (
		<main className="relative flex min-h-screen flex-col justify-center overflow-x-hidden bg-[#F4F7F9] py-12 text-[#0B2545] sm:px-6 lg:px-8">
			{/* Still/Fixed Minimalist Medical Grid Pattern Background */}
			<div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#0071BC_1px,transparent_1px)] bg-fixed opacity-[0.4] [background-size:24px_24px]"></div>

			{/* Text Headers */}
			<div className="relative z-10 text-center sm:mx-auto sm:w-full sm:max-w-md">
				{/* Simple Text Branding */}
				<div className="mb-4 flex justify-center">
					<Image
						alt={`${tenantName} Logo`}
						className="object-contain max-h-16"
						height={60}
						priority
						src={tenantLogo}
						width={200}
						unoptimized
					/>
				</div>

				<h2 className="font-extrabold text-3xl text-[#0B2545] tracking-tight md:text-4xl">
					Sign in to your account
				</h2>
				<p className="mt-2 font-semibold text-base text-gray-500">
					Admin or Medical Representative Access
				</p>
			</div>

			{/* Interactive Form Component Layer */}
			<div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md">
				<Suspense fallback={<div className="h-64 rounded-2xl bg-white shadow-sm border border-gray-100 animate-pulse" />}>
					<LoginForm />
				</Suspense>
			</div>
		</main>
	);
}
