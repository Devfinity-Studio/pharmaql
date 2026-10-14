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
};

export default config;

