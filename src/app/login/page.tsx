import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (session) {
		if (session.user.role === "ADMIN") {
			redirect("/admin/dashboard");
		} else {
			redirect("/dashboard");
		}
	}

	return (
		<main className="relative flex min-h-screen flex-col justify-center overflow-x-hidden bg-[#F4F7F9] py-12 text-[#0B2545] sm:px-6 lg:px-8">
			{/* Still/Fixed Minimalist Medical Grid Pattern Background */}
			<div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#0071BC_1px,transparent_1px)] bg-fixed opacity-[0.4] [background-size:24px_24px]"></div>

			{/* Text Headers */}
			<div className="relative z-10 text-center sm:mx-auto sm:w-full sm:max-w-md">
				{/* Simple Text Branding */}
				<div className="mb-4 inline-flex items-center gap-1 font-black text-3xl tracking-tight">
					<span>Pharma</span>
					<span className="text-[#0071BC]">QL</span>
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
				<LoginForm />
			</div>
		</main>
	);
}
