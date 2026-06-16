import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (session) {
		redirect("/");
	}

	return (
		<main className="relative flex min-h-screen flex-col justify-center bg-[#F4F7F9] text-[#0B2545] py-12 overflow-x-hidden sm:px-6 lg:px-8">

			{/* Still/Fixed Minimalist Medical Grid Pattern Background */}
			<div className="bg-fixed absolute inset-0 z-0 opacity-[0.4] pointer-events-none bg-[radial-gradient(#0071BC_1px,transparent_1px)] [background-size:24px_24px]"></div>

			{/* Text Headers */}
			<div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center">
				{/* Simple Text Branding */}
				<div className="inline-flex items-center gap-1 font-black text-3xl tracking-tight mb-4">
					<span>Pharma</span>
					<span className="text-[#0071BC]">QL</span>
				</div>

				<h2 className="font-extrabold text-3xl text-[#0B2545] tracking-tight md:text-4xl">
					Sign in to your account
				</h2>
				<p className="mt-2 font-semibold text-gray-500 text-base">
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