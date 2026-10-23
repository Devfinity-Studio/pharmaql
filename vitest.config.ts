import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/__tests__/**/*.test.ts"],
	},
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
			"server-only": path.resolve(
				import.meta.dirname,
				"./src/lib/__tests__/mocks/server-only.ts",
			),
		},
	},
});
