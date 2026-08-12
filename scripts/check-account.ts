import fs from "fs";
import readline from "readline";

async function run() {
	const rl = readline.createInterface({
		input: fs.createReadStream("demo data/dataexport.sql"),
	});
	for await (const line of rl) {
		if (line.startsWith("INSERT INTO `account`")) {
			console.log(line.substring(0, 500));
			break;
		}
	}
}
run();
