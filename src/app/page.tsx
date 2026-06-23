import { headers } from "next/headers";
import Link from "next/link";
import {
	ArrowDown,
	Cross,
	Pill
} from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/server/auth";


export default async function Home() {

	const session = await auth.api.getSession({
		headers: await headers()
	});


	return (

		<main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-white to-slate-50">


			{/* NAVBAR */}

			<nav className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">


				<div className="text-3xl font-bold">

<span className="text-slate-900">
Pharma
</span>

					<span className="text-blue-600">
QL
</span>

				</div>




				<div className="flex items-center gap-4">


					{session ? (

						<>

							<Link
								href={
									session.user.role === "ADMIN"
										? "/admin/dashboard"
										: "/dashboard"
								}
								className="font-medium text-slate-600 hover:text-black"
							>

								Dashboard

							</Link>


							<LogoutButton/>

						</>

					) : (


						<Link

							href="/login"

							className="rounded-xl border border-blue-200 px-5 py-2 text-blue-600 hover:bg-blue-50"

						>

							Sign In

						</Link>

					)}

				</div>


			</nav>






			{/* HERO */}


			<section className="relative mx-auto flex max-w-5xl flex-col items-center justify-center px-6 pt-24 text-center">



				{/* LEFT DOTS */}


				<div className="absolute left-0 top-8 hidden lg:block">

					<div className="grid grid-cols-6 gap-2">

						{Array.from({ length: 36 }).map((_,i)=>(

							<div
								key={i}
								className="h-1.5 w-1.5 rounded-full bg-blue-200"
							/>

						))}

					</div>

				</div>






				{/* LEFT PILL */}



				<div className="absolute left-10 top-24 hidden lg:block">


					<div className="flex h-32 w-32 items-center justify-center rounded-full bg-blue-50">


						<Pill

							className="h-16 w-16 rotate-45 text-blue-500"

							strokeWidth={1.5}

						/>


					</div>


				</div>






				{/* RIGHT PLUS */}


				<div className="absolute right-0 top-96 hidden lg:block">


					<div className="flex h-32 w-32 items-center justify-center rounded-full bg-green-50">


						<Cross


							className="h-16 w-16 text-green-500"

							strokeWidth={1.5}


						/>


					</div>

				</div>







				{/* RIGHT DOTS */}



				<div className="absolute right-0 bottom-56 hidden lg:block">


					<div className="grid grid-cols-6 gap-2">


						{Array.from({ length: 36 }).map((_,i)=>(


							<div
								key={i}
								className="h-1.5 w-1.5 rounded-full bg-blue-200"
							/>


						))}


					</div>


				</div>








				{/* PILLS */}


				<div className="absolute right-12 bottom-28 hidden lg:block">


					<Pill

						className="absolute h-28 w-28 rotate-[35deg] text-blue-500"

						strokeWidth={1.3}

					/>



					<Pill

						className="absolute left-12 top-10 h-20 w-20 rotate-[120deg] text-slate-300"

						strokeWidth={1.3}

					/>


				</div>








				<h1 className="text-6xl font-extrabold leading-tight md:text-7xl">


<span className="text-slate-900">

The Modern

</span>


					<br/>


					<span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">


Medicine Portal


</span>


				</h1>








				<p className="mt-8 max-w-2xl text-xl leading-9 text-slate-500">


					Empowering medical representatives and distributors with
					real-time insights, effortless ordering and intelligent
					inventory tracking.


				</p>








				<Link


					href="/products"


					className="mt-10 rounded-xl bg-blue-600 px-10 py-4 font-semibold text-white shadow-lg transition hover:bg-blue-700"

				>


					Browse Directory


				</Link>









				<div className="mt-20 flex flex-col items-center">


					<div className="flex h-14 w-14 items-center justify-center rounded-full border bg-white shadow-sm">


						<ArrowDown className="h-5 w-5 text-slate-500"/>


					</div>


					<p className="mt-3 text-slate-400">

						Scroll to explore

					</p>


				</div>



			</section>






			{/* SINGLE WAVE */}



			<div className="absolute bottom-0 left-0 w-full overflow-hidden">


				<svg

					viewBox="0 0 1440 320"

					className="w-full"

				>


					<path


						fill="#EEF4FF"


						d="

M0,224
L80,202.7
C160,181,320,139,480,154.7
C640,171,800,245,960,266.7
C1120,288,1280,256,1360,234.7
L1440,213
V320
H0
Z

"


					/>


				</svg>


			</div>


		</main>

	);
}