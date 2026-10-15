import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "PharmaQL | Asmee Pharma MR Portal",
		short_name: "PharmaQL",
		description:
			"Enterprise MR portal empowering medical representatives with live stock movement, sales statements, and order tracking.",
		start_url: "/dashboard",
		display: "standalone",
		background_color: "#0B2545",
		theme_color: "#0071BC",
		orientation: "portrait-primary",
		icons: [
			{
				src: "/favicons/android-chrome-192x192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/favicons/android-chrome-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/favicons/android-chrome-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/favicons/apple-touch-icon.png",
				sizes: "180x180",
				type: "image/png",
			},
		],
	};
}
