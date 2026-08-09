import fs from "fs";
import path from "path";
import readline from "readline";

const file = path.join("demo data", "dataexport.sql");

async function run() {
	const stream = fs.createReadStream(file);
	const rl = readline.createInterface({ input: stream });

	for await (const line of rl) {
		if (line.includes("INSERT INTO `m_mr`")) {
			console.log(line.substring(0, 500));
			break;
		}
	}
}
run();
