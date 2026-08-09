import fs from "fs";
import path from "path";
import readline from "readline";

async function run() {
	const dataDir = path.join(process.cwd(), "demo data");
	const filePath = path.join(dataDir, "dataexport.sql");
	const fileStream = fs.createReadStream(filePath);
	const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const tables = new Set<string>();

	for await (const line of rl) {
		const trimmed = line.trim();
		if (trimmed.startsWith("INSERT INTO")) {
			const match = trimmed.match(/INSERT INTO `([^`]+)`/);
			if (match) {
				tables.add(match[1]);
			}
		}
	}
    console.log("Tables in dataexport.sql:", Array.from(tables));
}

run().catch(console.error).then(() => process.exit(0));
