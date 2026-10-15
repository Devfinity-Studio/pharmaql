// @ts-nocheck
import crypto from "node:crypto";

// Node 26 compatibility: Webpack 5 context tsh hashing can pass undefined data to Hash.update
const origUpdate = crypto.Hash.prototype.update;
crypto.Hash.prototype.update = function (data, ...args) {
	if (data === undefined) {
		return this;
	}
	return origUpdate.call(this, data, ...args);
};

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
	webpack: (webpackConfig) => {
		webpackConfig.output.hashFunction = "sha256";
		return webpackConfig;
	},
	headers: async () => {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "X-DNS-Prefetch-Control",
						value: "on",
					},
					{
						key: "Strict-Transport-Security",
						value: "max-age=63072000; includeSubDomains; preload",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
					},
					{
						key: "Content-Security-Policy",
						value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com http://127.0.0.1:* http://localhost:*; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';",
					},
				],
			},
		];
	},
};

export default config;

