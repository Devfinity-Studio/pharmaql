import fs from "fs";
import path from "path";
import readline from "readline";

async function run() {
	const dataDir = path.join(process.cwd(), "demo data");
	const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".sql"));

	for (const file of files) {
		const filePath = path.join(dataDir, file);
		const fileStream = fs.createReadStream(filePath);
		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity,
		});

		let currentTable = "";
		for await (const line of rl) {
			const trimmed = line.trim();
			if (trimmed.startsWith("INSERT INTO")) {
				const match = trimmed.match(/INSERT INTO `([^`]+)`/);
				if (match) {
					currentTable = match[1];
				}
			}

			if (currentTable === "m_mr" && trimmed.startsWith("(")) {
				if (trimmed.toLowerCase().includes("rajesh giri")) {
					console.log(`[${file}] ${trimmed}`);
				}
			}
			if (trimmed.endsWith(";")) {
				currentTable = "";
			}
		}
	}
}

run()
	.catch(console.error)
	.then(() => process.exit(0));
