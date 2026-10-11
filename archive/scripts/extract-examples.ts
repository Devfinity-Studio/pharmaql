import fs from "fs";
import path from "path";
import readline from "readline";

async function main() {
	const rl = readline.createInterface({
		input: fs.createReadStream(
			path.join(process.cwd(), "demo data", "dataexport.sql"),
		),
	});

	for await (const line of rl) {
		if (line.includes("INSERT INTO `h_batch` (")) {
			console.log(line);
			break;
		}
	}
}
main();
