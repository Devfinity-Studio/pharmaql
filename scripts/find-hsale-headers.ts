import fs from "fs";
import path from "path";
import readline from "readline";

async function run() {
	const dataDir = path.join(process.cwd(), "demo data");
	const filePath = path.join(dataDir, "dataexport.sql");
	const fileStream = fs.createReadStream(filePath);
	const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

	for await (const line of rl) {
		const trimmed = line.trim();
		if (trimmed.startsWith("INSERT INTO `h_sale`")) {
			console.log(trimmed.substring(0, 500));
			break;
		}
	}
}

run().catch(console.error).then(() => process.exit(0));
